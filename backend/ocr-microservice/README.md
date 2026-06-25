# Microservicio OCR ChefChek

Microservicio Python para procesamiento de albaranes con PaddleOCR, OpenCV y validación inteligente.

## Características

- **OCR de Alta Precisión**: PaddleOCR con >90% de precisión en albaranes reales
- **Pre-procesamiento Avanzado**: Pipeline de 3 etapas con OpenCV
- **Validación Inteligente**: 4 capas de validación (estructural, confianza, semántica, reglas de negocio)
- **Auto-aprobado Inteligente**: Documentos de alta confianza se procesan automáticamente
- **API REST**: Endpoints simples para integración con NestJS

## Arquitectura

```
┌─────────────────┐
│   React UI      │
└────────┬────────┘
         │ HTTP
┌────────▼────────┐
│   NestJS        │
│   Backend       │
└────────┬────────┘
         │ HTTP
┌────────▼────────┐
│   FastAPI       │
│   OCR Service   │
│  ┌────────────┐ │
│  │Pre-process │ │
│  │   OpenCV   │ │
│  └─────┬──────┘ │
│  ┌─────▼──────┐ │
│  │   OCR      │ │
│  │ PaddleOCR  │ │
│  └─────┬──────┘ │
│  ┌─────▼──────┐ │
│  │ Validation │ │
│  └────────────┘ │
└─────────────────┘
```

## Instalación

### Requisitos Previos

- Python 3.9+
- Poppler (para conversión PDF a imagen)
  - macOS: `brew install poppler`
  - Ubuntu: `sudo apt-get install poppler-utils`

### Configuración del Entorno

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar archivo de configuración
cp .env.example .env

# Editar .env según necesidades
nano .env
```

## Ejecución

### Modo Desarrollo

```bash
# Desde el directorio backend/ocr-microservice
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Modo Producción

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Health Check

```bash
GET /health
```

Verifica que el servicio esté funcionando correctamente.

### Procesar Imagen

```bash
POST /ocr/image
Content-Type: multipart/form-data

file: <imagen>
language: es (opcional)
enable_preprocessing: true (opcional)
enable_validation: true (opcional)
confidence_threshold: 0.7 (opcional)
```

### Procesar PDF

```bash
POST /ocr/pdf
Content-Type: multipart/form-data

file: <pdf>
language: es (opcional)
enable_preprocessing: true (opcional)
enable_validation: true (opcional)
confidence_threshold: 0.7 (opcional)
```

### Configuración

```bash
GET /config
```

Obtiene la configuración actual del servicio.

## Respuesta API

### Éxito

```json
{
  "success": true,
  "document": {
    "supplier_name": "Proveedor Ejemplo",
    "document_number": "ALB-2024-001",
    "document_date": "2024-06-15T00:00:00",
    "products": [
      {
        "name": "Producto 1",
        "quantity": 10.0,
        "unit": "kg",
        "unit_price": 5.50,
        "total_price": 55.0,
        "confidence": 0.92
      }
    ],
    "total_amount": 55.0,
    "confidence": 0.89,
    "processing_time": 2.34,
    "raw_text": "Texto completo extraído..."
  },
  "validation": {
    "is_valid": true,
    "confidence_level": "high",
    "structural_validation": {...},
    "confidence_validation": {...},
    "semantic_validation": {...},
    "business_validation": {...},
    "warnings": [],
    "errors": [],
    "recommended_action": "auto_approve"
  },
  "processing_time": 3.45,
  "error_message": null,
  "metadata": {
    "file_name": "albaran.pdf",
    "file_type": "pdf",
    "preprocessing_applied": true,
    "validation_applied": true
  }
}
```

### Error

```json
{
  "success": false,
  "document": null,
  "validation": null,
  "processing_time": 0.5,
  "error_message": "Descripción del error",
  "metadata": {}
}
```

## Validación

### Niveles de Confianza

- **HIGH (≥90%)**: Auto-aprobado, sin revisión manual
- **MEDIUM (70-90%)**: Requiere revisión manual
- **LOW (<70%)**: Escalado a administrador

### Acciones Recomendadas

- **auto_approve**: Procesar automáticamente
- **review**: Requiere revisión del usuario
- **manual**: Procesamiento manual completo

## Testing

### Ejecutar Tests

```bash
# Instalar dependencias de testing
pip install pytest pytest-asyncio httpx

# Ejecutar tests
pytest tests/
```

### Testing Manual

```bash
# Health check
curl http://localhost:8000/health

# Procesar imagen
curl -X POST "http://localhost:8000/ocr/image" \
  -F "file=@test_image.jpg" \
  -F "language=es" \
  -F "enable_preprocessing=true" \
  -F "enable_validation=true"
```

## Docker

### Construir Imagen

```bash
docker build -t chefchek-ocr-service:latest .
```

### Ejecutar Contenedor

```bash
docker run -p 8000:8000 \
  -e OCR_LANGUAGE=es \
  -e OCR_USE_GPU=False \
  chefchek-ocr-service:latest
```

### Docker Compose

```bash
docker-compose up -d
```

## Monitoreo

### Logs

```bash
# Ver logs en tiempo real
tail -f logs/ocr_service.log
```

### Métricas

El servicio expone métricas básicas:
- Tiempo de procesamiento
- Precisión de OCR
- Tasa de errores
- Uso de memoria

## Troubleshooting

### Error: "poppler not found"

Instalar Poppler:
- macOS: `brew install poppler`
- Ubuntu: `sudo apt-get install poppler-utils`

### Error: "CUDA out of memory"

Desactivar GPU en `.env`:
```
OCR_USE_GPU=False
```

### Precisión Baja

1. Verificar calidad de imagen de entrada
2. Ajustar umbral de confianza en `.env`
3. Revisar logs para errores específicos

## Próximos Pasos

- [ ] Fase 2: Integración LLM para extracción avanzada
- [ ] Fase 3: Integración con NestJS y Redis
- [ ] Fase 4: UI mejorada con auto-aprobado
- [ ] Eliminar Tesseract.js después de validación

## Soporte

Para problemas o preguntas, contactar al equipo de desarrollo.

## Licencia

Proprietary - ChefChek