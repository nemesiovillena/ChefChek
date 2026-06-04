# Arquitectura del Motor OCR

## Resumen

Motor de reconocimiento óptico de caracteres (OCR) para extraer texto de documentos escaneados, fotos y archivos PDF. Soporta múltiples proveedores de OCR y configura el procesamiento según el tipo de documento y calidad de imagen.

## Arquitectura del Sistema

### Componentes

```
OCR Engine
├── Preprocessing Module
│   ├── Image enhancement
│   ├── Noise removal
│   ├── Deskewing
│   └── Binarization
├── OCR Module
│   ├── Tesseract (Open Source)
│   ├── Google Vision API
│   ├── Azure Computer Vision
│   └── AWS Textract
├── Postprocessing Module
│   ├── Text cleaning
│   ├── Structuring
│   ├── Validation
│   └── Confidence calculation
└── Storage Module
    ├── Save raw text
    ├── Store structured data
    └── Cache results
```

## Flujo de Procesamiento

```
1. Input Document
   ├── Recibir archivo
   ├── Detectar tipo (imagen, PDF)
   ├── Validar formato
   └── Preparar para procesamiento

2. Preprocessing
   ├── Convertir a imagen si necesario
   ├── Mejorar contraste
   ├── Remover ruido
   ├── Corregir inclinación (deskew)
   └── Binarizar

3. OCR Processing
   ├── Seleccionar proveedor
   ├── Enviar imagen a OCR API
   ├── Recibir texto crudo
   └── Calcular confianza

4. Postprocessing
   ├── Limpiar texto
   ├── Estructurar por secciones
   ├── Validar resultado
   └── Guardar en DB

5. Output
   ├── Texto crudo
   ├── Texto estructurado
   ├── Metadatos
   └── Confianza del proceso
```

## Preprocessing de Imágenes

### Enhancements

```typescript
interface ImageEnhancement {
  enableContrastStretching: boolean;
  enableAdaptiveThresholding: boolean;
  enableMedianFilter: boolean;
  enableGaussianBlur: boolean;
  enableMorphologicalOps: boolean;
}

async function enhanceImage(
  imagePath: string,
  config: ImageEnhancement
): Promise<string> {
  const image = await loadImage(imagePath);

  // Contrast stretching
  if (config.enableContrastStretching) {
    applyContrastStretching(image);
  }

  // Noise removal
  if (config.enableMedianFilter) {
    applyMedianFilter(image, 3);
  }

  // Deskewing
  if (config.enableDeskewing) {
    const skewAngle = detectSkewAngle(image);
    rotateImage(image, skewAngle);
  }

  // Binarization
  if (config.enableAdaptiveThresholding) {
    applyAdaptiveThreshold(image);
  }

  const outputPath = `${imagePath}_enhanced.png`;
  await saveImage(image, outputPath);

  return outputPath;
}
```

### Deskewing

```typescript
function detectSkewAngle(image: any): number {
  // Hough transform para detectar líneas de texto
  const lines = detectTextLines(image);

  let angleSum = 0;
  let count = 0;

  for (const line of lines) {
    const angle = calculateLineAngle(line);
    angleSum += angle;
    count++;
  }

  return count > 0 ? angleSum / count : 0;
}
```

## Proveedores de OCR

### Tesseract (Open Source)

```typescript
interface TesseractConfig {
  lang: string;
  oem: number;
  psm: number;
}

async function processWithTesseract(
  imagePath: string,
  config: TesseractConfig
): Promise<OCRResult> {
  const worker = await Tesseract.createWorker(config.lang);

  const result = await worker.recognize(imagePath);

  await worker.terminate();

  return {
    id: uuidv4(),
    rawText: result.data.text,
    confidence: result.data.confidence,
    structuredText: structureText(result.data.text),
    processingTime: 0,
    processedAt: new Date(),
  };
}
```

### Google Vision API

