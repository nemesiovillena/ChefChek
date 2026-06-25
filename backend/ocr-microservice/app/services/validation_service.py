"""
Servicio de validación multi-capa para documentos OCR
Validación estructural, de confianza, semántica y de reglas de negocio
"""
import re
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from decimal import Decimal

from app.models import (
    ExtractedDocument,
    ExtractedProduct,
    ValidationResult,
    ConfidenceLevel
)

logger = logging.getLogger(__name__)


class ValidationService:
    """Servicio de validación de documentos"""

    def __init__(self, confidence_threshold: float = 0.7):
        """
        Inicializar servicio de validación

        Args:
            confidence_threshold: Umbral de confianza global
        """
        self.confidence_threshold = confidence_threshold

        # Patrones regex para validación
        self.patterns = {
            'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            'phone': r'^\+?[\d\s-]{10,}$',
            'date': r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$',
            'price': r'^\d+\.?\d{0,2}$',
            'quantity': r'^\d+\.?\d*$'
        }

        # Unidades válidas
        self.valid_units = ['kg', 'g', 'l', 'ml', 'ud']

    def validate_document(self, document: ExtractedDocument) -> ValidationResult:
        """
        Validación completa del documento (4 capas)

        Args:
            document: Documento extraído a validar

        Returns:
            ValidationResult con el estado y detalles de validación
        """
        # Capa 1: Validación estructural
        structural_results = self._validate_structural(document)

        # Capa 2: Validación de confianza
        confidence_results = self._validate_confidence(document)

        # Capa 3: Validación semántica
        semantic_results = self._validate_semantic(document)

        # Capa 4: Validación de reglas de negocio
        business_results = self._validate_business_rules(document)

        # Determinar nivel de confianza
        confidence_level = self._determine_confidence_level(
            document.confidence,
            structural_results,
            confidence_results
        )

        logger.info(f"Validación completa: Nivel={confidence_level}, "
                   f"Válido={confidence_level == ConfidenceLevel.HIGH}, "
                   f"Errores={len(structural_results['errors'])}, "
                   f"Advertencias={len(structural_results['warnings'])}")

        return ValidationResult(
            is_valid=(
                structural_results['is_valid'] and
                confidence_results['is_valid'] and
                semantic_results['is_valid']
            ),
            confidence_level=confidence_level,
            structural_validation=structural_results,
            confidence_validation=confidence_results,
            semantic_validation=semantic_results,
            business_validation=business_results,
            warnings=structural_results['warnings'] + confidence_results['warnings'] + semantic_results['warnings'],
            errors=structural_results['errors'] + confidence_results['errors'] + semantic_results['errors'],
            recommended_action=self._get_recommended_action(
                confidence_level,
                structural_results,
                confidence_results,
                semantic_results
            )
        )

    def _validate_structural(self, document: ExtractedDocument) -> Dict[str, Any]:
        """Capa 1: Validación estructural"""
        results = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'checks': {}
        }

        # Verificar que haya productos
        if not document.products:
            results['errors'].append("No se encontraron productos en el documento")
            results['is_valid'] = False
            results['checks']['has_products'] = False

        # Verificar formato de precios
        for i, product in enumerate(document.products):
            if product.unit_price < 0:
                results['errors'].append(f"Producto {i}: Precio negativo: {product.unit_price}")
                results['is_valid'] = False

            if product.quantity <= 0:
                results['errors'].append(f"Producto {i}: Cantidad no positiva: {product.quantity}")
                results['is_valid'] = False

        logger.info(f"Validación estructural: Válido={results['is_valid']}, "
                   f"Errores={len(results['errors'])}, Advertencias={len(results['warnings'])}")

        return results

    def _validate_confidence(self, document: ExtractedDocument) -> Dict[str, Any]:
        """Capa 2: Validación de confianza"""
        results = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'checks': {}
        }

        # Validar confianza global
        if document.confidence < self.confidence_threshold:
            results['errors'].append(
                f"Confianza baja: {document.confidence:.2%} < {self.confidence_threshold:.0%}"
            )
            results['is_valid'] = False
            results['checks']['global_confidence'] = {
                'value': document.confidence,
                'threshold': self.confidence_threshold,
                'valid': document.confidence >= self.confidence_threshold
            }

        # Validar confianza por producto
        product_confidences = []
        for i, product in enumerate(document.products):
            if product.confidence < 0.5:
                results['warnings'].append(f"Producto {i}: Confianza baja: {product.confidence:.2%}")

            if product.confidence < 0.3:
                results['warnings'].append(f"Producto {i}: Confianza muy baja: {product.confidence:.2%}")
                results['is_valid'] = False

            product_confidences.append(product.confidence)

        if product_confidences:
            avg_product_confidence = sum(product_confidences) / len(product_confidences)
            min_product_confidence = min(product_confidences)

            results['checks']['product_confidence'] = {
                'min': min_product_confidence,
                'avg': avg_product_confidence,
                'threshold': 0.5,
                'valid': avg_product_confidence >= 0.5
            }

            if avg_product_confidence < 0.5:
                results['warnings'].append(
                    f"Promedio de confianza baja: {avg_product_confidence:.2%}"
                )

        logger.info(f"Validación de confianza: Válido={results['is_valid']}, "
                   f"Errores={len(results['errors'])}, Advertencias={len(results['warnings'])}")

        return results

    def _validate_semantic(self, document: ExtractedDocument) -> Dict[str, Any]:
        """Capa 3: Validación semántica"""
        results = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'checks': {}
        }

        # Validar nombres de productos plausibles
        for i, product in enumerate(document.products):
            if len(product.name) < 3:
                results['errors'].append(f"Producto {i}: Nombre muy corto: '{product.name}'")
                results['is_valid'] = False
            elif len(product.name) > 200:
                results['warnings'].append(f"Producto {i}: Nombre inusualmente largo: {len(product.name)} chars")

            # Buscar patrones sospechosos (texto aleatorio)
            if self._is_random_text(product.name):
                results['warnings'].append(f"Producto {i}: Nombre parece texto aleatorio: '{product.name}'")

        # Validar rangos de precios
        unrealistic_prices = []
        for i, product in enumerate(document.products):
            if product.unit_price < 0:
                results['errors'].append(f"Producto {i}: Precio negativo: {product.unit_price}")
                results['is_valid'] = False
            elif product.unit_price > 10000:
                unrealistic_prices.append((i, product.unit_price))

        if unrealistic_prices:
            results['warnings'].append(
                f"Productos con precios sospechosamente altos: {[(i, price) for i, price in unrealistic_prices[:5]]}"
            )

        # Validar rangos de cantidades
        unrealistic_quantities = []
        for i, product in enumerate(document.products):
            if product.quantity <= 0:
                results['errors'].append(f"Producto {i}: Cantidad no positiva: {product.quantity}")
                results['is_valid'] = False
            elif product.quantity > 10000:
                unrealistic_quantities.append((i, product.quantity))

        if unrealistic_quantities:
            results['warnings'].append(
                f"Productos con cantidades sospechosamente altas: {[(i, qty) for i, qty in unrealistic_quantities[:5]]}"
            )

        logger.info(f"Validación semántica: Válido={results['is_valid']}, "
                   f"Errores={len(results['errors'])}, Advertencias={len(results['warnings'])}")

        return results

    def _validate_business_rules(self, document: ExtractedDocument) -> Dict[str, Any]:
        """Capa 4: Validación de reglas de negocio"""
        results = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'checks': {},
            'business_rules': {}
        }

        # Regla 1: Cambios de precio significativos
        # NOTA: Esta regla requeriría acceso a datos históricos
        # Por ahora, solo advertimos sobre precios extremos
        results['business_rules']['price_changes'] = {
            'status': 'skipped',
            'message': 'Price change validation requires historical data access',
            'requires_database': True
        }

        # Regla 2: Validación de proveedor (requiere BD - pendiente)
        results['business_rules']['supplier_validation'] = {
            'status': 'skipped',
            'message': 'Validación de proveedor requiere instalación de asyncpg'
        }

        # Regla 3: Validación de productos vs catálogo
        # NOTA: Esta validación requeriría acceso a base de datos de productos
        results['business_rules']['product_catalog'] = {
            'status': 'skipped',
            'message': 'Product catalog validation requires database access',
            'requires_database': True
        }

        logger.info(f"Validación de reglas de negocio: Válido={results['is_valid']}, "
                   f"Errores={len(results['errors'])}, Advertencias={len(results['warnings'])}")

        return results

    def _determine_confidence_level(self, document_confidence: float,
                                    structural_results: Dict,
                                    confidence_results: Dict) -> ConfidenceLevel:
        """Determinar nivel de confianza del documento"""
        # Si hay errores estructurales o de confianza, nivel bajo
        if not structural_results['is_valid'] or not confidence_results['is_valid']:
            return ConfidenceLevel.LOW

        # Si confianza global es alta y mínima de productos también, nivel alto
        min_product_confidence = confidence_results['checks'].get('product_confidence', {}).get('min', 0.0)

        if document_confidence >= 0.90 and min_product_confidence >= 0.85:
            return ConfidenceLevel.HIGH

        # Si confianza es media, nivel medio
        if document_confidence >= 0.70 and min_product_confidence >= 0.60:
            return ConfidenceLevel.MEDIUM

        # De lo contrario, nivel bajo
        return ConfidenceLevel.LOW

    def _is_random_text(self, text: str) -> bool:
        """
        Verificar si el texto parece texto aleatorio
        """
        # Caracteres comunes en texto aleatorio vs nombres de productos
        random_patterns = [
            '^[A-Za-z]{3,}$',  # Solo letras
            '^[A-Z]+$',  # Solo mayúsculas
            '^\d+$',  # Solo números
            '^[^a-z0-9]+$',  # Alfanumérico
        ]

        return any(re.match(pattern, text, re.IGNORECASE) for pattern in random_patterns)

    def _get_recommended_action(self,
                                confidence_level: ConfidenceLevel,
                                structural_results: Dict,
                                confidence_results: Dict,
                                semantic_results: Dict) -> str:
        """
        Determinar acción recomendada basada en validación

        Args:
            confidence_level: Nivel de confianza determinado
            structural_results: Resultados de validación estructural
            confidence_results: Resultados de validación de confianza
            semantic_results: Resultados de validación semántica

        Returns:
            "auto_approve", "review", o "manual"
        """
        # Si hay errores, requiere revisión manual
        total_errors = len(structural_results['errors']) + len(confidence_results['errors']) + len(semantic_results['errors'])
        if total_errors > 0:
            return "manual"

        # Si confianza es alta y pocos warnings, auto-aprobar
        total_warnings = len(structural_results['warnings']) + len(confidence_results['warnings']) + len(semantic_results['warnings'])
        if confidence_level == ConfidenceLevel.HIGH and total_warnings <= 2:
            return "auto_approve"

        # Si confianza media o hay varias advertencias, requiere revisión
        if confidence_level == ConfidenceLevel.MEDIUM or total_warnings > 2:
            return "review"

        # Por defecto, revisión manual
        return "manual"