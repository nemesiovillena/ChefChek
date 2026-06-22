---
title: "Phase 04: Tests Unitarios"
description: "Crear tests unitarios para GoogleVisionService, TesseractService y OcrAiService refactorizado"
status: pending
priority: P1
effort: 2h
tags: [testing, unit-tests, jest]
created: 2026-06-09
---

## Overview

Crear suite de tests unitarios para los nuevos servicios OCR y el servicio refactorizado.

## Requerimientos

### Funcionales
- Tests para GoogleVisionService
- Tests para TesseractService
- Tests para OcrAiService refactorizado
- Cobertura mínima: 80%

### No-Funcionales
- Tests rápidos (<5s total)
- Aislados (no dependen de APIs externas)
- Mocks adecuados para dependencias externas

## Architecture

```
Test Structure
├── google-vision.service.spec.ts
│   ├── extractText (success, error, retry)
│   ├── validateInput
│   └── handleOcrError
├── tesseract.service.spec.ts
│   ├── extractText (success, error)
│   └── handleOcrError
└── ocr-ai.service.spec.ts (actualizado)
    ├── extractText (primary, fallback)
    ├── processDocumentData
    └── parseExtractedProducts
```

## Files to Create

### backend/src/modules/ingesta/services/google-vision.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { GoogleVisionService } from './google-vision.service';

// Mock de Google Cloud Vision
jest.mock('@google-cloud/vision', () => ({
  ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
    annotateImage: jest.fn(),
  })),
}));

describe('GoogleVisionService', () => {
  let service: GoogleVisionService;
  let mockAnnotateImage: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleVisionService],
    }).compile();

    service = module.get<GoogleVisionService>(GoogleVisionService);

    // Obtener mock del método
    mockAnnotateImage = (
      (service as any).client as any
    ).annotateImage as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractText', () => {
    it('should extract text successfully from base64 image', async () => {
      const mockResult = [
        {
          fullTextAnnotation: {
            text: 'Sample invoice text',
            pages: [
              {
                blocks: [
                  { confidence: 0.95 },
                  { confidence: 0.90 },
                ],
              },
            ],
          },
        },
      ];

      mockAnnotateImage.mockResolvedValue(mockResult);

      const result = await service.extractText(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      );

      expect(result.text).toContain('Sample invoice text');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.provider).toBe('google-vision');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should throw BadRequestException for empty URL', async () => {
      await expect(service.extractText('')).rejects.toThrow(BadRequestException);
      await expect(service.extractText('   ')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid URL', async () => {
      await expect(service.extractText('not-a-url')).rejects.toThrow(BadRequestException);
    });

    it('should handle API errors with retry', async () => {
      mockAnnotateImage
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce([
          {
            fullTextAnnotation: { text: 'Success after retry', pages: [] },
          },
        ]);

      const result = await service.extractText(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      );

      expect(result.text).toContain('Success after retry');
      expect(mockAnnotateImage).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      mockAnnotateImage.mockRejectedValue(new Error('Persistent error'));

      await expect(
        service.extractText(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        )
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockAnnotateImage).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      process.env.GOOGLE_CLOUD_VISION_API_KEY = 'test-key';
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct provider information', () => {
      const info = service.getProviderInfo();

      expect(info.name).toBe('Google Cloud Vision');
      expect(info.features).toContain('TEXT_DETECTION');
      expect(info.features).toContain('DOCUMENT_TEXT_DETECTION');
    });
  });
});
```

### backend/src/modules/ingesta/services/tesseract.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { TesseractService } from './tesseract.service';

// Mock de Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
}));

describe('TesseractService', () => {
  let service: TesseractService;
  let mockCreateWorker: jest.Mock;
  let mockWorker: any;

  beforeEach(async () => {
    mockWorker = {
      setParameters: jest.fn(),
      recognize: jest.fn(),
      terminate: jest.fn(),
    };

    mockCreateWorker = require('tesseract.js').createWorker;
    mockCreateWorker.mockResolvedValue(mockWorker);

    const module: TestingModule = await Test.createTestingModule({
      providers: [TesseractService],
    }).compile();

    service = module.get<TesseractService>(TesseractService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractText', () => {
    it('should extract text successfully', async () => {
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Sample invoice text from Tesseract',
          confidence: 85.5,
        },
      });

      const result = await service.extractText('http://example.com/image.png');

      expect(result.text).toContain('Sample invoice text');
      expect(result.confidence).toBe(0.855);
      expect(result.provider).toBe('tesseract');
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty URL', async () => {
      await expect(service.extractText('')).rejects.toThrow(BadRequestException);
    });

    it('should terminate worker on error', async () => {
      mockWorker.recognize.mockRejectedValue(new Error('Processing failed'));

      await expect(
        service.extractText('http://example.com/image.png')
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should handle worker termination failure gracefully', async () => {
      mockWorker.recognize.mockRejectedValue(new Error('Processing failed'));
      mockWorker.terminate.mockRejectedValue(new Error('Terminate failed'));

      await expect(
        service.extractText('http://example.com/image.png')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('isConfigured', () => {
    it('should always return true', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct provider information', () => {
      const info = service.getProviderInfo();

      expect(info.name).toBe('Tesseract.js');
      expect(info.version).toBe('7.0.0');
      expect(info.configured).toBe(true);
      expect(info.features).toContain('TEXT_DETECTION');
    });
  });
});
```

