---
title: "Phase 02: Implementación Google Vision Service"
description: "Crear servicio GoogleVisionService con soporte para TEXT_DETECTION y DOCUMENT_TEXT_DETECTION"
status: pending
priority: P1
effort: 2h
tags: [google-vision, ocr, service]
created: 2026-06-09
---

## Overview

Implementar el servicio `GoogleVisionService` que integra Google Cloud Vision API para extracción de texto de imágenes y documentos.

## Requerimientos

### Funcionales
- Extracción de texto de imágenes (TEXT_DETECTION)
- Extracción de texto de documentos (DOCUMENT_TEXT_DETECTION)
- Soporte para múltiples idiomas (español por defecto)
- Manejo de errores con retry
- Cálculo de confianza del resultado

### No-Funcionales
- Timeouts configurables
- Rate limiting respetado
- Logging detallado
- Validación de input

## Architecture

```
GoogleVisionService
├── extractText(fileUrl, options)
│   ├── validateInput()
│   ├── convertUrlToBase64()
│   ├── callGoogleVisionAPI()
│   ├── parseResult()
│   └── calculateConfidence()
├── isConfigured()
└── getProviderInfo()
```

## Files to Create

### backend/src/modules/ingesta/services/google-vision.service.ts

```typescript
import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { OCRResultDto, GoogleVisionOptions } from '../dto/google-vision.dto';

@Injectable()
export class GoogleVisionService {
  private readonly logger = new Logger(GoogleVisionService.name);
  private readonly client: ImageAnnotatorClient;
  private readonly DEFAULT_LANGUAGE = 'es';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor() {
    this.client = new ImageAnnotatorClient();
  }

  /**
   * Extrae texto de una imagen usando Google Vision API
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones de configuración
   * @returns Promesa con resultado de OCR
   */
  async extractText(
    fileUrl: string,
    options: GoogleVisionOptions = {}
  ): Promise<OCRResultDto> {
    const startTime = Date.now();

    try {
      // Validar input
      this.validateInput(fileUrl);

      // Configurar opciones por defecto
      const config = this.mergeOptions(options);

      // Obtener imagen (URL o base64)
      const image = await this.getImageSource(fileUrl);

      // Llamar a Google Vision API con retry
      const result = await this.callWithRetry(() =>
        this.performOcr(image, config)
      );

      // Calcular confidence
      const confidence = this.calculateConfidence(result);

      // Limpiar texto
      const cleanedText = this.cleanText(result.fullTextAnnotation.text);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `OCR completed in ${processingTime}ms with confidence ${confidence}`
      );

      return {
        text: cleanedText,
        confidence,
        provider: 'google-vision',
        processingTime,
        rawResult: this.sanitizeRawResult(result),
      };
    } catch (error) {
      this.logger.error(`OCR failed: ${error.message}`);
      throw this.handleOcrError(error);
    }
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return !!process.env.GOOGLE_CLOUD_VISION_API_KEY;
  }

  /**
   * Retorna información del proveedor
   */
  getProviderInfo() {
    return {
      name: 'Google Cloud Vision',
      version: '4.3.2',
      configured: this.isConfigured(),
      features: ['TEXT_DETECTION', 'DOCUMENT_TEXT_DETECTION'],
    };
  }

  // ========== Métodos Privados ==========

  private validateInput(fileUrl: string): void {
    if (!fileUrl || fileUrl.trim().length === 0) {
      throw new BadRequestException('File URL is required');
    }

    // Validar que sea URL válida o base64
    if (!this.isValidUrl(fileUrl) && !this.isBase64(fileUrl)) {
      throw new BadRequestException('Invalid file URL or base64 format');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isBase64(str: string): boolean {
    return /^data:image\/[a-z]+;base64,/.test(str) ||
           /^[A-Za-z0-9+/=]+$/.test(str) &&
           str.length % 4 === 0;
  }

  private mergeOptions(options: GoogleVisionOptions): Required<GoogleVisionOptions> {
    return {
      language: options.language || this.DEFAULT_LANGUAGE,
      enableDocumentTextDetection: options.enableDocumentTextDetection ?? true,
      enableTextDetection: options.enableTextDetection ?? true,
      minConfidence: options.minConfidence || 0.7,
    };
  }

  private async getImageSource(fileUrl: string): Promise<any> {
    if (this.isBase64(fileUrl)) {
      // Remover prefijo data:image/...;base64,
      const base64Data = fileUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      return { content: base64Data };
    }

    if (this.isValidUrl(fileUrl)) {
      // Para URLs remotas, descargar y convertir a base64
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      return { content: base64Data };
    }

    throw new Error('Invalid image source');
  }

  private async performOcr(
    image: any,
    config: Required<GoogleVisionOptions>
  ): Promise<any> {
    const features = [];

    if (config.enableDocumentTextDetection) {
      features.push({ type: 'DOCUMENT_TEXT_DETECTION' });
    } else if (config.enableTextDetection) {
      features.push({ type: 'TEXT_DETECTION' });
    }

    const request = {
      image,
      features,
      imageContext: {
        languageHints: [config.language],
      },
    };

    const [result] = await this.client.annotateImage(request);
    return result;
  }

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateConfidence(result: any): number {
    if (!result.fullTextAnnotation || !result.fullTextAnnotation.pages) {
      return 0;
    }

    let totalConfidence = 0;
    let symbolCount = 0;

    for (const page of result.fullTextAnnotation.pages) {
      for (const block of page.blocks) {
        if (block.confidence) {
          totalConfidence += block.confidence;
          symbolCount++;
        }
      }
    }

    return symbolCount > 0 ? totalConfidence / symbolCount : 0;
  }

  private cleanText(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remover espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Remover caracteres especiales no deseados (mantener: letras, números, espacios, puntuación básica)
    cleaned = cleaned.replace(/[^\w\s\-.,€$%¿?¡!@]/g, '');

    // Normalizar saltos de línea
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');

    return cleaned;
  }

  private sanitizeRawResult(result: any): any {
    // Remover datos sensibles o muy grandes del resultado raw
    return {
      textLength: result.fullTextAnnotation?.text?.length || 0,
      pageCount: result.fullTextAnnotation?.pages?.length || 0,
      // No incluir todo el texto raw para no sobrecargar
    };
  }

  private handleOcrError(error: any): Error {
    if (error.code === 7 || error.code === 16) {
      // Error de autenticación o permisos
      return new InternalServerErrorException(
        'Google Vision API authentication failed. Check API key configuration.'
      );
    }

    if (error.code === 429) {
      // Rate limit exceeded
      return new InternalServerErrorException(
        'Google Vision API rate limit exceeded. Please try again later.'
      );
    }

    return new InternalServerErrorException(
      `OCR processing failed: ${error.message}`
    );
  }
}
```

