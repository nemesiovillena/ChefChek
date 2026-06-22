---
title: "Phase 02b: Refactorización Tesseract como Fallback"
description: "Extraer lógica de Tesseract de OcrAiService a TesseractService independiente"
status: pending
priority: P1
effort: 1h
tags: [tesseract, ocr, fallback, refactoring]
created: 2026-06-09
---

## Overview

Refactorizar la implementación actual de Tesseract.js en `OcrAiService` a un servicio independiente `TesseractService` que implemente `IOcrService`.

## Requerimientos

### Funcionales
- Mover lógica Tesseract a servicio independiente
- Implementar IOcrService
- Mantener compatibilidad con código existente
- Eliminar método mock `generateMockText`

### No-Funcionales
- Clean code (máx 200 líneas)
- Single responsibility
- Fácil testear

## Architecture

```
TesseractService (implementa IOcrService)
├── extractText(fileUrl, options)
│   ├── createWorker(language)
│   ├── recognize(image)
│   ├── parseResult()
│   └── terminate()
└── getProviderInfo()
```

## Files to Modify

### backend/src/modules/ingesta/services/tesseract.service.ts (NUEVO)

```typescript
import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import Tesseract from 'tesseract.js';
import { OCRResultDto } from '../dto/google-vision.dto';

interface TesseractOptions {
  language?: string;
  oem?: number;
  psm?: number;
}

@Injectable()
export class TesseractService implements IOcrService {
  private readonly logger = new Logger(TesseractService.name);
  private readonly DEFAULT_LANGUAGE = 'spa';
  private readonly DEFAULT_OEM = 3; // LSTM OEM
  private readonly DEFAULT_PSM = 6; // Assume uniform block of text

  /**
   * Extrae texto de una imagen usando Tesseract.js
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones específicas de Tesseract
   * @returns Promesa con resultado de OCR
   */
  async extractText(
    fileUrl: string,
    options: TesseractOptions = {}
  ): Promise<OCRResultDto> {
    const startTime = Date.now();
    let worker: any = null;

    try {
      // Validar input
      this.validateInput(fileUrl);

      // Configurar opciones por defecto
      const config = this.mergeOptions(options);

      this.logger.log(
        `Starting Tesseract OCR with language: ${config.language}`
      );

      // Crear worker
      worker = await Tesseract.createWorker(config.language, config.oem);

      // Configurar parámetros
      await worker.setParameters({
        tessedit_pageseg_mode: config.psm.toString(),
      });

      // Reconocer texto
      const { data } = await worker.recognize(fileUrl);

      // Terminar worker
      await worker.terminate();

      // Calcular confidence (convertir de 0-100 a 0-1)
      const confidence = data.confidence / 100;

      // Limpiar texto
      const cleanedText = this.cleanText(data.text);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Tesseract OCR completed in ${processingTime}ms with confidence ${confidence}`
      );

      return {
        text: cleanedText,
        confidence,
        provider: 'tesseract',
        processingTime,
      };
    } catch (error: any) {
      // Asegurar terminar worker en caso de error
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError) {
          this.logger.warn(`Failed to terminate worker: ${terminateError.message}`);
        }
      }

      this.logger.error(`Tesseract OCR failed: ${error.message}`);
      throw this.handleOcrError(error);
    }
  }

  /**
   * Verifica si el servicio está configurado correctamente
   * Tesseract.js siempre está disponible si el paquete está instalado
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Retorna información del proveedor
   */
  getProviderInfo() {
    return {
      name: 'Tesseract.js',
      version: '7.0.0',
      configured: true,
      features: ['TEXT_DETECTION'],
    };
  }

  // ========== Métodos Privados ==========

  private validateInput(fileUrl: string): void {
    if (!fileUrl || fileUrl.trim().length === 0) {
      throw new BadRequestException('File URL is required');
    }
  }

  private mergeOptions(options: TesseractOptions): Required<TesseractOptions> {
    return {
      language: options.language || this.DEFAULT_LANGUAGE,
      oem: options.oem ?? this.DEFAULT_OEM,
      psm: options.psm ?? this.DEFAULT_PSM,
    };
  }

  private cleanText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remover espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remover caracteres especiales no deseados
    cleaned = cleaned.replace(/[^\w\s\-.,€$%¿?¡!@]/g, '');

    // Normalizar saltos de línea
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');

    return cleaned;
  }

  private handleOcrError(error: any): Error {
    if (error.message.includes('buffer')) {
      return new BadRequestException('Invalid image format or corrupted image');
    }

    if (error.message.includes('language')) {
      return new InternalServerErrorException('Invalid language code for Tesseract');
    }

    return new InternalServerErrorException(
      `Tesseract OCR failed: ${error.message}`
    );
  }
}
```

## Files to Modify

### backend/src/modules/ingesta/ocr-ai.service.ts

**Cambios:**
1. Eliminar import de `Tesseract`
2. Eliminar método `generateMockText()`
3. Eliminar lógica de fallback a mock
4. Inyectar `IOcrService` en constructor

```typescript
// ANTES
import Tesseract from "tesseract.js";

