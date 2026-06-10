---
title: "Phase 03: Integración en OcrAiService"
description: "Refactorizar OcrAiService para usar inyección de dependencias de proveedores OCR"
status: pending
priority: P1
effort: 1h
tags: [refactoring, integration, dependency-injection]
created: 2026-06-09
---

## Overview

Finalizar la refactorización de `OcrAiService` para usar el sistema de inyección de dependencias con proveedores OCR configurables.

## Requerimientos

### Funcionales
- Eliminar dependencia directa de Tesseract
- Usar inyección de dependencias
- Mantener API existente (`extractText`, `processDocumentData`)
- Eliminar completamente código mock

### No-Funcionales
- Aislamiento de responsabilidades
- Fácil cambiar proveedor
- Fácil testear

## Architecture

```
OcrAiService (refactorizado)
├── extractText(fileUrl)
│   └── Delega a IOcrService (inyectado)
├── processDocumentData(text, tenantId)
│   ├── parseExtractedProducts()
│   ├── validateExtraction()
│   └── enhanceProductRecognition()
└── Constructor inyecta:
    ├── primaryOcrService: IOcrService
    └── fallbackOcrService?: IOcrService
```

## Files to Modify

### backend/src/modules/ingesta/ocr-ai.service.ts (REFAC. COMPLETA)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ProductRecognitionService } from './product-recognition.service';
import { ExtractedProductDto } from './dto/ingesta.dto';
import { IOcrService } from './services/ocr-service.interface';