### backend/src/modules/ingesta/dto/google-vision.dto.ts

```typescript
import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

/**
 * Opciones para procesamiento con Google Vision
 */
export class GoogleVisionOptions {
  @IsString()
  @IsOptional()
  language?: string; // 'es', 'en', 'fr', etc.

  @IsBoolean()
  @IsOptional()
  enableDocumentTextDetection?: boolean; // Para documentos formateados

  @IsBoolean()
  @IsOptional()
  enableTextDetection?: boolean; // Para texto general

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  minConfidence?: number;
}

/**
 * Resultado de OCR estandarizado
 */
export class OCRResultDto {
  @IsString()
  text: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsString()
  provider: string;

  @IsNumber()
  processingTime: number;

  @IsOptional()
  rawResult?: any;
}
```

### backend/src/modules/ingesta/services/ocr-service.interface.ts

```typescript
import { GoogleVisionOptions, OCRResultDto } from '../dto/google-vision.dto';

/**
 * Interfaz para proveedores de OCR
 */
export interface IOcrService {
  /**
   * Extrae texto de una imagen
   * @param fileUrl - URL del archivo o base64
   * @param options - Opciones específicas del proveedor
   * @returns Promesa con resultado de OCR
   */
  extractText(
    fileUrl: string,
    options?: any
  ): Promise<OCRResultDto>;

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean;

  /**
   * Retorna información del proveedor
   */
  getProviderInfo(): {
    name: string;
    version: string;
    configured: boolean;
    features: string[];
  };
}
```

## Implementation Steps

1. Crear directorio `backend/src/modules/ingesta/services/`
2. Crear `google-vision.service.ts`
3. Crear `google-vision.dto.ts`
4. Crear `ocr-service.interface.ts`
5. Registrar servicio en `ingesta.module.ts`

## Testing Strategy

### Unit Tests
- [ ] `extractText` con URL válida
- [ ] `extractText` con base64
- [ ] `extractText` con input inválido
- [ ] `isConfigured` retorna boolean correcto
- [ ] Retry con errores transitorios

### Mocks
- Mock de `ImageAnnotatorClient` para tests
- Mock de `fetch` para URLs remotas

## Success Criteria

- [ ] GoogleVisionService implementa IOcrService
- [ ] Manejo de errores robusto
- [ ] Retry implementado con backoff exponencial
- [ ] Logging detallado
- [ ] Todos los tests unitarios pasan

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| API key no configurada en tests | Mock del servicio en tests |
| Timeout de API | Configurar timeout y retry |
| Formato de imagen no soportado | Validar antes de enviar |

## Next Steps

→ Fase 02b: Refactorización Tesseract como fallback