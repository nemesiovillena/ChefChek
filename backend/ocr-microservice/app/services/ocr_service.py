"""
Servicio OCR con EasyOCR
Reconocimiento de texto multiidioma con puntuación de confianza
"""
import numpy as np
import easyocr
import logging
from typing import List, Dict, Tuple, Optional
import time

logger = logging.getLogger(__name__)


class OCRService:
    """Servicio de OCR usando EasyOCR"""

    def __init__(self, language: str = "es", use_gpu: bool = False):
        """
        Inicializar servicio OCR

        Args:
            language: Idioma del documento (es, en, fr, etc.)
            use_gpu: Usar GPU para aceleración
        """
        self.language = language
        self.use_gpu = use_gpu
        self.ocr_reader = None
        self._initialize_ocr()

    def _initialize_ocr(self):
        """Inicializar lector EasyOCR"""
        try:
            # EasyOCR usa códigos de idioma diferentes
            lang_map = {
                'es': ['es', 'en'],  # Español + inglés
                'en': ['en'],
                'fr': ['fr'],
                'de': ['de'],
                'it': ['it']
            }

            languages = lang_map.get(self.language, ['es', 'en'])

            self.ocr_reader = easyocr.Reader(languages, gpu=self.use_gpu)
            logger.info(f"Motor EasyOCR inicializado (idiomas: {languages}, GPU: {self.use_gpu})")
        except Exception as e:
            logger.error(f"Error inicializando EasyOCR: {str(e)}")
            raise

    def process_image(self, image: np.ndarray) -> Dict:
        """
        Procesar imagen con OCR

        Args:
            image: Imagen numpy array (pre-procesada)

        Returns:
            Dict con resultados del OCR
        """
        start_time = time.time()

        try:
            # Ejecutar OCR
            # readtext devuelve: (bounding_boxes, text, confidence)
            results = self.ocr_reader.readtext(image)

            processing_time = time.time() - start_time

            # Procesar resultados
            ocr_data = self._parse_ocr_results(results)

            # Calcular métricas
            ocr_data['processing_time'] = processing_time
            ocr_data['language'] = self.language

            logger.info(f"OCR completado: {len(ocr_data['lines'])} líneas, "
                       f"confianza global: {ocr_data['confidence']:.2f}, "
                       f"tiempo: {processing_time:.2f}s")

            return ocr_data

        except Exception as e:
            logger.error(f"Error en procesamiento OCR: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'lines': [],
                'confidence': 0.0,
                'processing_time': time.time() - start_time
            }

    def _parse_ocr_results(self, results: list) -> Dict:
        """
        Parsear resultados crudos de EasyOCR

        Args:
            results: Resultados crudos de EasyOCR

        Returns:
            Dict con datos estructurados
        """
        if not results:
            return {
                'success': True,
                'lines': [],
                'confidence': 0.0,
                'raw_text': '',
                'bounding_boxes': []
            }

        lines_data = []
        total_confidence = 0.0
        raw_text_lines = []

        for result in results:
            if len(result) < 3:
                continue

            # Extraer datos del resultado
            bbox = result[0]  # Bounding box [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            text = result[1]   # Texto reconocido
            confidence = result[2]  # Confianza (0-1)

            # Guardar datos de la línea
            line_entry = {
                'text': text,
                'confidence': confidence,
                'bbox': bbox,
                'bbox_formatted': self._format_bbox(bbox)
            }

            lines_data.append(line_entry)
            total_confidence += confidence
            raw_text_lines.append(text)

        # Calcular confianza global
        global_confidence = total_confidence / len(lines_data) if lines_data else 0.0

        return {
            'success': True,
            'lines': lines_data,
            'confidence': global_confidence,
            'raw_text': '\n'.join(raw_text_lines),
            'bounding_boxes': [line['bbox_formatted'] for line in lines_data]
        }

    def _format_bbox(self, bbox: list) -> str:
        """
        Formatear bounding box para lectura humana

        Args:
            bbox: Coordenadas del bounding box [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]

        Returns:
            String formateado
        """
        points = [f"({int(x)}, {int(y)})" for x, y in bbox]
        return f"[{', '.join(points)}]"

    def extract_text_regions(self, image: np.ndarray,
                            confidence_threshold: float = 0.6) -> List[Dict]:
        """
        Extraer regiones de texto con confianza sobre umbral

        Args:
            image: Imagen a procesar
            confidence_threshold: Umbral de confianza mínimo

        Returns:
            Lista de regiones de texto
        """
        results = self.process_image(image)

        if not results['success']:
            return []

        # Filtrar por umbral de confianza
        high_confidence_lines = [
            line for line in results['lines']
            if line['confidence'] >= confidence_threshold
        ]

        logger.info(f"Regiones de alta confianza: {len(high_confidence_lines)}/{len(results['lines'])}")

        return high_confidence_lines

    def get_text_layout_analysis(self, image: np.ndarray) -> Dict:
        """
        Análisis de diseño del documento (tablas, encabezados, etc.)

        Args:
            image: Imagen a analizar

        Returns:
            Dict con análisis de diseño
        """
        results = self.process_image(image)

        if not results['success']:
            return {
                'layout_type': 'unknown',
                'has_tables': False,
                'has_headers': False,
                'line_count': 0
            }

        lines = results['lines']

        # Análisis simple basado en posición y contenido
        layout_info = {
            'layout_type': 'simple',
            'has_tables': False,
            'has_headers': False,
            'line_count': len(lines),
            'text_density': 0.0
        }

        if not lines:
            return layout_info

        # Detectar posibles tablas (líneas con columnas)
        table_indicators = 0
        for line in lines[:20]:  # Analizar primeras 20 líneas
            text = line['text']
            # Buscar patrones de tabla (múltiples espacios o tabuladores)
            if '  ' in text or '\t' in text:
                table_indicators += 1

        layout_info['has_tables'] = table_indicators > 5

        # Detectar encabezados (líneas al principio con texto corto)
        if len(lines) > 0:
            first_line = lines[0]
            if len(first_line['text']) < 50 and first_line['confidence'] > 0.8:
                layout_info['has_headers'] = True

        # Calcular densidad de texto
        total_chars = sum(len(line['text']) for line in lines)
        layout_info['text_density'] = total_chars / len(lines) if lines else 0.0

        # Determinar tipo de diseño
        if layout_info['has_tables']:
            layout_info['layout_type'] = 'tabular'
        elif layout_info['has_headers']:
            layout_info['layout_type'] = 'structured'

        logger.info(f"Análisis de diseño: {layout_info['layout_type']}, "
                   f"tablas: {layout_info['has_tables']}, "
                   f"encabezados: {layout_info['has_headers']}")

        return layout_info

    def benchmark_performance(self, test_image: np.ndarray,
                            iterations: int = 5) -> Dict:
        """
        Benchmark de rendimiento del OCR

        Args:
            test_image: Imagen de prueba
            iterations: Número de iteraciones

        Returns:
            Dict con métricas de rendimiento
        """
        processing_times = []

        logger.info(f"Iniciando benchmark ({iterations} iteraciones)")

        for i in range(iterations):
            start_time = time.time()
            results = self.process_image(test_image)
            end_time = time.time()

            processing_times.append(end_time - start_time)
            logger.info(f"Iteración {i+1}: {processing_times[-1]:.2f}s")

        # Calcular estadísticas
        avg_time = np.mean(processing_times)
        min_time = np.min(processing_times)
        max_time = np.max(processing_times)
        std_time = np.std(processing_times)

        benchmark_results = {
            'iterations': iterations,
            'avg_time': avg_time,
            'min_time': min_time,
            'max_time': max_time,
            'std_time': std_time,
            'throughput': 1.0 / avg_time if avg_time > 0 else 0.0
        }

        logger.info(f"Benchmark completado: Promedio={avg_time:.2f}s, "
                   f"Min={min_time:.2f}s, Max={max_time:.2f}s, "
                   f"Throughput={benchmark_results['throughput']:.2f} docs/s")

        return benchmark_results