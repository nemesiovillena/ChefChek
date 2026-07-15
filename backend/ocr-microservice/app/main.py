"""
Aplicación principal FastAPI para el microservicio OCR
"""
import logging
import time
import cv2
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .models import (
    OCRResponse,
    HealthResponse,
    OCRRequest,
    OCRRefineRequest,
    CatalogExtractionResponse,
)
from .services.document_processor import DocumentProcessor
from .services.catalog_extraction_service import CatalogExtractionService
import os

# Configurar logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(settings.log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Variables globales
document_processor = None
app_start_time = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestor de ciclo de vida de la aplicación"""
    global document_processor, app_start_time

    # Startup
    logger.info("Iniciando microservicio OCR...")
    app_start_time = time.time()

    try:
        # Inicializar procesador de documentos
        document_processor = DocumentProcessor(
            language=settings.ocr_language,
            use_gpu=settings.ocr_use_gpu,
            confidence_threshold=settings.ocr_confidence_threshold
        )
        logger.info("Procesador de documentos inicializado exitosamente")
    except Exception as e:
        logger.error(f"Error inicializando procesador: {str(e)}")
        raise

    yield

    # Shutdown
    logger.info("Apagando microservicio OCR...")
    # Limpieza si es necesaria


# Crear aplicación FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Microservicio OCR para procesamiento de albaranes con PaddleOCR y OpenCV",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar orígenes permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
async def root():
    """Endpoint raíz"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "documentation": "/docs"
    }


@app.get("/health", tags=["Health"], response_model=HealthResponse)
async def health_check():
    """
    Health check del servicio

    Verifica que el servicio esté funcionando correctamente y reporta
    el estado de las dependencias principales.
    """
    uptime = time.time() - app_start_time if app_start_time else 0

    # Verificar dependencias
    dependencies = {
        "ocr_engine": "ok" if document_processor else "error",
        "opencv": "ok",
        "paddleocr": "ok"
    }

    # Verificar si el procesador está inicializado
    if document_processor:
        dependencies["ocr_engine"] = "ok"
    else:
        dependencies["ocr_engine"] = "error"

    return HealthResponse(
        status="healthy" if all(dep == "ok" for dep in dependencies.values()) else "unhealthy",
        version=settings.app_version,
        uptime=uptime,
        dependencies=dependencies
    )


@app.post("/ocr/image", tags=["OCR"], response_model=OCRResponse)
async def process_image(
    file: UploadFile = File(..., description="Archivo de imagen (JPG, PNG)"),
    language: str = Form(default="es", description="Idioma del documento"),
    enable_preprocessing: bool = Form(default=True, description="Habilitar pre-procesamiento"),
    enable_validation: bool = Form(default=True, description="Habilitar validación"),
    confidence_threshold: float = Form(default=0.7, description="Umbral de confianza"),
    ai_model: str = Form(default="", description="Modelo IA para extracción (ej: gpt-4o-mini, gemini-2.0-flash)"),
    ai_api_key: str = Form(default="", description="API key del provider de IA")
):
    """
    Procesar imagen con OCR

    Sube una imagen y extrae información estructurada usando PaddleOCR.
    Incluye pre-procesamiento de imágenes y validación de datos.
    """
    start_time = time.time()

    # Validar tipo de archivo (más flexible)
    if file.content_type and not file.content_type.startswith('image/') and not file.content_type == 'application/pdf':
        logger.warning(f"Tipo de archivo inusual: {file.content_type}, intentando procesar de todos modos")

    # Validar tamaño de archivo
    file_size = 0
    content = await file.read()
    file_size = len(content)

    if file_size > settings.image_max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {settings.image_max_size / 1024 / 1024}MB"
        )

    logger.info(f"Procesando imagen: {file.filename}, tamaño: {file_size / 1024:.2f}KB")

    try:
        # Procesar imagen (convertir contenido a bytes si es necesario)
        if isinstance(content, str):
            # Si es string, convertir a bytes
            import base64
            image_data = base64.b64decode(content)
        else:
            image_data = content

        result = document_processor.process_image(
            image_data=image_data,
            enable_preprocessing=enable_preprocessing,
            enable_validation=enable_validation,
            ai_model=ai_model or None,
            ai_api_key=ai_api_key or None
        )

        if not result['success']:
            return OCRResponse(
                success=False,
                document=None,
                validation=None,
                processing_time=time.time() - start_time,
                error_message=result.get('error', 'Error desconocido'),
                metadata={
                    'file_name': file.filename,
                    'file_type': 'image',
                    'file_size': file_size
                }
            )

        logger.info(f"Imagen procesada exitosamente: {result['processing_time']:.2f}s")

        return OCRResponse(
            success=True,
            document=result['document'],
            validation=result.get('validation'),
            processing_time=result['processing_time'],
            error_message=None,
            metadata={
                'file_name': file.filename,
                'file_type': result['file_type'],
                'file_size': file_size,
                'preprocessing_applied': enable_preprocessing,
                'validation_applied': enable_validation,
                'preprocessing_metadata': result.get('preprocessing_metadata', {}),
                'ocr_metadata': result.get('ocr_metadata', {})
            }
        )

    except Exception as e:
        logger.error(f"Error procesando imagen: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando imagen: {str(e)}"
        )


