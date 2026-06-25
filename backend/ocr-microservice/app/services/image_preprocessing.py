"""
Servicio de pre-procesamiento de imágenes con OpenCV
Pipeline simplificado y robusto
"""
import cv2
import numpy as np
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """Servicio de pre-procesamiento de imágenes"""

    def __init__(self, dpi: int = 300):
        """
        Inicializar el pre-procesador de imágenes

        Args:
            dpi: DPI para conversión de PDF a imagen
        """
        self.dpi = dpi

    def preprocess_image(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """
        Pre-procesar imagen numpy array (mejorado para documentos tabulares)

        Args:
            image: Imagen en formato numpy array (BGR o RGB)

        Returns:
            Tuple: (imagen procesada, metadatos del pre-procesamiento)
        """
        metadata = {
            'preprocessing_steps': [],
            'rotation_applied': 0,
            'enhancements_applied': []
        }

        if image is None or image.size == 0:
            raise ValueError("Imagen vacía o nula")

        metadata['original_size'] = image.shape[:2]
        logger.info(f"Imagen recibida: {metadata['original_size']}")

        try:
            # 1. Escala de grises
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            metadata['preprocessing_steps'].append('grayscale_conversion')

            # 2. Mejorar contraste para tablas
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            metadata['enhancements_applied'].append('clahe')

            # 3. Detectar y eliminar líneas verticales de tablas para evitar mezcla de columnas
            enhanced = self._remove_vertical_lines(enhanced, metadata)

            # 4. Dilatación ligera para separar palabras adyacentes (ayuda con columnas)
            kernel = np.ones((2, 2), np.uint8)
            enhanced = cv2.dilate(enhanced, kernel, iterations=1)
            metadata['preprocessing_steps'].append('dilation')

            # 5. Binarización con umbral adaptativo para mejor separación
            binary = cv2.adaptiveThreshold(
                enhanced, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY,
                31,  # tamaño del bloque (mayor para documentos complejos)
                10    # constante de sustracción
            )
            metadata['preprocessing_steps'].append('adaptive_binarization')

            logger.info("Pre-procesamiento completado exitosamente")
            return binary, metadata

        except Exception as e:
            logger.warning(f"Pre-procesamiento avanzado falló: {str(e)}, usando método simple")
            # Fallback a método simple
            try:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                metadata['preprocessing_steps'].append('simple_fallback')
                return binary, metadata
            except Exception as e2:
                logger.error(f"Fallback también falló: {str(e2)}")
                raise

    def _remove_vertical_lines(self, image: np.ndarray, metadata: dict) -> np.ndarray:
        """
        Eliminar líneas verticales de tablas para evitar mezcla de columnas

        Args:
            image: Imagen en escala de grises
            metadata: Metadatos del pre-procesamiento

        Returns:
            Imagen sin líneas verticales
        """
        try:
            # Detectar líneas verticales usando HoughLines
            edges = cv2.Canny(image, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100,
                                    minLineLength=100, maxLineGap=10)

            if lines is not None and len(lines) > 0:
                # Crear máscara para líneas verticales
                mask = np.zeros_like(image)

                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    # Solo considerar líneas casi verticales (ángulo ~90°)
                    if x2 != x1:
                        angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
                        if 70 < angle < 110:  # líneas verticales
                            cv2.line(mask, (x1, y1), (x2, y2), 255, 2)

                # Dilatar la máscara y eliminar líneas verticales
                kernel = np.ones((5, 5), np.uint8)
                mask_dilated = cv2.dilate(mask, kernel, iterations=1)
                result = cv2.inpaint(image, mask_dilated, 3, cv2.INPAINT_NS)
                metadata['enhancements_applied'].append('vertical_lines_removed')
                logger.info(f"Eliminadas {len(lines)} líneas verticales de tabla")
                return result

            return image

        except Exception as e:
            logger.warning(f"Error eliminando líneas verticales: {str(e)}")
            return image