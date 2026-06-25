"""
Configuración del microservicio OCR
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Configuración de la aplicación"""

    # Configuración del servidor
    app_name: str = "ChefChek OCR Microservice"
    app_version: str = "1.0.0"
    debug: bool = True

    # Configuración del servidor
    host: str = "0.0.0.0"
    port: int = 8000

    # Configuración de OCR
    ocr_language: str = "es"  # Español por defecto
    ocr_use_gpu: bool = False
    ocr_confidence_threshold: float = 0.7
    ocr_engine: str = "easyocr"  # easyocr, paddleocr, tesseract

    # Configuración de procesamiento de imágenes
    image_dpi: int = 300
    image_max_size: int = 10 * 1024 * 1024  # 10MB
    image_allowed_formats: str = "jpg,jpeg,png,pdf,heic"

    # Configuración de LLM
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.3

    # Configuración de Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_queue_name: str = "ocr_jobs"

    # Configuración de logging
    log_level: str = "INFO"
    log_file: str = "logs/ocr_service.log"

    # Configuración del entorno virtual
    venv_path: str = "python_env"  # Nombre del entorno virtual

    # Configuración de base de datos de proveedores
    database_url: str = "postgresql://localhost:5432/chefchek"
    suppliers_db_pool_min: int = 1
    suppliers_db_pool_max: int = 10
    suppliers_db_timeout: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = False


# Instancia global de configuración
settings = Settings()