@app.post("/ocr/pdf", tags=["OCR"], response_model=OCRResponse)
async def process_pdf(
    file: UploadFile = File(..., description="Archivo PDF"),
    language: str = Form(default="es", description="Idioma del documento"),
    enable_preprocessing: bool = Form(default=True, description="Habilitar pre-procesamiento"),
    enable_validation: bool = Form(default=True, description="Habilitar validación"),
    confidence_threshold: float = Form(default=0.7, description="Umbral de confianza"),
    ai_model: str = Form(default="", description="Modelo IA para extracción (ej: gpt-4o-mini, gemini-2.0-flash)"),
    ai_api_key: str = Form(default="", description="API key del provider de IA")
):
    """
    Procesar PDF con OCR

    Sube un documento PDF y extrae información estructurada usando PaddleOCR.
    Convierte el PDF a imágenes primero, luego aplica OCR.
    """
    start_time = time.time()

    # Validar tipo de archivo
    if not file.content_type or file.content_type != 'application/pdf':
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no válido. Se requiere PDF"
        )

    # Validar tamaño de archivo
    content = await file.read()
    file_size = len(content)

    if file_size > settings.image_max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {settings.image_max_size / 1024 / 1024}MB"
        )

    logger.info(f"Procesando PDF: {file.filename}, tamaño: {file_size / 1024:.2f}KB")

    try:
        # Procesar PDF
        result = document_processor.process_pdf(
            pdf_data=content,
            enable_preprocessing=enable_preprocessing,
            enable_validation=enable_validation,
            ai_model=ai_model or None,
            ai_api_key=ai_api_key or None
        )

        if not result['success']:
            return OCRResponse(
                success=False,
                document=None,
                validation=None,
                processing_time=time.time() - start_time,
                error_message=result.get('error', 'Error desconocido'),
                metadata={
                    'file_name': file.filename,
                    'file_type': 'pdf',
                    'file_size': file_size
                }
            )

        logger.info(f"PDF procesado exitosamente: {result['processing_time']:.2f}s")

        return OCRResponse(
            success=True,
            document=result['document'],
            validation=result.get('validation'),
            processing_time=result['processing_time'],
            error_message=None,
            metadata={
                'file_name': file.filename,
                'file_type': result['file_type'],
                'file_size': file_size,
                'preprocessing_applied': enable_preprocessing,
                'validation_applied': enable_validation,
                'preprocessing_metadata': result.get('preprocessing_metadata', {}),
                'ocr_metadata': result.get('ocr_metadata', {})
            }
        )

    except Exception as e:
        logger.error(f"Error procesando PDF: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando PDF: {str(e)}"
        )