@Injectable()
export class OcrAiService {
  private readonly logger = new Logger(OcrAiService.name);
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRecognitionService: ProductRecognitionService,
    @Inject('PRIMARY_OCR_SERVICE')
    private readonly primaryOcrService: IOcrService,
    @Inject('FALLBACK_OCR_SERVICE')
    private readonly fallbackOcrService?: IOcrService,
  ) {}

  /**
   * Extrae texto de un documento usando el proveedor OCR configurado
   * @param fileUrl - URL del archivo o base64
   * @returns Promesa con texto extraído y confianza
   */
  async extractText(
    fileUrl: string,
  ): Promise<{ text: string; confidence: number }> {
    const providerInfo = this.primaryOcrService.getProviderInfo();

    this.logger.log(
      `Extracting text from: ${fileUrl} using ${providerInfo.name}`
    );

    try {
      // Intentar con proveedor primario
      const result = await this.primaryOcrService.extractText(fileUrl);

      this.logger.log(
        `Extracted ${result.text.length} characters with confidence ${result.confidence} using ${result.provider}`
      );

      return {
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error: any) {
      this.logger.error(
        `Primary OCR failed (${providerInfo.name}): ${error.message}`
      );

      // Intentar con fallback si está disponible
      if (this.fallbackOcrService) {
        const fallbackInfo = this.fallbackOcrService.getProviderInfo();
        this.logger.log(`Attempting fallback OCR: ${fallbackInfo.name}`);

        try {
          const fallbackResult = await this.fallbackOcrService.extractText(fileUrl);

          this.logger.log(
            `Fallback OCR succeeded with ${fallbackResult.text.length} characters and confidence ${fallbackResult.confidence}`
          );

          return {
            text: fallbackResult.text,
            confidence: fallbackResult.confidence,
          };
        } catch (fallbackError: any) {
          this.logger.error(
            `Fallback OCR also failed (${fallbackInfo.name}): ${fallbackError.message}`
          );
        }
      }

      // No hay fallback o ambos fallaron
      throw new Error(
        `OCR processing failed: ${error.message}`
      );
    }
  }

  /**
   * Procesa los datos extraídos del documento para obtener productos estructurados
   * @param text - Texto extraído por OCR
   * @param tenantId - ID del tenant
   * @returns Promesa con productos extraídos y metadatos
   */
  async processDocumentData(
    text: string,
    tenantId: string,
  ): Promise<{
    extractedProducts: ExtractedProductDto[];
    metadata: Record<string, any>;
  }> {
    this.logger.log(`Processing document data for tenant: ${tenantId}`);

    try {
      const extractedProducts = this.parseExtractedProducts(text, tenantId);

      // Validar y mejorar productos
      const validProducts = [];
      for (const product of extractedProducts) {
        if (await this.validateExtraction(product)) {
          const enhanced = await this.enhanceProductRecognition(
            product,
            tenantId,
          );
          validProducts.push(enhanced);
        }
      }

      const metadata = {
        totalProducts: validProducts.length,
        documentDate: new Date().toISOString(),
        processingMethod: this.primaryOcrService.getProviderInfo().name,
      };

      return {
        extractedProducts: validProducts,
        metadata,
      };
    } catch (error: any) {
      this.logger.error(`Error processing document data: ${error.message}`);
      throw error;
    }
  }

  // ========== Métodos Privados ==========

  private parseExtractedProducts(
    text: string,
    tenantId: string,
  ): ExtractedProductDto[] {
    const products: ExtractedProductDto[] = [];
    const lines = text.split('\n');
    let currentProduct: Partial<ExtractedProductDto> | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('PRODUCTO')) {
        // Nuevo producto detectado
        if (currentProduct && currentProduct.name) {
          products.push(
            this.sanitizeProduct(currentProduct as ExtractedProductDto),
          );
        }
        currentProduct = {};
      } else if (trimmedLine.startsWith('Nombre:')) {
        currentProduct!.name = trimmedLine.replace('Nombre:', '').trim();
      } else if (trimmedLine.startsWith('Cantidad:')) {
        const quantityMatch = trimmedLine.match(
          /Cantidad:\s*([\d.,]+)\s*(\w+)/,
        );
        if (quantityMatch) {
          currentProduct!.quantity = parseFloat(quantityMatch[1]);
          currentProduct!.unit = quantityMatch[2];
        }
      } else if (trimmedLine.startsWith('Precio unitario:')) {
        const priceMatch = trimmedLine.match(
          /Precio unitario:\s*([\d.,]+)\s*€/,
        );
        if (priceMatch) {
          currentProduct!.unitPrice = parseFloat(priceMatch[1]);
        }
      } else if (trimmedLine.startsWith('Categoría:')) {
        currentProduct!.category = trimmedLine.replace('Categoría:', '').trim();
      } else if (trimmedLine.startsWith('Alérgenos:')) {
        const allergensText = trimmedLine.replace('Alérgenos:', '').trim();
        currentProduct!.allergens =
          allergensText !== 'Ninguno'
            ? allergensText.split(',').map((a) => a.trim().toUpperCase())
            : [];
      }
    }

    // Agregar último producto
    if (currentProduct && currentProduct.name) {
      products.push(
        this.sanitizeProduct(currentProduct as ExtractedProductDto),
      );
    }

    return products;
  }

  private sanitizeProduct(product: ExtractedProductDto): ExtractedProductDto {
    return {
      name: product.name || '',
      description: 'Producto importado automáticamente desde documento',
      quantity: product.quantity || 0,
      unit: product.unit || 'ud',
      unitPrice: product.unitPrice || 0,
      supplier: 'IMPORTADO',
      category: product.category || '',
      allergens: product.allergens || [],
      confidence: 0.85, // Default confidence from OCR
    };
  }

  private async enhanceProductRecognition(
    product: Partial<ExtractedProductDto>,
    tenantId: string,
  ) {
    this.logger.log(`Enhancing product recognition for: ${product.name}`);

    if (!product.name) {
      return product;
    }

    // Use ProductRecognitionService para matching mejorado
    const result = await this.productRecognitionService.recognizeProduct(
      product.name,
      tenantId,
    );

    if (result.recognizedProduct) {
      this.logger.log(
        `Product "${product.name}" recognized with confidence ${result.confidence}`
      );

      // Combinar producto reconocido con datos originales
      return {
        ...product,
        name: result.recognizedProduct.name,
        category: result.recognizedProduct.category || product.category,
        unit: result.recognizedProduct.unit || product.unit,
        confidence: result.confidence,
      };
    }

    if (result.suggestions.length > 0) {
      this.logger.log(
        `Product "${product.name}" has ${result.suggestions.length} suggestions`
      );
    }

    return product;
  }

  async validateExtraction(product: ExtractedProductDto): Promise<boolean> {
    // Validar que el producto tiene datos mínimos útiles
    return (
      !!product.name &&
      product.name.length > 2 &&
      product.unitPrice !== undefined &&
      product.unitPrice >= 0
    );
  }

  /**
   * Obtiene información del proveedor OCR actual
   */
  getOcrProviderInfo() {
    return {
      primary: this.primaryOcrService.getProviderInfo(),
      fallback: this.fallbackOcrService?.getProviderInfo() || null,
    };
  }
}
```

### backend/src/modules/ingesta/ingesta.module.ts (ACTUALIZADO)

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { IngestaService } from "./ingesta.service";
import { TelegramBotService } from "./telegram-bot.service";
import { OcrAiService } from "./ocr-ai.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { DocumentQueueProcessor } from "./document-queue.processor";
import { IngestaController } from "./ingesta.controller";
import { PrismaModule } from "../../common/services/prisma.module";
import { CoreModule } from "../core/core.module";
import { GoogleVisionService } from "./services/google-vision.service";
import { TesseractService } from "./services/tesseract.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "document-processing",
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        db: parseInt(process.env.REDIS_DB || "0"),
      },
    }),
    PrismaModule,
    CoreModule,
  ],
  controllers: [IngestaController],
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
        const useGoogleVision = googleVision.isConfigured();
        const selected = useGoogleVision ? googleVision : tesseract;
        return selected;
      },
      inject: [GoogleVisionService, TesseractService],
    },
    {
      provide: 'FALLBACK_OCR_SERVICE',
      useFactory: (googleVision: GoogleVisionService, tesseract: TesseractService) => {
        // Si Google Vision es primario, Tesseract es fallback
        // Si Tesseract es primario, no hay fallback (retorno null)
        return googleVision.isConfigured() ? tesseract : null;
      },
      inject: [GoogleVisionService, TesseractService],
    },
  ],
  exports: [
    IngestaService,
    TelegramBotService,
    OcrAiService,
    ProductRecognitionService,
  ],
})
export class IngestaModule {}
```

## Implementation Steps

1. Reemplazar completamente `ocr-ai.service.ts` con versión refactorizada
2. Actualizar `ingesta.module.ts` con providers de OCR
3. Verificar que no hay referencias a `generateMockText`
4. Compilar backend para verificar errores TypeScript

## Testing Strategy

### Unit Tests
- [ ] `OcrAiService.extractText` usa primary service
- [ ] `OcrAiService.extractText` usa fallback si primary falla
- [ ] `OcrAiService.processDocumentData` procesa correctamente
- [ ] `OcrAiService.getOcrProviderInfo` retorna info correcta

## Success Criteria

- [ ] OcrAiService refactorizado sin dependencias directas
- [ ] Inyección de dependencias configurada
- [ ] Build backend exitoso
- [ ] Compilación TypeScript sin errores
- [ ] Logging actualizado con nombres de proveedores

## Risk Assessment

| Riesgo | Mitigación |
|--------|------------|
| Cambio de API afecta otros módulos | Verificar usos de OcrAiService |
| Tests existentes fallan | Actualizar mocks en tests |

## Next Steps

→ Fase 04: Tests Unitarios