### backend/src/modules/ingesta/ocr-ai.service.spec.ts (ACTUALIZADO)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OcrAiService } from './ocr-ai.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ProductRecognitionService } from './product-recognition.service';
import { IOcrService } from './services/ocr-service.interface';

describe('OcrAiService', () => {
  let service: OcrAiService;
  let mockPrisma: any;
  let mockProductRecognition: any;
  let mockPrimaryOcr: IOcrService;
  let mockFallbackOcr: IOcrService;

  beforeEach(async () => {
    mockPrisma = {
      product: {
        findFirst: jest.fn(),
      },
    };

    mockProductRecognition = {
      recognizeProduct: jest.fn(),
    };

    mockPrimaryOcr = {
      extractText: jest.fn(),
      isConfigured: jest.fn(),
      getProviderInfo: jest.fn(),
    };

    mockFallbackOcr = {
      extractText: jest.fn(),
      isConfigured: jest.fn(),
      getProviderInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrAiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductRecognitionService, useValue: mockProductRecognition },
        { provide: 'PRIMARY_OCR_SERVICE', useValue: mockPrimaryOcr },
        { provide: 'FALLBACK_OCR_SERVICE', useValue: mockFallbackOcr },
      ],
    }).compile();

    service = module.get<OcrAiService>(OcrAiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractText', () => {
    it('should extract text using primary OCR service', async () => {
      mockPrimaryOcr.extractText.mockResolvedValue({
        text: 'Sample text',
        confidence: 0.9,
        provider: 'google-vision',
        processingTime: 1000,
      });
      mockPrimaryOcr.getProviderInfo.mockReturnValue({
        name: 'Google Cloud Vision',
        version: '4.3.2',
        configured: true,
        features: [],
      });

      const result = await service.extractText('http://example.com/doc.pdf');

      expect(result.text).toBe('Sample text');
      expect(result.confidence).toBe(0.9);
      expect(mockPrimaryOcr.extractText).toHaveBeenCalledTimes(1);
      expect(mockFallbackOcr.extractText).not.toHaveBeenCalled();
    });

    it('should use fallback OCR when primary fails', async () => {
      mockPrimaryOcr.extractText.mockRejectedValue(new Error('Primary failed'));
      mockPrimaryOcr.getProviderInfo.mockReturnValue({
        name: 'Google Cloud Vision',
        version: '4.3.2',
        configured: true,
        features: [],
      });
      mockFallbackOcr.extractText.mockResolvedValue({
        text: 'Fallback text',
        confidence: 0.75,
        provider: 'tesseract',
        processingTime: 2000,
      });
      mockFallbackOcr.getProviderInfo.mockReturnValue({
        name: 'Tesseract',
        version: '7.0.0',
        configured: true,
        features: [],
      });

      const result = await service.extractText('http://example.com/doc.pdf');

      expect(result.text).toBe('Fallback text');
      expect(result.confidence).toBe(0.75);
      expect(mockPrimaryOcr.extractText).toHaveBeenCalledTimes(1);
      expect(mockFallbackOcr.extractText).toHaveBeenCalledTimes(1);
    });

    it('should throw error when both primary and fallback fail', async () => {
      mockPrimaryOcr.extractText.mockRejectedValue(new Error('Primary failed'));
      mockPrimaryOcr.getProviderInfo.mockReturnValue({
        name: 'Google Cloud Vision',
        version: '4.3.2',
        configured: true,
        features: [],
      });
      mockFallbackOcr.extractText.mockRejectedValue(new Error('Fallback failed'));
      mockFallbackOcr.getProviderInfo.mockReturnValue({
        name: 'Tesseract',
        version: '7.0.0',
        configured: true,
        features: [],
      });

      await expect(
        service.extractText('http://example.com/doc.pdf')
      ).rejects.toThrow('OCR processing failed');
    });
  });

  describe('processDocumentData', () => {
    it('should parse products from text', async () => {
      mockProductRecognition.recognizeProduct.mockResolvedValue({
        recognizedProduct: null,
        confidence: 0,
        suggestions: [],
      });

      const sampleText = `
      PRODUCTO 1
      Nombre: Tomate
      Cantidad: 50 kg
      Precio unitario: 2,50 €
      Categoría: Vegetales
      Alérgenos: Ninguno
      `;

      const result = await service.processDocumentData(sampleText, 'tenant-1');

      expect(result.extractedProducts).toHaveLength(1);
      expect(result.extractedProducts[0].name).toBe('Tomate');
      expect(result.extractedProducts[0].quantity).toBe(50);
      expect(result.extractedProducts[0].unitPrice).toBe(2.5);
      expect(result.metadata.processingMethod).toBeDefined();
    });

    it('should filter invalid products', async () => {
      mockProductRecognition.recognizeProduct.mockResolvedValue({
        recognizedProduct: null,
        confidence: 0,
        suggestions: [],
      });

      const invalidText = `
      PRODUCTO 1
      Nombre: AB
      Precio unitario: -5 €
      `;

      const result = await service.processDocumentData(invalidText, 'tenant-1');

      expect(result.extractedProducts).toHaveLength(0);
    });
  });

  describe('getOcrProviderInfo', () => {
    it('should return info for primary and fallback', () => {
      mockPrimaryOcr.getProviderInfo.mockReturnValue({
        name: 'Google Cloud Vision',
        version: '4.3.2',
        configured: true,
        features: [],
      });
      mockFallbackOcr.getProviderInfo.mockReturnValue({
        name: 'Tesseract',
        version: '7.0.0',
        configured: true,
        features: [],
      });

      const info = service.getOcrProviderInfo();

      expect(info.primary.name).toBe('Google Cloud Vision');
      expect(info.fallback.name).toBe('Tesseract');
    });
  });
});
```

## Implementation Steps

1. Crear `google-vision.service.spec.ts`
2. Crear `tesseract.service.spec.ts`
3. Actualizar `ocr-ai.service.spec.ts`
4. Ejecutar tests: `npm test -- services/google-vision.service.spec.ts`
5. Ejecutar tests: `npm test -- services/tesseract.service.spec.ts`
6. Ejecutar tests: `npm test -- ocr-ai.service.spec.ts`
7. Verificar cobertura: `npm run test:cov`

## Testing Strategy

### Test Matrix

| Servicio | Método | Casos de Prueba |
|----------|--------|-----------------|
| GoogleVision | extractText | success, error, retry, timeout, invalid input |
| GoogleVision | isConfigured | con/ sin API key |
| GoogleVision | getProviderInfo | retorna estructura correcta |
| Tesseract | extractText | success, error, worker cleanup |
| Tesseract | isConfigured | siempre true |
| Tesseract | getProviderInfo | retorna estructura correcta |
| OcrAiService | extractText | primary success, fallback success, both fail |
| OcrAiService | processDocumentData | valid products, invalid products |
| OcrAiService | getOcrProviderInfo | retorna estructura correcta |

## Success Criteria

- [ ] GoogleVisionService tests pasan
- [ ] TesseractService tests pasan
- [ ] OcrAiService tests pasan
- [ ] Cobertura ≥ 80%
- [ ] Tests ejecutan en <5s

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Mock de Tesseract.js falla | Verificar versión del mock |
| Tests lentos por HTTP mocks | Usar fetch-mock o similar |

## Next Steps

→ Fase 05: Tests de Integración y E2E