@app.post("/ocr/catalog", tags=["OCR"], response_model=CatalogExtractionResponse)
async def process_catalog(
    file: UploadFile = File(..., description="Imagen o PDF de la tarifa/catálogo"),
    ai_model: str = Form(..., description="Modelo IA para extracción (obligatorio, sin fallback regex)"),
    ai_api_key: str = Form(..., description="API key del provider de IA")
):
    """
    Extraer artículos y precios de un catálogo/tarifa de proveedor.

    A diferencia de /ocr/image y /ocr/pdf (albaranes), no aplica el pipeline
    completo de OCR+validación: la IA multimodal lee la imagen directamente.
    Requiere modelo + API key — no hay fallback por regex para catálogos.
    """
    start_time = time.time()
    content = await file.read()
    file_size = len(content)

    if file_size > settings.image_max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo demasiado grande. Máximo: {settings.image_max_size / 1024 / 1024}MB"
        )

    logger.info(f"Procesando catálogo: {file.filename}, tamaño: {file_size / 1024:.2f}KB")

    catalog_service = CatalogExtractionService()
    is_pdf = file.content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf")

    try:
        if is_pdf:
            result = catalog_service.extract_from_pdf(content, ai_model, ai_api_key)
        else:
            result = catalog_service.extract_from_image(content, ai_model, ai_api_key)

        if not result["success"]:
            logger.warning(f"Extracción de catálogo falló: {result['error_message']}")

        return CatalogExtractionResponse(**result)

    except Exception as e:
        logger.error(f"Error procesando catálogo: {str(e)}", exc_info=True)
        return CatalogExtractionResponse(
            success=False,
            supplier_name=None,
            products=[],
            processing_time=time.time() - start_time,
            error_message=f"Error procesando catálogo: {str(e)}"
        )


@app.get("/config", tags=["General"])
async def get_config():
    """
    Obtener configuración actual del servicio

    Devuelve la configuración actual (sin secretos).
    """
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "debug": settings.debug,
        "ocr_language": settings.ocr_language,
        "ocr_use_gpu": settings.ocr_use_gpu,
        "ocr_confidence_threshold": settings.ocr_confidence_threshold,
        "image_dpi": settings.image_dpi,
        "image_max_size": settings.image_max_size,
        "image_allowed_formats": settings.image_allowed_formats
    }


@app.post("/ocr/refine")
async def refine_ocr_extraction(request: OCRRefineRequest):
    """
    Refinar extracción OCR con hints de proveedor.
    Recibe el texto OCR ya extraído + hints del proveedor y vuelve a procesar con IA.
    """
    from .services.ai_extraction_service import AIExtractionService

    ai_service = AIExtractionService()
    model = request.ai_model or "gemini-2.0-flash"
    api_key = request.ai_api_key or ""
    supplier_hints = request.supplier_hints

    if not api_key:
        raise HTTPException(status_code=400, detail="ai_api_key es obligatoria para refinamiento")

    if not request.ocr_text:
        raise HTTPException(status_code=400, detail="ocr_text es obligatorio para refinamiento")

    start_time = time.time()

    # Refinar usando solo el texto OCR (sin imagen, para ahorrar tokens)
    result = ai_service.extract(
        ocr_text=request.ocr_text,
        image_base64="",  # Sin imagen en refine — el texto OCR ya tiene la info
        model=model,
        api_key=api_key,
        supplier_hints=supplier_hints,
    )

    processing_time = time.time() - start_time

    if not result:
        raise HTTPException(status_code=500, detail="Error en refinamiento con IA")

    return {
        "success": True,
        "document": result,
        "processing_time": processing_time,
        "metadata": {
            "refinement": True,
            "supplier_hints_used": bool(supplier_hints),
            "model": model,
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Manejador global de excepciones"""
    logger.error(f"Excepción no manejada: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Error interno del servidor",
            "detail": str(exc) if settings.debug else "Contacte al administrador"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )