"""
Servicio principal de procesamiento de documentos
Orquesta pre-procesamiento, OCR, y validación
"""
import logging
import time
import base64
from typing import Optional
import numpy as np
import cv2
from pdf2image import convert_from_bytes

logger = logging.getLogger(__name__)

# Registrar soporte para HEIC (formato iOS) si está disponible
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    logger.warning("pillow-heif no disponible. Soporte HEIC deshabilitado.")

from .image_preprocessing import ImagePreprocessor
from .ocr_service import OCRService
from .validation_service import ValidationService
from app.models import ExtractedDocument, ExtractedProduct

# Fotos de móvil modernas llegan a 20-24MP; ni EasyOCR ni los modelos de
# visión (que re-escalan internamente) necesitan esa resolución para leer
# texto de un albarán, y en CPU EasyOCR escala muy mal con megapíxeles.
MAX_IMAGE_DIMENSION = 1800

# La IA no devuelve una confianza medible y en este camino EasyOCR ya no corre.
# Son los valores por defecto que este camino ya usaba cuando faltaba la
# confianza del OCR; superan los umbrales de aviso de "confianza baja".
AI_DOCUMENT_CONFIDENCE = 0.8
AI_PRODUCT_CONFIDENCE = 0.7


def _resize_if_needed(image: np.ndarray, max_dimension: int = MAX_IMAGE_DIMENSION) -> np.ndarray:
    """Reduce el lado más largo a max_dimension manteniendo el aspect ratio."""
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side <= max_dimension:
        return image
    scale = max_dimension / longest_side
    new_size = (round(width * scale), round(height * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)
import re

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Servicio principal de procesamiento de documentos"""

    def __init__(self, language: str = "es", use_gpu: bool = False,
                 confidence_threshold: float = 0.7):
        """
        Inicializar procesador de documentos

        Args:
            language: Idioma del documento
            use_gpu: Usar GPU para OCR
            confidence_threshold: Umbral de confianza
        """
        self.language = language
        self.use_gpu = use_gpu
        self.confidence_threshold = confidence_threshold

        # Inicializar servicios
        self.preprocessor = ImagePreprocessor()
        self.ocr_service = OCRService(language=language, use_gpu=use_gpu)
        self.validator = ValidationService(confidence_threshold=confidence_threshold)

        logger.info(f"DocumentProcessor inicializado (idioma: {language}, "
                   f"GPU: {use_gpu}, umbral confianza: {confidence_threshold})")

    def process_pdf(self, pdf_data: bytes, enable_preprocessing: bool = True,
                    enable_validation: bool = True,
                    ai_model: Optional[str] = None,
                    ai_api_key: Optional[str] = None) -> dict:
        """
        Procesar documento PDF

        Args:
            pdf_data: Datos del PDF en bytes
            enable_preprocessing: Habilitar pre-procesamiento
            enable_validation: Habilitar validación

        Returns:
            Dict con resultados del procesamiento
        """
        start_time = time.time()
        logger.info("Iniciando procesamiento de PDF")

        try:
            # Convertir PDF a imágenes
            logger.info("Convirtiendo PDF a imágenes...")
            images = convert_from_bytes(pdf_data, dpi=300)
            logger.info(f"PDF convertido a {len(images)} página(s)")

            if not images:
                return {
                    'success': False,
                    'error': 'No se pudieron extraer imágenes del PDF',
                    'processing_time': time.time() - start_time
                }

            # Procesar primera página (puede extenderse para múltiples páginas)
            image = images[0]

            # Convertir PIL Image a numpy array
            image_array = np.array(image)
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

            # Procesar imagen
            return self._process_image_array(
                image_array,
                enable_preprocessing=enable_preprocessing,
                enable_validation=enable_validation,
                start_time=start_time,
                file_type='pdf',
                heic_conversion_time=None,
                ai_model=ai_model,
                ai_api_key=ai_api_key
            )

        except Exception as e:
            logger.error(f"Error procesando PDF: {str(e)}")
            return {
                'success': False,
                'error': f'Error procesando PDF: {str(e)}',
                'processing_time': time.time() - start_time
            }

    def process_image(self, image_data: bytes, enable_preprocessing: bool = True,
                      enable_validation: bool = True,
                      ai_model: Optional[str] = None,
                      ai_api_key: Optional[str] = None) -> dict:
        """
        Procesar imagen

        Args:
            image_data: Datos de la imagen en bytes
            enable_preprocessing: Habilitar pre-procesamiento
            enable_validation: Habilitar validación

        Returns:
            Dict con resultados del procesamiento
        """
        start_time = time.time()
        logger.info("Iniciando procesamiento de imagen")

        try:
            # Cargar imagen
            import cv2
            import io
            from PIL import Image, ImageOps

            logger.info(f"Iniciando carga de imagen, tamaño datos: {len(image_data)} bytes")
            pil_image = Image.open(io.BytesIO(image_data))

            # Las cámaras de móvil (iPhone/Android) guardan la rotación como tag
            # EXIF (0x0112) en lugar de girar los píxeles al disparar. PIL no
            # aplica ese tag al decodificar, así que una foto de albarán tomada
            # en vertical llegaba girada 90° a EasyOCR y a la IA, produciendo
            # líneas basura o ausentes. exif_transpose aplica la rotación a los
            # píxeles; es un no-op si no hay tag (imágenes ya verticales del
            # ordenador o escaneos). Se conserva .format porque transpose puede
            # perderlo y hace falta para la rama HEIC de abajo.
            img_format = pil_image.format
            exif_tag = pil_image.getexif().get(0x0112)
            # Reducir ANTES de rotar y convertir: girar y pasar a numpy una
            # foto de 24 MP costaba ~10 s por hoja en el servidor para acabar
            # reduciéndola a MAX_IMAGE_DIMENSION igualmente. En JPEG, además,
            # thumbnail descodifica ya a escala reducida (draft mode).
            pil_image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION))
            pil_image = ImageOps.exif_transpose(pil_image)
            pil_image.format = img_format
            if exif_tag and exif_tag != 1:
                logger.info(f"Orientación EXIF {exif_tag} aplicada: size ahora {pil_image.size}")
            logger.info(f"PIL Image cargado: mode={pil_image.mode}, size={pil_image.size}")

            # Convertir HEIC a JPEG si es necesario
            heic_conversion_time = None
            if pil_image.format == 'HEIF' or pil_image.format == 'HEIC':
                conversion_start = time.time()
                logger.info("Detectado formato HEIC/HEIF, iniciando conversión a JPEG")

                # HEIC puede tener canal alpha; crear fondo blanco y pegar
                if pil_image.mode in ('RGBA', 'LA', 'P'):
                    rgb_image = Image.new('RGB', pil_image.size, (255, 255, 255))
                    if pil_image.mode == 'P':
                        pil_image = pil_image.convert('RGBA')
                    rgb_image.paste(pil_image, mask=pil_image.split()[-1] if pil_image.mode != 'P' else None)
                    pil_image = rgb_image
                else:
                    pil_image = pil_image.convert('RGB')

                heic_conversion_time = time.time() - conversion_start
                logger.info(f"Conversión HEIC→JPEG completada en {heic_conversion_time*1000:.1f}ms")

                # Validar tiempo de conversión (<500ms objetivo)
                if heic_conversion_time > 0.5:
                    logger.warning(f"Tiempo de conversión HEIC ({heic_conversion_time*1000:.1f}ms) excede objetivo de 500ms")

            elif pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
                logger.info(f"Convertido a RGB")

            image_array = np.array(pil_image)
            logger.info(f"Numpy array creado: shape={image_array.shape}, dtype={image_array.dtype}")

            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            logger.info(f"Convertido a BGR: shape={image_array.shape}")

            # Procesar imagen
            return self._process_image_array(
                image_array,
                enable_preprocessing=enable_preprocessing,
                enable_validation=enable_validation,
                start_time=start_time,
                file_type='image',
                heic_conversion_time=heic_conversion_time,
                ai_model=ai_model,
                ai_api_key=ai_api_key
            )

        except Exception as e:
            logger.error(f"Error procesando imagen: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f'Error procesando imagen: {str(e)}',
                'processing_time': time.time() - start_time
            }

    def _process_image_array(self, image: np.ndarray, enable_preprocessing: bool,
                             enable_validation: bool, start_time: float,
                             file_type: str, heic_conversion_time: Optional[float] = None,
                             ai_model: Optional[str] = None,
                             ai_api_key: Optional[str] = None) -> dict:
        """
        Procesar array de imagen (método interno)

        Args:
            image: Array de imagen
            enable_preprocessing: Habilitar pre-procesamiento
            enable_validation: Habilitar validación
            start_time: Tiempo de inicio
            file_type: Tipo de archivo original

        Returns:
            Dict con resultados del procesamiento
        """
        preprocessing_metadata = {}

        try:
            original_size = image.shape[:2]
            image = _resize_if_needed(image)
            if image.shape[:2] != original_size:
                logger.info(f"Imagen redimensionada: {original_size} -> {image.shape[:2]}")

            document = None
            ocr_results = None
            ai_time = None
            ocr_time = None

            # Con IA configurada la foto va directa al modelo multimodal: lee
            # mejor que EasyOCR y evita su coste en CPU (decenas de segundos
            # por hoja en el servidor). El texto de EasyOCR no mejoraba la
            # extracción y a veces la desviaba (cliente tomado por proveedor).
            if ai_model and ai_api_key:
                ai_start = time.time()
                document = self._extract_with_ai(image, ai_model, ai_api_key)
                ai_time = time.time() - ai_start

            # Sin IA, o si la IA falló / no devolvió productos: EasyOCR + regex
            if document is None:
                if enable_preprocessing:
                    logger.info("Aplicando pre-procesamiento...")
                    ocr_image, preprocessing_metadata = self.preprocessor.preprocess_image(image)
                    logger.info(f"Pre-procesamiento completado: {preprocessing_metadata}")
                else:
                    logger.info("Pre-procesamiento deshabilitado")
                    ocr_image = image

                logger.info("Ejecutando OCR...")
                ocr_results = self.ocr_service.process_image(ocr_image)

                if not ocr_results['success']:
                    return {
                        'success': False,
                        'error': ocr_results.get('error', 'OCR falló'),
                        'processing_time': time.time() - start_time
                    }

                ocr_time = ocr_results['processing_time']
                logger.info(f"OCR completado: {len(ocr_results['lines'])} líneas, "
                           f"confianza: {ocr_results['confidence']:.2f}")

                document = self._extract_with_regex(ocr_results)
                document.raw_text = ocr_results['raw_text']
                document.processing_time = ocr_time

            # Validación si está habilitada
            validation_result = None
            if enable_validation:
                logger.info("Validando documento...")
                validation_result = self.validator.validate_document(document)
                logger.info(f"Validación completada: {validation_result.recommended_action}")

            # Tiempo total de procesamiento
            total_time = time.time() - start_time

            logger.info(
                f"Procesamiento completado exitosamente en {total_time:.2f}s "
                f"(método={document.extraction_method}, "
                f"ia={f'{ai_time:.2f}s' if ai_time is not None else 'no'}, "
                f"ocr={f'{ocr_time:.2f}s' if ocr_time is not None else 'no'})"
            )

            return {
                'success': True,
                'document': document,
                'validation': validation_result,
                'processing_time': total_time,
                'preprocessing_metadata': preprocessing_metadata,
                # Vacío cuando la IA leyó la foto directamente (EasyOCR no corrió)
                'ocr_metadata': {
                    'confidence': ocr_results['confidence'],
                    'line_count': len(ocr_results['lines']),
                    'language': self.language
                } if ocr_results else {},
                'file_type': file_type,
                'heic_conversion_time': heic_conversion_time
            }

        except Exception as e:
            logger.error(f"Error en procesamiento: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'processing_time': time.time() - start_time
            }

    def _extract_with_ai(self, image: np.ndarray, ai_model: str,
                         ai_api_key: str) -> Optional[ExtractedDocument]:
        """
        Extraer el albarán enviando la foto al modelo multimodal.

        Args:
            image: Foto a color ya redimensionada (no la binarizada de EasyOCR,
                   que degrada mucho la lectura multimodal)
            ai_model: Modelo de IA (ej: 'gpt-4o-mini')
            ai_api_key: API key del provider

        Returns:
            ExtractedDocument, o None si la IA falla o no devuelve productos
            (el llamador cae entonces a EasyOCR + regex)
        """
        logger.info(f"Intentando extracción con IA: {ai_model}")
        try:
            from .ai_extraction_service import AIExtractionService
            _, img_encoded = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 85])
            ai_result = AIExtractionService().extract(
                ocr_text="",
                image_base64=base64.b64encode(img_encoded).decode('utf-8'),
                model=ai_model,
                api_key=ai_api_key,
            )
            if ai_result and ai_result.get('products'):
                logger.info(f"IA extrajo {len(ai_result['products'])} productos correctamente")
                document = self._build_document_from_ai(ai_result)
                document.extraction_method = "ai"
                return document
            logger.error("IA no devolvió productos, fallback a EasyOCR + regex "
                         "(el resultado será de calidad muy inferior)")
        except Exception as e:
            logger.error(f"Extracción IA falló: {e}, fallback a EasyOCR + regex "
                         f"(el resultado será de calidad muy inferior)")
        return None

    def _extract_with_regex(self, ocr_results: dict) -> ExtractedDocument:
        """
        Extraer datos estructurados del texto de EasyOCR con regex.

        Args:
            ocr_results: Resultados del OCR

        Returns:
            ExtractedDocument con datos estructurados
        """
        raw_text = ocr_results['raw_text']
        lines = ocr_results['lines']

        # Limpieza inteligente del texto OCR
        cleaned_lines = self._clean_ocr_lines(lines)

        # Análisis básico del texto para extraer información
        supplier_name = self._extract_supplier_name(raw_text, cleaned_lines)
        document_number = self._extract_document_number(raw_text)
        document_date = self._extract_document_date(raw_text)
        products = self._extract_products(raw_text, cleaned_lines)
        total_amount = self._extract_total_amount(raw_text, cleaned_lines, products)

        # Extraer CIF/NIF usando el validador
        from .cif_validator import CifNifValidator
        cif_validator = CifNifValidator()
        tax_ids = cif_validator.extract_from_text(raw_text)
        cif_code = tax_ids.cif
        nif_code = tax_ids.nif
        tax_id_confidence = tax_ids.confidence

        # Calcular confianza global
        confidence = ocr_results['confidence']

        return ExtractedDocument(
            supplier_name=supplier_name,
            document_number=document_number,
            document_date=document_date,
            products=products,
            total_amount=total_amount,
            confidence=confidence,
            processing_time=0.0,  # Se llenará después
            raw_text=raw_text,
            cif_code=cif_code,
            nif_code=nif_code,
            tax_id_confidence=tax_id_confidence
        )

    def _build_document_from_ai(self, ai_result: dict) -> ExtractedDocument:
        """
        Construir ExtractedDocument a partir del resultado de la IA.

        Args:
            ai_result: Dict devuelto por el AI extraction service

        Returns:
            ExtractedDocument con datos de la IA
        """
        # El CIF/NIF lo lee la IA de la cabecera del proveedor. Solo se acepta
        # si supera el dígito de control: uno mal leído casaría con el
        # proveedor equivocado, peor que no tener ninguno.
        from .cif_validator import CifNifValidator
        validator = CifNifValidator()
        cif_code = None
        nif_code = None
        tax_id_confidence = 0.0
        ai_tax_id = re.sub(r'[^A-Za-z0-9]', '', ai_result.get('cif_code') or '').upper()
        if ai_tax_id.startswith('ES'):
            ai_tax_id = ai_tax_id[2:]
        if ai_tax_id and validator.validate_cif(ai_tax_id)[0]:
            cif_code = ai_tax_id
            tax_id_confidence = 1.0
        elif ai_tax_id and validator.validate_nif(ai_tax_id)[0]:
            # Proveedor autónomo: el backend casa proveedores por cif_code
            # (campo único cifNif), así que el NIF viaja también ahí
            cif_code = ai_tax_id
            nif_code = ai_tax_id
            tax_id_confidence = 1.0
        elif ai_tax_id:
            logger.warning(f"CIF/NIF de la IA descartado (dígito de control inválido): {ai_tax_id}")

        # Parsear fecha del documento
        document_date = None
        if ai_result.get('document_date'):
            try:
                from datetime import datetime
                date_str = ai_result['document_date']
                if isinstance(date_str, str):
                    for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y']:
                        try:
                            document_date = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
            except Exception:
                pass

        # Construir productos
        products = []
        for p in ai_result.get('products', []):
            products.append(ExtractedProduct(
                name=p.get('name', ''),
                description=p.get('description'),
                article_number=p.get('article_number'),
                lot=p.get('lot'),
                quantity=p.get('quantity', 0),
                unit=p.get('unit', 'ud'),
                unit_price=p.get('unit_price', 0),
                vat_percent=p.get('vat_percent'),
                price_with_vat=p.get('price_with_vat'),
                total_price=p.get('total_price', 0),
                confidence=AI_PRODUCT_CONFIDENCE,
            ))

        # Calcular total si no lo dio la IA
        total_amount = ai_result.get('total_amount', 0)
        if not total_amount and products:
            total_amount = sum(p.total_price for p in products)

        return ExtractedDocument(
            supplier_name=ai_result.get('supplier_name'),
            document_number=ai_result.get('document_number'),
            document_date=document_date,
            products=products,
            total_amount=total_amount,
            confidence=AI_DOCUMENT_CONFIDENCE,
            processing_time=0.0,
            raw_text=None,
            cif_code=cif_code,
            nif_code=nif_code,
            tax_id_confidence=tax_id_confidence,
        )

    def _clean_ocr_lines(self, lines: list) -> list:
        """
        Limpia líneas OCR eliminando ruido pero conservando productos válidos

        Args:
            lines: Lista de líneas con confianza

        Returns:
            Lista de líneas limpias
        """
        cleaned_lines = []

        # Patrones más específicos de ruido (menos agresivos)
        skip_patterns = [
            r'^\[.*?\]$',  # [Nombre], [NIF], etc.
            r'^_{3,}$',  # Solo guiones bajos
            r'^-{3,}$',  # Solo guiones
            r'^\s*$',  # Líneas vacías
        ]

        # Palabras comunes en plantillas (solo si está sola la línea)
        template_words = [
            'nombre', 'empresa', 'nif', 'dirección', 'teléfono', 'correo',
            'cliente', 'factura', 'albarán', 'código', 'artículo',
            'estimados', 'gracias', 'confianza', 'continuación', 'detallamos',
            'mercancía', 'entregada', 'según', 'acordado', 'observaciones',
            'recepción', 'firma', 'sello', 'entregar'
        ]

        for line in lines:
            text = line['text'].strip()

            # Ignorar líneas muy cortas
            if len(text) < 2:
                continue

            # Ignorar líneas que coinciden con patrones de ruido básicos
            skip = False
            for pattern in skip_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    skip = True
                    break

            if skip:
                continue

            # Solo ignorar líneas de plantilla si NO tienen números ni contenido descriptivo
            # (conservar líneas que puedan ser productos)
            text_lower = text.lower()
            has_number = any(c.isdigit() for c in text)
            has_desc_words = len(text.split()) > 2 or any(len(word) > 5 for word in text.split())

            # Si es solo una palabra de plantilla sin números, ignorar
            if text_lower in template_words and not has_number and not has_desc_words:
                continue

            # Solo filtrar líneas con confianza muy baja si no tienen contenido útil
            if line['confidence'] < 0.4 and not has_number and not has_desc_words:
                continue

            cleaned_lines.append(line)

        logger.info(f"Líneas limpias: {len(cleaned_lines)} de {len(lines)} originales")
        return cleaned_lines

    def _extract_supplier_name(self, raw_text: str, lines: list) -> Optional[str]:
        """
        Extraer nombre del proveedor del texto

        Args:
            raw_text: Texto completo
            lines: Lista de líneas con confianza

        Returns:
            Nombre del proveedor o None
        """
        # Buscar patrones comunes en albaranes españoles
        supplier_patterns = [
            r'proveedor[:\s]+([^\n]+)',
            r'supplier[:\s]+([^\n]+)',
            r'empresa[:\s]+([^\n]+)',
            r'company[:\s]+([^\n]+)'
        ]

        for pattern in supplier_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Si no se encuentra patrón, buscar líneas con alta confianza al principio
        for line in lines[:5]:
            if line['confidence'] > 0.8 and len(line['text']) > 3 and len(line['text']) < 50:
                # Excluir líneas que parecen encabezados genéricos
                text_lower = line['text'].lower()
                if not any(word in text_lower for word in ['albarán', 'factura', 'receipt', 'invoice']):
                    return line['text'].strip()

        return None

    def _extract_document_number(self, raw_text: str) -> Optional[str]:
        """
        Extraer número de albarán del texto

        Args:
            raw_text: Texto completo

        Returns:
            Número de albarán o None
        """
        # Buscar patrones comunes de número de albarán
        patterns = [
            r'albarán\s*n[°:.\s]+([A-Z0-9-]+)',
            r'albaran\s*n[°:.\s]+([A-Z0-9-]+)',
            r'factura\s*n[°:.\s]+([A-Z0-9-]+)',
            r'invoice\s*n[°:.\s]+([A-Z0-9-]+)',
            r'n[°:.\s]+([A-Z0-9-]{5,})'  # Patrón genérico
        ]

        for pattern in patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None

    def _extract_document_date(self, raw_text: str) -> Optional[str]:
        """
        Extraer fecha del documento

        Args:
            raw_text: Texto completo

        Returns:
            Fecha o None
        """
        # Buscar patrones de fecha comunes
        patterns = [
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',  # DD/MM/YYYY o MM/DD/YYYY
            r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',  # YYYY/MM/DD
            r'(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})'  # DD de MONTH de YYYY
        ]

        import re
        from datetime import datetime

        for pattern in patterns:
            match = re.search(pattern, raw_text)
            if match:
                try:
                    # Intentar parsear la fecha
                    if 'de' in pattern:  # Formato con nombre de mes
                        day = match.group(1)
                        month_str = match.group(2)
                        year = match.group(3)

                        # Mapear nombres de meses en español
                        months = {
                            'enero': '1', 'febrero': '2', 'marzo': '3', 'abril': '4',
                            'mayo': '5', 'junio': '6', 'julio': '7', 'agosto': '8',
                            'septiembre': '9', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
                        }

                        month_num = months.get(month_str.lower(), '1')
                        date_str = f"{day}/{month_num}/{year}"
                    else:
                        date_str = match.group(0)

                    # Intentar parsear
                    for fmt in ['%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d']:
                        try:
                            return datetime.strptime(date_str, fmt)
                        except ValueError:
                            continue

                except Exception:
                    continue

        return None

    def _extract_products(self, raw_text: str, lines: list) -> list:
        """
        Extraer productos del texto con patrones mejorados

        Args:
            raw_text: Texto completo
            lines: Lista de líneas con confianza

        Returns:
            Lista de ExtractedProduct
        """
        products = []

        # Primero intentar formato multi-línea (muy común en albaranes)
        products.extend(self._extract_multiline_products(lines))

        # Si no encontramos suficientes productos, intentar patrones single-line
        if len(products) < 2:
            products.extend(self._extract_singleline_products(raw_text, lines))

        logger.info(f"Productos extraídos: {len(products)}")
        return products

    def _extract_multiline_products(self, lines: list) -> list:
        """
        Extraer productos en formato multi-línea (nombre, cantidad, unidad, precio en líneas consecutivas)

        Args:
            lines: Lista de líneas con confianza

        Returns:
            Lista de ExtractedProduct
        """
        products = []
        i = 0

        while i < len(lines) - 2:
            line = lines[i]
            text = line['text'].strip()

            # Ignorar líneas muy cortas o sin letras
            if len(text) < 2 or not any(c.isalpha() for c in text):
                i += 1
                continue

            # Ignorar líneas que parecen encabezados o totales
            text_lower = text.lower()
            skip_words = ['total', 'subtotal', 'iva', 'base', 'sumar', 'albarán', 'proveedor',
                         'fecha', 'número', 'factura', 'invoice', 'receipt', 'euros', '€', 'totales']
            if any(word in text_lower for word in skip_words):
                i += 1
                continue

            # Patrón 1: nombre, cantidad, unidad, precio (4 líneas)
            if i + 3 < len(lines):
                next_texts = [lines[i+1]['text'].strip(), lines[i+2]['text'].strip(), lines[i+3]['text'].strip()]

                try:
                    # Verificar: línea siguiente = número (cantidad) - aceptar "0" como válido
                    quantity_match = re.search(r'^([0O]\d*\.?\d*|\d+\.?\d*)', next_texts[0])
                    # línea siguiente + 1 = unidad válida
                    unit_match = re.search(r'^(kg|g|l|ml|ud|u|unidades?)$', next_texts[1], re.IGNORECASE)
                    # línea siguiente + 2 = número (precio) - aceptar "0" como válido
                    price_match = re.search(r'^([0O]\d*\.?\d*|\d+\.?\d*)', next_texts[2])

                    if quantity_match and price_match:
                        # Corregir OCR: "O" → "0"
                        quantity_str = quantity_match.group(1).replace('O', '0')
                        price_str = price_match.group(1).replace('O', '0')

                        quantity = float(quantity_str)
                        unit = unit_match.group(1).lower() if unit_match else 'ud'
                        price = float(price_str)

                        # Validar plausibilidad del producto
                        if (quantity >= 0 and price >= 0 and len(text) > 2 and
                            self._is_plausible_product(text, quantity, price)):

                            product = ExtractedProduct(
                                name=text,
                                quantity=quantity,
                                unit=unit,
                                unit_price=price,
                                total_price=quantity * price,
                                confidence=(line['confidence'] + lines[i+1]['confidence'] + lines[i+2]['confidence'] + lines[i+3]['confidence']) / 4
                            )
                            products.append(product)
                            logger.info(f"Multi-line (4): {text} | {quantity} {unit} | €{price:.2f}")
                            i += 4
                            continue
                        else:
                            logger.info(f"Multi-line (4) filtrado por plausibilidad: {text} | €{price:.2f}")
                            i += 4
                            continue
                except (ValueError, IndexError):
                    pass

            # Patrón 2: nombre+cantidad, unidad, precio (3 líneas)
            if i + 2 < len(lines):
                next_texts = [lines[i+1]['text'].strip(), lines[i+2]['text'].strip()]

                try:
                    # Verificar si línea actual tiene cantidad - aceptar "0" como válido
                    current_quantity_match = re.search(r'([0O]\d*\.?\d*|\d+\.?\d*)\s*(kg|g|l|ml|ud|u|unidades?)?$', text)
                    # línea siguiente = unidad
                    unit_match = re.search(r'^(kg|g|l|ml|ud|u|unidades?)$', next_texts[0], re.IGNORECASE)
                    # línea siguiente + 1 = precio - aceptar "0" como válido
                    price_match = re.search(r'^([0O]\d*\.?\d*|\d+\.?\d*)', next_texts[1])

                    if unit_match and price_match:
                        # Corregir OCR: "O" → "0"
                        quantity_str = current_quantity_match.group(1).replace('O', '0') if current_quantity_match else '1'
                        price_str = price_match.group(1).replace('O', '0')

                        quantity = float(quantity_str)
                        unit = unit_match.group(1).lower()
                        price = float(price_str)

                        # Extraer nombre (texto antes de la cantidad)
                        name = re.sub(r'[0O]\d*\.?\d*\s*(kg|g|l|ml|ud|u|unidades?)?$', '', text, flags=re.IGNORECASE).strip()

                        # Validar plausibilidad del producto
                        if (quantity >= 0 and price >= 0 and len(name) > 2 and
                            self._is_plausible_product(name, quantity, price)):

                            product = ExtractedProduct(
                                name=name,
                                quantity=quantity,
                                unit=unit,
                                unit_price=price,
                                total_price=quantity * price,
                                confidence=(line['confidence'] + lines[i+1]['confidence'] + lines[i+2]['confidence']) / 3
                            )
                            products.append(product)
                            logger.info(f"Multi-line (3): {name} | {quantity} {unit} | €{price:.2f}")
                            i += 3
                            continue
                        else:
                            logger.info(f"Multi-line (3) filtrado por plausibilidad: {name} | €{price:.2f}")
                            i += 3
                            continue
                except (ValueError, IndexError):
                    pass

            # Patrón 3: nombre, precio (2 líneas, cantidad=1 por defecto)
            if i + 1 < len(lines):
                next_text = lines[i+1]['text'].strip()

                try:
                    # Verificar si línea siguiente es un precio - aceptar "0" como válido
                    price_match = re.search(r'^([0O]\d*\.?\d*|\d+\.?\d*)', next_text)

                    if price_match and len(text) > 2:
                        # Corregir OCR: "O" → "0"
                        price_str = price_match.group(1).replace('O', '0')
                        price = float(price_str)

                        # Verificar que no sea un total o subtotal
                        if not re.search(r'(total|subtotal|base|sumar)', next_text, re.IGNORECASE):
                            # Validar plausibilidad del producto
                            if self._is_plausible_product(text, 1.0, price):
                                product = ExtractedProduct(
                                    name=text,
                                    quantity=1.0,
                                    unit='ud',
                                    unit_price=price,
                                    total_price=price,
                                    confidence=(line['confidence'] + lines[i+1]['confidence']) / 2
                                )
                                products.append(product)
                                logger.info(f"Multi-line (2): {text} | €{price:.2f}")
                                i += 2
                                continue
                            else:
                                logger.info(f"Multi-line (2) filtrado por plausibilidad: {text} | €{price:.2f}")
                                i += 2
                                continue
                except (ValueError, IndexError):
                    pass

            i += 1

        return products

    def _extract_singleline_products(self, raw_text: str, lines: list) -> list:
        """
        Extraer productos en formato single-line con patrones regex

        Args:
            raw_text: Texto completo
            lines: Lista de líneas con confianza

        Returns:
            Lista de ExtractedProduct
        """
        products = []

        # Patrones de producto mejorados para diferentes formatos de albaranes
        product_patterns = [
            # Formato: "Producto 10 ud 5.50" o "Producto 10 5.50"
            r'([^\d]+?)\s+(\d+\.?\d*)\s*(kg|g|l|ml|ud|u|unidades?)?\s+(\d+\.?\d*)',
            # Formato: "10 ud Producto 5.50"
            r'(\d+\.?\d*)\s*(kg|g|l|ml|ud|u|unidades?)?\s+([^\d]+?)\s+(\d+\.?\d*)',
            # Formato: "Producto x 5.50€"
            r'([^\d]+?)\s*[xX*]\s*(\d+\.?\d*)\s*€?',
            # Formato: "5.50€ Producto"
            r'(\d+\.?\d*)\s*€?\s+([^\d]+)',
            # Formato simple: "Producto 5.50"
            r'([^\d]+)\s+(\d+\.?\d*)'
        ]

        for i, line in enumerate(lines):
            text = line['text'].strip()

            # Ignorar líneas muy cortas o sin números
            if len(text) < 3 or not any(c.isdigit() for c in text):
                continue

            # Ignorar líneas que parecen encabezados o totales
            text_lower = text.lower()
            skip_words = ['total', 'subtotal', 'iva', 'base', 'sumar', 'albarán', 'proveedor',
                         'fecha', 'número', 'factura', 'invoice', 'receipt', 'euros', '€']
            if any(word in text_lower for word in skip_words):
                continue

            # Buscar patrón de producto
            for pattern in product_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    try:
                        # Determinar qué formato es basado en el número de grupos
                        groups = match.groups()

                        if len(groups) == 4 and pattern.startswith(r'([^\d]+?)'):  # "Producto 10 ud 5.50"
                            name = groups[0].strip()
                            quantity = float(groups[1])
                            unit = groups[2].strip() if groups[2] else 'ud'
                            price = float(groups[3])
                        elif len(groups) == 4:  # "10 ud Producto 5.50"
                            quantity = float(groups[0])
                            unit = groups[1].strip() if groups[1] else 'ud'
                            name = groups[2].strip()
                            price = float(groups[3])
                        elif len(groups) == 2 and pattern.startswith(r'([^\d]+?)'):  # "Producto x 5.50€"
                            name = groups[0].strip()
                            price = float(groups[1])
                            quantity = 1.0
                            unit = 'ud'
                        elif len(groups) == 2:  # "5.50€ Producto"
                            price = float(groups[0])
                            name = groups[1].strip()
                            quantity = 1.0
                            unit = 'ud'
                        else:  # "Producto 5.50"
                            name = groups[0].strip()
                            price = float(groups[1])
                            quantity = 1.0
                            unit = 'ud'

                        # Validar datos y plausibilidad
                        if quantity > 0 and price >= 0 and len(name) > 2 and self._is_plausible_product(name, quantity, price):
                            product = ExtractedProduct(
                                name=name,
                                quantity=quantity,
                                unit=unit.lower(),
                                unit_price=price,
                                total_price=quantity * price,
                                confidence=line['confidence']
                            )
                            products.append(product)
                            logger.info(f"Producto single-line detectado: {name} | {quantity} {unit} | €{price:.2f}")
                            break  # Usar primer patrón que coincida
                        else:
                            logger.info(f"Single-line filtrado por plausibilidad: {name} | €{price:.2f}")
                            break

                    except (ValueError, IndexError):
                        continue

        # Si no se encontraron productos con los patrones, intentar enfoque alternativo
        if not products:
            products = self._extract_products_fallback(raw_text, lines)

        return products

    def _extract_products_fallback(self, raw_text: str, lines: list) -> list:
        """
        Método alternativo para extraer productos cuando el patrón principal falla

        Args:
            raw_text: Texto completo (no usado en esta implementación)
            lines: Lista de líneas con confianza

        Returns:
            Lista de ExtractedProduct
        """
        products = []

        # Buscar líneas que parecen productos (texto + número + número)
        for line in lines:
            text = line['text'].strip()

            # Buscar al menos dos números en la línea
            numbers = re.findall(r'\d+\.?\d*', text)
            if len(numbers) >= 2:
                try:
                    # Primer número puede ser cantidad, segundo puede ser precio
                    quantity = float(numbers[0])
                    price = float(numbers[1])

                    # Extraer nombre (texto antes del primer número)
                    name_match = re.search(r'^([^\d]+)', text)
                    if name_match:
                        name = name_match.group(1).strip()

                        if quantity > 0 and price >= 0:
                            product = ExtractedProduct(
                                name=name,
                                quantity=quantity,
                                unit='ud',  # Por defecto
                                unit_price=price,
                                total_price=quantity * price,
                                confidence=line['confidence']
                            )
                            products.append(product)

                except (ValueError, IndexError):
                    continue

        return products

    def _extract_total_amount(self, raw_text: str, lines: list, products: list) -> float:
        """
        Extraer importe total del documento

        Args:
            raw_text: Texto completo
            lines: Lista de líneas con confianza
            products: Lista de productos extraídos

        Returns:
            Importe total
        """
        # Primero, buscar patrones de total explícitos
        total_patterns = [
            r'total[:\s]+(\d+\.?\d*)',
            r'importe\s*total[:\s]+(\d+\.?\d*)',
            r'suma\s*total[:\s]+(\d+\.?\d*)',
            r'total\s*a\s*pagar[:\s]+(\d+\.?\d*)'
        ]

        for pattern in total_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue

        # Si no se encuentra total explícito, calcular de productos
        if products:
            return sum(p.total_price for p in products)

        return 0.0

    def _is_plausible_product(self, name: str, quantity: float, price: float) -> bool:
        """
        Validar si un producto es plausible

        Args:
            name: Nombre del producto
            quantity: Cantidad
            price: Precio

        Returns:
            True si el producto parece plausible, False si es ruido
        """
        # Filtros de plausibilidad
        if not name or len(name) < 3:
            return False

        # Validar que el precio sea razonable
        if price > 10000:  # Precio > 10,000€ probablemente error
            logger.info(f"Producto filtrado: precio demasiado alto {price:.2f}€ para '{name}'")
            return False

        if price == 0 and quantity > 0:
            logger.info(f"Producto filtrado: precio 0 con cantidad > 0 para '{name}'")
            return False

        # Validar que la cantidad sea razonable
        if quantity > 10000:  # Cantidad > 10,000 probablemente error
            logger.info(f"Producto filtrado: cantidad demasiado alta {quantity} para '{name}'")
            return False

        # Filtrar URLs, emails y patrones obvios de no-productos
        url_patterns = [r'^https?://', r'^www\.', r'@', r'\.(com|es|net|org)$']
        for pattern in url_patterns:
            if re.search(pattern, name, re.IGNORECASE):
                logger.info(f"Producto filtrado: parece URL o email '{name}'")
                return False

        # Filtrar nombres que son solo números o caracteres especiales
        if re.match(r'^[\d\[\]\{\}\(\)\-\*]+$', name):
            logger.info(f"Producto filtrado: solo caracteres especiales '{name}'")
            return False

        return True