@Injectable()
export class OcrAiService {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRecognitionService: ProductRecognitionService,
  ) {}

  async extractText(
    fileUrl: string,
  ): Promise<{ text: string; confidence: number }> {
    // ... implementación actual con Tesseract + fallback mock
  }

  private generateMockText(): string { /* ... */ }
}

// DESPUÉS
import { IOcrService } from "./services/ocr-service.interface";

@Injectable()
export class OcrAiService {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRecognitionService: ProductRecognitionService,
    @Inject('PRIMARY_OCR_SERVICE') private readonly ocrService: IOcrService,
    @Inject('FALLBACK_OCR_SERVICE') private readonly fallbackOcrService?: IOcrService,
  ) {}

  async extractText(
    fileUrl: string,
  ): Promise<{ text: string; confidence: number }> {
    try {
      const result = await this.ocrService.extractText(fileUrl);
      return {
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error) {
      this.logger.error(`Primary OCR failed: ${error.message}`);

      if (this.fallbackOcrService) {
        this.logger.log('Attempting fallback OCR service');
        try {
          const fallbackResult = await this.fallbackOcrService.extractText(fileUrl);
          return {
            text: fallbackResult.text,
            confidence: fallbackResult.confidence,
          };
        } catch (fallbackError) {
          this.logger.error(`Fallback OCR also failed: ${fallbackError.message}`);
        }
      }

      throw new InternalServerErrorException(
        `OCR processing failed: ${error.message}`
      );
    }
  }

  // generateMockText() ELIMINADO
}
```

### backend/src/modules/ingesta/ingesta.module.ts

```typescript
import { GoogleVisionService } from './services/google-vision.service';
import { TesseractService } from './services/tesseract.service';

@Module({
  imports: [...],
  providers: [
    IngestaService,
    TelegramBotService,
    OcrAiService,
    ProductRecognitionService,
    DocumentQueueProcessor,
    GoogleVisionService,
    TesseractService,
    {
      provide: 'PRIMARY_OCR_SERVICE',
      useFactory: (googleVision: GoogleVisionService, tesseract: TesseractService) => {
        // Usar Google Vision si está configurado, sino Tesseract
        return googleVision.isConfigured() ? googleVision : tesseract;
      },
      inject: [GoogleVisionService, TesseractService],
    },
    {
      provide: 'FALLBACK_OCR_SERVICE',
      useFactory: (googleVision: GoogleVisionService, tesseract: TesseractService) => {
        // Si Google Vision es primario, Tesseract es fallback
        // Si Tesseract es primario, no hay fallback
        return googleVision.isConfigured() ? tesseract : null;
      },
      inject: [GoogleVisionService, TesseractService],
    },
  ],
  exports: [...],
})
export class IngestaModule {}
```

## Implementation Steps

1. Crear `tesseract.service.ts` en `services/`
2. Eliminar import de Tesseract en `ocr-ai.service.ts`
3. Eliminar método `generateMockText()` de `ocr-ai.service.ts`
4. Actualizar constructor de `OcrAiService` para inyectar `IOcrService`
5. Actualizar `ingesta.module.ts` para registrar servicios
6. Verificar que no hay referencias a `generateMockText`

## Testing Strategy

### Unit Tests
- [ ] `TesseractService.extractText` con imagen válida
- [ ] `TesseractService.extractText` con imagen inválida
- [ ] `TesseractService.handleOcrError` lanza error correcto
- [ ] `OcrAiService` usa primary service
- [ ] `OcrAiService` usa fallback si primary falla

## Success Criteria

- [ ] TesseractService implementa IOcrService
- [ ] `generateMockText()` eliminado completamente
- [ ] Lógica de fallback sin mock
- [ ] Todos los tests pasan
- [ ] Build backend exitoso

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Código existente usa `generateMockText` | Buscar todas las referencias con grep |
| Worker no termina en error | Usar try-finally en extractText |

## Next Steps

→ Fase 03: Integración en OcrAiService