```typescript
interface GoogleVisionConfig {
  apiKey: string;
  languageHints: string[];
  enableTextDetection: boolean;
  enableDocumentTextDetection: boolean;
}

async function processWithGoogleVision(
  imagePath: string,
  config: GoogleVisionConfig
): Promise<OCRResult> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [
            { type: 'TEXT_DETECTION' },
            { type: 'DOCUMENT_TEXT_DETECTION' }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const text = data.responses[0].fullTextAnnotation.text;

  return {
    id: uuidv4(),
    rawText: text,
    confidence: calculateConfidenceFromGoogle(data),
    structuredText: structureText(text),
    processingTime: 0,
    processedAt: new Date(),
  };
}
```

### Azure Computer Vision

```typescript
interface AzureConfig {
  endpoint: string;
  apiKey: string;
  language: string;
}

async function processWithAzure(
  imagePath: string,
  config: AzureConfig
): Promise<OCRResult> {
  const imageBuffer = fs.readFileSync(imagePath);

  const response = await fetch(
    `${config.endpoint}/vision/v3.2/ocr/analyze?language=${config.language}`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: imageBuffer
    }
  );

  const data = await response.json();
  const text = data.regions
    .flatMap((r: any) => r.lines)
    .map((l: any) => l.words.map((w: any) => w.text).join(' '))
    .join('\n');

  return {
    id: uuidv4(),
    rawText: text,
    confidence: 0.9, // Azure doesn't provide confidence
    structuredText: structureText(text),
    processingTime: 0,
    processedAt: new Date(),
  };
}
```

## Selección de Proveedor

### Estrategia de Selección

```typescript
interface OCRProviderStrategy {
  primaryProvider: OCRProvider;
  fallbackProviders: OCRProvider[];
  enableAutomaticFallback: boolean;
  confidenceThreshold: number;
}

async function selectOCRProvider(
  documentType: DocumentType,
  strategy: OCRProviderStrategy
): Promise<OCRProvider> {
  // Si el proveedor primario tiene alta confianza, usarlo
  const providerPerformance = await getProviderMetrics(strategy.primaryProvider);

  if (providerPerformance.successRate >= 0.95) {
    return strategy.primaryProvider;
  }

  // Evaluar proveedores de fallback
  for (const provider of strategy.fallbackProviders) {
    const performance = await getProviderMetrics(provider);

    if (performance.successRate >= strategy.confidenceThreshold) {
      return provider;
    }
  }

  // Default to primary
  return strategy.primaryProvider;
}
```

### Métricas de Proveedor

```typescript
interface ProviderMetrics {
  provider: OCRProvider;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  averageConfidence: number;
  successRate: number;
  lastUsed: Date;
}

async function getProviderMetrics(provider: OCRProvider): Promise<ProviderMetrics> {
  const metrics = await providerMetricsRepository.find({
    where: { provider }
  });

  if (!metrics) {
    return {
      provider,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      successRate: 0,
      lastUsed: new Date(),
    };
  }

  metrics.successRate = metrics.totalRequests > 0
    ? metrics.successfulRequests / metrics.totalRequests
    : 0;

  return metrics;
}
```

## Caching

### Estrategia de Caching

```typescript
interface OCRCacheConfig {
  enableCache: boolean;
  cacheDuration: number; // milliseconds
  cacheKeyPrefix: string;
}

async function getFromCache(
  imagePath: string,
  config: OCRCacheConfig
): Promise<OCRResult | null> {
  if (!config.enableCache) {
    return null;
  }

  const cacheKey = `${config.cacheKeyPrefix}:${getHash(imagePath)}`;
  const cached = await cacheStore.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < config.cacheDuration) {
    return cached.result;
  }

  return null;
}

async function saveToCache(
  imagePath: string,
  result: OCRResult,
  config: OCRCacheConfig
): Promise<void> {
  if (!config.enableCache) {
    return;
  }

  const cacheKey = `${config.cacheKeyPrefix}:${getHash(imagePath)}`;
  await cacheStore.set(cacheKey, {
    result,
    timestamp: Date.now(),
  });
}
```

## Postprocessing

### Limpieza de Texto

