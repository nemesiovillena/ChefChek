"""
Modelos de datos para el microservicio OCR
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ProcessingStatus(str, Enum):
    """Estado del procesamiento de documentos"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ConfidenceLevel(str, Enum):
    """Nivel de confianza para auto-aprobado"""
    HIGH = "high"  # >= 90%
    MEDIUM = "medium"  # 70-90%
    LOW = "low"  # < 70%


class ExtractedProduct(BaseModel):
    """Producto extraído del albarán"""
    article_number: Optional[str] = Field(None, description="Código de artículo del proveedor")
    name: str = Field(..., description="Nombre del producto")
    description: Optional[str] = Field(None, description="Descripción adicional")
    lot: Optional[str] = Field(None, description="Número de lote")
    quantity: float = Field(default=1.0, description="Cantidad")
    unit: str = Field(default="ud", description="Unidad (kg, g, l, ml, ud)")
    unit_price: float = Field(default=0.0, description="Precio unitario sin IVA")
    vat_percent: Optional[float] = Field(None, description="Porcentaje de IVA")
    price_with_vat: Optional[float] = Field(None, description="Precio unitario con IVA")
    total_price: float = Field(default=0.0, description="Importe total del producto (sin IVA)")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confianza del OCR")

    @field_validator('unit')
    @classmethod
    def validate_unit(cls, v):
        """Validar que la unidad sea válida"""
        valid_units = ['kg', 'g', 'l', 'ml', 'ud']
        if v.lower() not in valid_units:
            raise ValueError(f'Unidad no válida: {v}. Debe ser una de {valid_units}')
        return v.lower()


class VatBreakdownItem(BaseModel):
    """Desglose de IVA por tipo"""
    rate: float = Field(..., description="Tipo de IVA (%)")
    base: float = Field(default=0.0, description="Base imponible para este tipo")
    amount: float = Field(default=0.0, description="Cuota de IVA para este tipo")


class ExtractedDocument(BaseModel):
    """Documento completo extraído"""
    # Datos del proveedor
    supplier_name: Optional[str] = Field(None, description="Nombre del proveedor")
    supplier_cif: Optional[str] = Field(None, description="CIF/NIF del proveedor")
    supplier_address: Optional[str] = Field(None, description="Dirección del proveedor")
    supplier_phone: Optional[str] = Field(None, description="Teléfono del proveedor")
    supplier_email: Optional[str] = Field(None, description="Correo del proveedor")
    supplier_sanitary_registry: Optional[str] = Field(None, description="Nº registro sanitario RGSA")
    # Datos del documento
    document_number: Optional[str] = Field(None, description="Número de albarán")
    document_date: Optional[datetime] = Field(None, description="Fecha del documento")
    products: List[ExtractedProduct] = Field(default_factory=list, description="Lista de productos")
    # Totales
    gross_amount: Optional[float] = Field(None, description="Total bruto (antes de IVA)")
    tax_base: Optional[float] = Field(None, description="Base imponible")
    vat_breakdown: Optional[List[VatBreakdownItem]] = Field(None, description="Desglose de IVA por tipo")
    vat_total: Optional[float] = Field(None, description="Total IVA")
    total_amount: float = Field(default=0.0, description="Total albarán (con IVA)")
    # Metadatos
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confianza global del documento")
    processing_time: float = Field(default=0.0, description="Tiempo de procesamiento en segundos")
    raw_text: Optional[str] = Field(None, description="Texto crudo extraído por OCR")
    # Legacy fields (mantenidos por compatibilidad con BD existente)
    cif_code: Optional[str] = Field(None, description="Código CIF extraído (legacy, usa supplier_cif)")
    nif_code: Optional[str] = Field(None, description="Código NIF extraído")
    tax_id_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confianza en CIF/NIF")
    supplier_id: Optional[str] = Field(None, description="ID del proveedor matcheado en BD")
    tenant_id: Optional[str] = Field(None, description="ID del tenant para multi-tenancy")


class ValidationResult(BaseModel):
    """Resultado de la validación del documento"""
    is_valid: bool = Field(..., description="Si el documento pasa todas las validaciones")
    confidence_level: ConfidenceLevel = Field(default=ConfidenceLevel.LOW, description="Nivel de confianza")
    structural_validation: Dict[str, Any] = Field(default_factory=dict, description="Validación estructural")
    confidence_validation: Dict[str, Any] = Field(default_factory=dict, description="Validación de confianza")
    semantic_validation: Dict[str, Any] = Field(default_factory=dict, description="Validación semántica")
    business_validation: Dict[str, Any] = Field(default_factory=dict, description="Validación de reglas de negocio")
    warnings: List[str] = Field(default_factory=list, description="Advertencias")
    errors: List[str] = Field(default_factory=list, description="Errores encontrados")
    recommended_action: str = Field(..., description="Acción recomendada (auto_approve, review, manual)")


class OCRRequest(BaseModel):
    """Solicitud de procesamiento OCR"""
    file_type: str = Field(..., description="Tipo de archivo (image, pdf)")
    language: str = Field(default="es", description="Idioma del documento")
    enable_preprocessing: bool = Field(default=True, description="Habilitar pre-procesamiento")
    enable_validation: bool = Field(default=True, description="Habilitar validación")
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Umbral de confianza")


class OCRRefineRequest(BaseModel):
    """Solicitud de refinamiento OCR con hints de proveedor"""
    ocr_text: str = Field(..., description="Texto OCR ya extraído")
    ai_model: Optional[str] = Field(None, description="Modelo IA a usar")
    ai_api_key: Optional[str] = Field(None, description="API key del provider IA")
    supplier_hints: Optional[Dict[str, Any]] = Field(None, description="Hints de layout del proveedor")


class OCRResponse(BaseModel):
    """Respuesta del procesamiento OCR"""
    success: bool = Field(..., description="Si el procesamiento fue exitoso")
    document: Optional[ExtractedDocument] = Field(None, description="Documento extraído")
    validation: Optional[ValidationResult] = Field(None, description="Resultado de validación")
    processing_time: float = Field(..., description="Tiempo total de procesamiento")
    error_message: Optional[str] = Field(None, description="Mensaje de error si falló")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadatos adicionales")


class HealthResponse(BaseModel):
    """Respuesta de health check"""
    status: str = Field(..., description="Estado del servicio")
    version: str = Field(..., description="Versión del servicio")
    uptime: float = Field(..., description="Tiempo de actividad en segundos")
    dependencies: Dict[str, str] = Field(default_factory=dict, description="Estado de dependencias")