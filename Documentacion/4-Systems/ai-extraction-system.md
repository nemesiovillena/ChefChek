# Sistema de Extracción con IA

## Resumen

Sistema de extracción de datos de albaranes que combina OCR clásico (EasyOCR) con IA multimodal (OpenAI, Gemini, Anthropic) para obtener datos estructurados de alta calidad. El usuario elige el motor de extracción desde el frontend.

## Arquitectura

```
Frontend (selector modelo IA)
  │
  ├── Modelo: regex (gratis, sin IA)
  ├── Modelo: gpt-4o-mini (~0.01€/img)
  ├── Modelo: gemini-2.0-flash (~0.005€/img)
  ├── Modelo: gpt-4o (~0.05€/img)
  └── Modelo: claude-haiku-4-5 (~0.01€/img)
  │
  ▼
Backend NestJS (pasa ai_model + ai_api_key)
  │
  ▼
Python OCR Microservice (localhost:8000)
  │
  ├── 1. Pre-procesamiento (OpenCV)
  ├── 2. OCR (EasyOCR) → texto + bounding boxes + confianza
  ├── 3. Extracción estructurada
  │     ├── Si hay modelo IA → AI Extraction Service (imagen + texto OCR → JSON)
  │     └── Fallback → Regex (patrones multi-línea/single-línea)
  └── 4. Validación
  │
  ▼
Albaran creado en BD con líneas + supplier matching + line matching
```

## Componentes

### 1. AI Extraction Service (`ai-extraction-service.py`)

Servicio de extracción con IA multimodal. Recibe texto OCR + imagen en base64 y devuelve JSON estructurado.

**Providers soportados:**

| Modelo | Provider | Coste/img | Velocidad | Precisión |
|--------|----------|-----------|-----------|-----------|
| `gpt-4o-mini` | OpenAI | ~0.01€ | 2-4s | Buena |
| `gemini-2.0-flash` | Google | ~0.005€ | 1-3s | Buena |
| `gpt-4o` | OpenAI | ~0.05€ | 3-6s | Excelente |
| `claude-haiku-4-5-20251001` | Anthropic | ~0.01€ | 2-4s | Buena |

**Flujo:**
1. El OCR extrae texto y bounding boxes de la imagen
2. Se codifica la imagen original en base64 (calidad 85%)
3. Se envía al modelo IA: prompt + imagen + texto OCR como contexto
4. La IA devuelve JSON con: proveedor, CIF, número, fecha, productos, total
5. Si la IA falla o no devuelve productos → fallback a regex

**Prompt optimizado** para albaranes españoles:
- Distingue proveedor (emisor) de cliente (receptor)
- Filtra encabezados de tabla, totales, IVAs, URLs, pies de página
- Normaliza coma decimal española (0,88 → 0.88)
- Respuesta JSON con schema fijo

### 2. Document Processor (`document_processor.py`)

Orquesta todo el pipeline. Método clave: `_extract_structured_data()`

```python
def _extract_structured_data(self, ocr_results, ai_model=None, ai_api_key=None, image_base64=None):
    # 1. Si hay modelo IA + API key → intentar AI
    if ai_model and ai_api_key and image_base64:
        ai_result = AIExtractionService().extract(raw_text, image_base64, ai_model, ai_api_key)
        if ai_result and ai_result.get('products'):
            return self._build_document_from_ai(ai_result, ocr_results)
    
    # 2. Fallback: regex (método original)
    return self._extract_regex(ocr_results)
```

### 3. Backend NestJS — Pasa parámetros IA

**Cadena de parámetros:**
```
Controller (FormData: ai_model, ai_api_key)
  → AlbaranesService.createFromUpload(files, tenantId, aiModel, aiApiKey)
    → PythonOcrService.processImage(buffer, filename, mimetype, aiModel, aiApiKey)
      → FormData al microservicio Python (campos: ai_model, ai_api_key)
```

### 4. Frontend — Selector de Modelo

**Ubicación:** `/dashboard/ingestion`

- Grid de 5 botones con nombre + coste por imagen
- Campo de API key (type=password, sessionStorage)
- La API key **nunca** se persiste en el backend
- Badge del modelo activo durante el procesado
- Opción "Solo OCR" (regex) como default sin coste

## Gestión de API Keys

| Aspecto | Detalle |
|---------|---------|
| Almacenamiento | `sessionStorage` del navegador |
| Envío | En FormData con cada petición de upload |
| Persistencia backend | **No** — no se guarda en BD ni logs |
| Fallback | Si no hay API key → usa regex automáticamente |

## Formato de Datos

### Entrada al microservicio (FormData)

```
file: [imagen/PDF]
enable_preprocessing: true
enable_validation: true
ai_model: gpt-4o-mini (opcional)
ai_api_key: sk-... (opcional)
```

### Respuesta del microservicio

```json
{
  "success": true,
  "document": {
    "supplier_name": "Romeu",
    "cif_code": "B12345678",
    "document_number": "ALB-2024-001",
    "document_date": "2026-06-22",
    "products": [
      {
        "name": "PATATA AGRIA",
        "quantity": 50.0,
        "unit": "kg",
        "unit_price": 0.88,
        "total_price": 44.00,
        "confidence": 0.92
      }
    ],
    "total_amount": 164.00,
    "confidence": 0.89,
    "raw_text": "...",
    "cif_code": "B12345678",
    "nif_code": null,
    "tax_id_confidence": 0.95
  }
}
```

## Fallback Regex

Cuando no hay modelo IA o falla la extracción, se usa el sistema regex original:

- **Multi-línea**: detecta productos en 2-4 líneas consecutivas (nombre → cantidad → unidad → precio)
- **Single-línea**: 5 patrones regex para diferentes formatos de tabla
- **Fallback**: busca líneas con 2+ números como última opción
- **Proveedor**: busca patrones "Proveedor: X" o primera línea con alta confianza
- **Limitaciones conocidas**: confunde cliente con proveedor, parsea encabezados como productos, confianza baja (0.2-0.5) en albaranes reales

## Archivos del Sistema

| Archivo | Rol |
|---------|-----|
| `backend/ocr-microservice/app/services/ai-extraction-service.py` | Servicio IA multi-provider |
| `backend/ocr-microservice/app/services/document_processor.py` | Pipeline OCR + AI + fallback |
| `backend/ocr-microservice/app/services/ocr_service.py` | Motor OCR (EasyOCR) |
| `backend/ocr-microservice/app/services/image_preprocessing.py` | Pre-procesamiento OpenCV |
| `backend/ocr-microservice/app/services/validation_service.py` | Validación de resultados |
| `backend/ocr-microservice/app/services/cif_validator.py` | Extracción CIF/NIF |
| `backend/ocr-microservice/app/main.py` | Endpoints FastAPI |
| `backend/src/modules/ingesta/python-ocr.service.ts` | Cliente NestJS del microservicio |
| `backend/src/modules/albaranes/albaranes.service.ts` | Creación de albaranes desde OCR |
| `backend/src/modules/albaranes/albaranes.controller.ts` | Endpoint upload |
| `frontend/src/hooks/use-albaran-upload.ts` | Hook de upload con selector IA |
| `frontend/src/app/dashboard/ingestion/page.tsx` | UI selector modelo + API key |

## Dependencias

```
# Ya existían
openai>=1.3.7

# Nuevas para IA estructurada
google-generativeai>=0.7.0   # Gemini
anthropic>=0.40.0            # Claude
```

---

**Versión:** 2.0.0
**Última actualización:** 2026-06-23
**Estado:** ✅ Implementado (AI + regex fallback)