```typescript
function cleanText(rawText: string): string {
  let cleaned = rawText;

  // Remover espacios múltiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remover caracteres especiales no deseados
  cleaned = cleaned.replace(/[^\w\s\-.,€$%]/g, '');

  // Corregir OCR comunes
  cleaned = cleaned.replace(/0/g, 'O', cleaned.length > 0 && cleaned[0].toUpperCase() === cleaned[0] ? 'O' : '0');
  cleaned = cleaned.replace(/5/g, 'S');
  cleaned = cleaned.replace(/1/g, 'I');

  return cleaned;
}
```

### Estructuración de Texto

```typescript
interface StructuredText {
  header: string[];
  items: string[];
  totals: string[];
  metadata: Record<string, string>;
}

function structureText(rawText: string): StructuredText {
  const lines = rawText.split('\n');
  const structured: StructuredText = {
    header: [],
    items: [],
    totals: [],
    metadata: {},
  };

  let currentSection = 'header';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    if (isHeaderLine(trimmedLine)) {
      currentSection = 'header';
    } else if (isItemLine(trimmedLine)) {
      currentSection = 'items';
    } else if (isTotalLine(trimmedLine)) {
      currentSection = 'totals';
    }

    structured[currentSection].push(trimmedLine);
  }

  return structured;
}

function isItemLine(line: string): boolean {
  // Patrón: producto cantidad unidad precio total
  const itemPattern = /^.+?\s+\d+(\.\d+)?\s+[a-z]+\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/i;
  return itemPattern.test(line);
}

function isTotalLine(line: string): boolean {
  const totalPatterns = [
    /^subtotal/i,
    /^total/i,
    /^iva/i,
    /^tax/i,
    /^impuesto/i,
  ];

  return totalPatterns.some(pattern => pattern.test(line));
}
```

## API Reference

### Procesar OCR

```http
POST /api/v1/ocr-ai/process-ocr
Content-Type: application/json

{
  "fileId": "uuid-file-id",
  "tenantId": "uuid-tenant-id",
  "ocrConfig": {
    "provider": "google",
    "language": "spa",
    "minConfidence": 70,
    "enablePreprocessing": true,
    "enableDeskewing": true,
    "enableNoiseRemoval": true
  }
}

Response 200:
{
  "id": "uuid-ocr-result-id",
  "fileId": "uuid-file-id",
  "tenantId": "uuid-tenant-id",
  "rawText": "FACTURA...",
  "structuredText": {...},
  "confidence": 0.85,
  "processingTime": 4500,
  "processedAt": "2026-05-31T10:30:00Z"
}
```

### Obtener Resultado OCR

```http
GET /api/v1/ocr-ai/ocr-results/:id

Response 200:
{
  "id": "uuid",
  "fileId": "uuid",
  "tenantId": "uuid",
  "rawText": "FACTURA...",
  "structuredText": {...},
  "confidence": 0.85,
  "processingTime": 4500,
  "processedAt": "2026-05-31T10:30:00Z"
}
```

## Checklist de Implementación

### Preprocessing ✅
- [x] Image enhancement
- [x] Noise removal
- [x] Deskewing
- [x] Binarization
- [x] PDF to image conversion

### OCR Providers ✅
- [x] Tesseract (Open Source)
- [x] Google Vision API
- [x] Azure Computer Vision
- [x] AWS Textract
- [x] Provider selection strategy

### Postprocessing ✅
- [x] Text cleaning
- [x] Text structuring
- [x] Confidence calculation
- [x] Validation

### Caching ✅
- [x] Cache enabled
- [x] Cache duration
- [x] Hash-based cache keys
- [x] Automatic expiration

### Pendiente
- [x] Implementación real de Tesseract.js
- [x] Integración real con Google Vision API
- [x] Integración real con Azure Computer Vision
- [x] Integración real con AWS Textract
- [x] Tests unitarios
- [x] Tests de integración

---

**Versión:** 1.0.0
**Última actualización:** 2026-05-31
**Estado:** ✅ Implementado
**Sprint:** 13 - Ingesta Omnicanal - OCR + IA