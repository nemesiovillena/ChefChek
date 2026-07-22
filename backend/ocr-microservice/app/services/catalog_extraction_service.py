"""
Servicio de extracción de catálogos/tarifas de proveedor.

A diferencia de los albaranes, un catálogo es una simple lista de precios:
no necesita el pipeline completo de OCR+validación de DocumentProcessor
(pensado para el documento fiscal de un albarán). Aquí solo se convierte el
archivo a una imagen y se delega en el modelo de IA multimodal, que lee la
imagen directamente — el texto OCR es opcional/no crítico para este caso.
"""
import base64
import concurrent.futures
import io
import logging
import time
from typing import Optional

# Tope de llamadas IA simultáneas por catálogo multi-página: paraleliza sin
# disparar un aluvión de requests contra el proveedor (rate limits) cuando
# el documento tiene muchas páginas (ej. revistas/tarifas largas).
# Bajado de 5 a 2 tras observar en logs reales que OpenRouter empieza a
# devolver "Connection error" en cadena (conexiones rechazadas) pasado un
# pequeño burst inicial de peticiones simultáneas — el límite de conexiones
# concurrentes de estos proveedores (sobre todo en planes gratuitos/bajos)
# es más estricto de lo esperado.
MAX_PARALLEL_PAGES = 2

import cv2
import numpy as np
from PIL import Image
from pdf2image import convert_from_bytes

# Registra el soporte HEIC (formato iOS) si está disponible, igual que
# document_processor.py — mismo import, sin duplicar el registro si el
# módulo ya se cargó antes.
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

from .ai_extraction_service import AIExtractionService

logger = logging.getLogger(__name__)


def _pil_to_base64_jpeg(pil_image: Image.Image) -> str:
    """Normaliza a RGB y codifica a base64 JPEG para la IA multimodal."""
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")
    image_array = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    _, encoded = cv2.imencode(".jpg", image_array, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(encoded).decode("utf-8")


class CatalogExtractionService:
    """Extrae artículos y precios de una imagen o PDF de tarifa de proveedor."""

    def __init__(self):
        self.ai_service = AIExtractionService()

    def extract_from_image(
        self, image_data: bytes, ai_model: str, ai_api_key: str
    ) -> dict:
        start_time = time.time()
        try:
            pil_image = Image.open(io.BytesIO(image_data))
            image_base64 = _pil_to_base64_jpeg(pil_image)
            return self._run_extraction(image_base64, ai_model, ai_api_key, start_time)
        except Exception as e:
            logger.error(f"Error procesando imagen de catálogo: {e}", exc_info=True)
            return self._error_result(str(e), start_time)

    def extract_from_pdf(
        self, pdf_data: bytes, ai_model: str, ai_api_key: str
    ) -> dict:
        start_time = time.time()
        try:
            images = convert_from_bytes(pdf_data, dpi=300)
            if not images:
                return self._error_result(
                    "No se pudieron extraer imágenes del PDF", start_time
                )
            if len(images) == 1:
                image_base64 = _pil_to_base64_jpeg(images[0])
                return self._run_extraction(image_base64, ai_model, ai_api_key, start_time)
            return self._run_extraction_multi_page(images, ai_model, ai_api_key, start_time)
        except Exception as e:
            logger.error(f"Error procesando PDF de catálogo: {e}", exc_info=True)
            return self._error_result(str(e), start_time)

    def _run_extraction(
        self, image_base64: str, ai_model: str, ai_api_key: str, start_time: float
    ) -> dict:
        if not ai_model or not ai_api_key:
            return self._error_result(
                "Se requiere un modelo de IA y su API key para leer catálogos "
                "(a diferencia de los albaranes, no hay fallback por regex).",
                start_time,
            )

        result = self.ai_service.extract(
            ocr_text="",
            image_base64=image_base64,
            model=ai_model,
            api_key=ai_api_key,
            document_type="catalog",
        )

        if not result:
            return self._error_result(
                f"La IA ({ai_model}) no pudo extraer datos del catálogo. "
                "Revisa que la API key sea válida para este proveedor.",
                start_time,
            )

        products = self._sanitize_products(result.get("products", []))
        return {
            "success": True,
            "supplier_name": result.get("supplier_name"),
            "products": products,
            "processing_time": time.time() - start_time,
            "error_message": None,
        }

    def _run_extraction_multi_page(
        self, images: list, ai_model: str, ai_api_key: str, start_time: float
    ) -> dict:
        """Catálogo de varias páginas: la IA multimodal recibe una sola
        imagen por llamada, así que se extrae página a página y se fusionan
        los artículos. Las llamadas se lanzan en paralelo (ThreadPoolExecutor:
        son requests de red, no cómputo, así que hilos bastan) para que el
        tiempo total no escale linealmente con el nº de páginas. Si una
        página falla se omite (con aviso en el log); solo se devuelve error
        si fallan todas."""
        if not ai_model or not ai_api_key:
            return self._error_result(
                "Se requiere un modelo de IA y su API key para leer catálogos "
                "(a diferencia de los albaranes, no hay fallback por regex).",
                start_time,
            )

        def extract_page(page_image) -> Optional[dict]:
            image_base64 = _pil_to_base64_jpeg(page_image)
            return self.ai_service.extract(
                ocr_text="",
                image_base64=image_base64,
                model=ai_model,
                api_key=ai_api_key,
                document_type="catalog",
            )

        max_workers = min(len(images), MAX_PARALLEL_PAGES)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # executor.map preserva el orden de entrada, no el de finalización
            page_results = list(executor.map(extract_page, images))

        supplier_name = None
        products = []
        failed_pages = 0
        for page_number, result in enumerate(page_results, start=1):
            if not result:
                failed_pages += 1
                logger.warning(
                    f"Página {page_number}/{len(images)} del catálogo no se pudo "
                    "extraer, se omite"
                )
                continue
            supplier_name = supplier_name or result.get("supplier_name")
            products.extend(result.get("products", []))

        if failed_pages == len(images):
            return self._error_result(
                f"La IA ({ai_model}) no pudo extraer datos de ninguna página del "
                "catálogo. Revisa que la API key sea válida para este proveedor.",
                start_time,
            )

        return {
            "success": True,
            "supplier_name": supplier_name,
            "products": self._sanitize_products(products),
            "processing_time": time.time() - start_time,
            "error_message": None,
        }

    @staticmethod
    def _sanitize_products(products: list) -> list:
        """Sanea artículos antes de devolver el resultado: en catálogos
        largos (cientos de artículos), un único renglón mal formado por la
        IA (ej. name=null en una fila fantasma de tabla) no debe invalidar
        el resto de la extracción, que sí es buena — CatalogProduct exige
        `name: str` y `unit_price: float` sin aceptar null explícito."""
        valid = []
        dropped = 0
        for product in products:
            name = product.get("name")
            if not isinstance(name, str) or not name.strip():
                dropped += 1
                continue
            if not isinstance(product.get("unit_price"), (int, float)):
                product["unit_price"] = 0.0
            valid.append(product)
        if dropped:
            logger.warning(
                f"{dropped} artículo(s) descartado(s) por no traer un nombre válido"
            )
        return valid

    @staticmethod
    def _error_result(message: str, start_time: float) -> dict:
        return {
            "success": False,
            "supplier_name": None,
            "products": [],
            "processing_time": time.time() - start_time,
            "error_message": message,
        }
