"""
Microservicio OCR ChefChek
Procesamiento de albaranes con PaddleOCR, OpenCV y validación inteligente
"""
__version__ = "1.0.0"

from .config import settings
from .models import (
    ExtractedDocument,
    ExtractedProduct,
    ValidationResult,
    OCRRequest,
    OCRResponse,
    HealthResponse
)

__all__ = [
    'settings',
    'ExtractedDocument',
    'ExtractedProduct',
    'ValidationResult',
    'OCRRequest',
    'OCRResponse',
    'HealthResponse'
]

# Note: FastAPI app is not imported here to avoid circular imports.
# Uvicorn should import directly from app.main:app