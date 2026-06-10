# Architecture Diagram: OCR Implementation

## Current Architecture (BEFORE)

```
┌─────────────────────────────────────────────────────────────────┐
│                      DocumentQueueProcessor                       │
│                      (Bull Queue Consumer)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OcrAiService                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  extractText(fileUrl)                                   │   │
│  │  ├── Tesseract.js (direct dependency)                   │   │
│  │  │   └── createWorker()                                │   │
│  │  │       └── recognize()                               │   │
│  │  └── IF ERROR → generateMockText() ❌                  │   │
│  │         └── Returns fake invoice data                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  processDocumentData(text, tenantId)                    │   │
│  │  └── Parse → Validate → Enhance                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture (AFTER)

```
┌─────────────────────────────────────────────────────────────────┐
│                      DocumentQueueProcessor                       │
│                      (Bull Queue Consumer)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OcrAiService                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  extractText(fileUrl)                                   │   │
│  │  └── Delegates to IOcrService (injected)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  processDocumentData(text, tenantId)                    │   │
│  │  └── Parse → Validate → Enhance                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐
│ GoogleVisionService │     │  TesseractService   │
│   (implements       │     │   (implements       │
│    IOcrService)     │     │    IOcrService)     │
├─────────────────────┤     ├─────────────────────┤
│ • extractText()     │     │ • extractText()     │
│ • Retry logic       │     │ • Worker cleanup    │
│ • Error handling    │     │ • Error handling    │
│ • Confidence calc   │     │ • Confidence calc   │
├─────────────────────┤     ├─────────────────────┤
│ Dependencies:       │     │ Dependencies:       │
│ @google-cloud/vision│     │ tesseract.js        │
└─────────────────────┘     └─────────────────────┘
```

## Dependency Injection Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                        IngestaModule                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Providers:                                             │   │
│  │                                                          │   │
│  │  GoogleVisionService                                    │   │
│  │  TesseractService                                       │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐   │   │
│  │  │  'PRIMARY_OCR_SERVICE'                         │   │   │
│  │  │  useFactory: (googleVision, tesseract) => {    │   │   │
│  │  │    return googleVision.isConfigured()           │   │   │
│  │  │      ? googleVision                             │   │   │
│  │  │      : tesseract;                               │   │   │
│  │  │  }                                               │   │   │
│  │  └────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────┐   │   │
│  │  │  'FALLBACK_OCR_SERVICE'                        │   │   │
│  │  │  useFactory: (googleVision, tesseract) => {    │   │   │
│  │  │    return googleVision.isConfigured()           │   │   │
│  │  │      ? tesseract                                │   │   │
│  │  │      : null;                                    │   │   │
│  │  │  }                                               │   │   │
│  │  └────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  OcrAiService receives:                                          │
│  • @Inject('PRIMARY_OCR_SERVICE') IOcrService                    │
│  • @Inject('FALLBACK_OCR_SERVICE') IOcrService? (optional)      │
└─────────────────────────────────────────────────────────────────┘
```

## Flow with Fallback

```
┌─────────────────────────────────────────────────────────────────┐
│  OcrAiService.extractText(fileUrl)                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
              Try Primary OCR Service
                       │
           ┌───────────┴───────────┐
           │                       │
      SUCCESS                  FAILURE
           │                       │
           ▼                       ▼
   Return result         Is Fallback Available?
           │                       │
                                   ├─ YES ──▶ Try Fallback OCR Service
                                   │               │
                                   │         ┌─────┴─────┐
                                   │      SUCCESS     FAILURE
                                   │         │          │
                                   │         ▼          ▼
                                   │    Return result  Throw Error
                                   │
                                   └─ NO ──▶ Throw Error
```

## Environment Variables

```
┌─────────────────────────────────────────────────────────────────┐
│                    .env Configuration                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  # Google Cloud Vision API                                       │
│  GOOGLE_CLOUD_VISION_API_KEY=ai***                              │
│                                                                  │
│  # OCR Provider Configuration                                    │
│  OCR_PROVIDER=google    # google | tesseract                     │
│  OCR_MIN_CONFIDENCE=70  # Minimum confidence threshold (0-100)  │
│  OCR_ENABLE_FALLBACK=true                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
backend/src/modules/ingesta/
├── dto/
│   ├── ingesta.dto.ts              # Existing DTOs
│   └── google-vision.dto.ts        # NEW: OCR DTOs
├── services/
│   ├── google-vision.service.ts    # NEW: Google Vision Service
│   ├── tesseract.service.ts        # NEW: Tesseract Service
│   └── ocr-service.interface.ts    # NEW: OCR Interface
├── ocr-ai.service.ts               # REFACTORED: No direct Tesseract
├── ingesta.service.ts              # Unchanged
├── ingesta.controller.ts           # Unchanged
├── ingesta.module.ts               # UPDATED: New providers
├── ocr-ai.service.spec.ts          # UPDATED: New tests
├── google-vision.service.spec.ts   # NEW: Service tests
├── tesseract.service.spec.ts       # NEW: Service tests
└── ingesta.integration.spec.ts     # NEW: Integration tests

frontend/src/app/dashboard/ocr-ai/
└── page.tsx                        # EXISTS: Verify functionality

docs/
├── google-vision-setup.md          # NEW: Setup guide
└── ocr-engine-architecture.md      # UPDATED: Implementation status
```

## Test Coverage Map

```
┌─────────────────────────────────────────────────────────────────┐
│                       Test Coverage                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GoogleVisionService                                             │
│  ├── extractText (success, error, retry, timeout)               │
│  ├── validateInput                                               │
│  ├── isConfigured                                                │
│  └── getProviderInfo                                             │
│                                                                  │
│  TesseractService                                                │
│  ├── extractText (success, error, cleanup)                      │
│  ├── validateInput                                               │
│  ├── isConfigured                                                │
│  └── getProviderInfo                                             │
│                                                                  │
│  OcrAiService                                                    │
│  ├── extractText (primary, fallback, error)                     │
│  ├── processDocumentData (valid, invalid products)              │
│  └── getOcrProviderInfo                                          │
│                                                                  │
│  Integration Tests                                               │
│  ├── Document creation                                          │
│  ├── Document processing                                        │
│  ├── Extracted products CRUD                                     │
│  └── Document query with filters                                 │
│                                                                  │
│  E2E Tests (Frontend)                                            │
│  ├── Page rendering                                              │
│  ├── Step navigation                                             │
│  └── Configuration display                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Mermaid Diagram (for tools that support it)

```mermaid
graph TD
    A[DocumentQueueProcessor] --> B[OcrAiService]
    B --> C{IOcrService}
    C --> D[GoogleVisionService]
    C --> E[TesseractService]

    D --> F[@google-cloud/vision]
    E --> G[tesseract.js]

    B --> H[processDocumentData]
    H --> I[ProductRecognitionService]
    I --> J[PrismaService]

    K[IngestaModule] -.provides.-> C
    K -.provides.-> D
    K -.provides.-> E

    style D fill:#4285F4,color:#fff
    style E fill:#E67E22,color:#fff
    style H fill:#27AE60,color:#fff
```

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Direct Dependency | Tesseract.js | IOcrService interface |
| Error Handling | Generate mock data | Fallback to other provider |
| Provider Selection | Hardcoded | Configurable via DI |
| Testability | Difficult (tight coupling) | Easy (mockable interface) |
| Extensibility | Hard to add new providers | Easy (implement IOcrService) |
| Code Quality | Mixed responsibilities | Single responsibility |
| Mock Data | In production | Eliminated |

---

**Last updated:** 2026-06-09
**Plan:** 260609-1401-ocr-implementation