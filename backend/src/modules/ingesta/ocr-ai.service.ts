import { Injectable, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { ProductRecognitionService } from "./product-recognition.service";
import { ExtractedProductDto } from "./dto/ingesta.dto";
import { IOcrService } from "./services/ocr-service.interface";

@Injectable()
export class OcrAiService {
  private readonly logger = new Logger(OcrAiService.name);
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRecognitionService: ProductRecognitionService,
    @Inject("PRIMARY_OCR_SERVICE")
    private readonly primaryOcrService: IOcrService,
    @Inject("FALLBACK_OCR_SERVICE")
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
      `Extracting text from: ${fileUrl} using ${providerInfo.name}`,
    );

    try {
      // Intentar con proveedor primario
      const result = await this.primaryOcrService.extractText(fileUrl);

      this.logger.log(
        `Extracted ${result.text.length} characters with confidence ${result.confidence} using ${result.provider}`,
      );

      return {
        text: result.text,
        confidence: result.confidence,
      };
    } catch (error: any) {
      this.logger.error(
        `Primary OCR failed (${providerInfo.name}): ${error.message}`,
      );

      // Intentar con fallback si está disponible
      if (this.fallbackOcrService) {
        const fallbackInfo = this.fallbackOcrService.getProviderInfo();
        this.logger.log(`Attempting fallback OCR: ${fallbackInfo.name}`);

        try {
          const fallbackResult =
            await this.fallbackOcrService.extractText(fileUrl);

          this.logger.log(
            `Fallback OCR succeeded with ${fallbackResult.text.length} characters and confidence ${fallbackResult.confidence}`,
          );

          return {
            text: fallbackResult.text,
            confidence: fallbackResult.confidence,
          };
        } catch (fallbackError: any) {
          this.logger.error(
            `Fallback OCR also failed (${fallbackInfo.name}): ${fallbackError.message}`,
          );
        }
      }

      // No hay fallback o ambos fallaron
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Procesa los datos extraídos del documento para obtener productos estructurados
   * @param text - Texto extraído por OCR (no usado, se usan productos del rawResult)
   * @param tenantId - ID del tenant
   * @returns Promesa con productos extraídos y metadatos
   */
  async processDocumentData(
    text: string,
    tenantId: string,
    rawResult?: any,
  ): Promise<{
    extractedProducts: ExtractedProductDto[];
    metadata: Record<string, any>;
  }> {
    this.logger.log(`Processing document data for tenant: ${tenantId}`);

    try {
      // Usar productos extraídos por el microservicio si están disponibles
      const microserviceProducts =
        rawResult?.rawResult?.document?.products || [];

      // Si el microservicio devolvió productos estructurados, usarlos
      if (microserviceProducts.length > 0) {
        this.logger.log(
          `Using ${microserviceProducts.length} products from microservice`,
        );

        const validProducts = [];
        for (const product of microserviceProducts) {
          // Convertir formato del microservicio a DTO del backend
          const dto: ExtractedProductDto = {
            name: product.name || "",
            description: `Producto importado desde albarán`,
            quantity: product.quantity || 0,
            unit: product.unit || "ud",
            unitPrice: product.unit_price || 0,
            supplier: rawResult.rawResult?.document?.supplier_name || "IMPORTADO",
            category: "", // Se completará con ProductRecognitionService
            allergens: [],
            confidence: product.confidence || 0.85,
          };

          if (await this.validateExtraction(dto)) {
            const enhanced = await this.enhanceProductRecognition(
              dto,
              tenantId,
            );
            validProducts.push(enhanced);
          }
        }

        const metadata = {
          totalProducts: validProducts.length,
          documentDate: rawResult.rawResult?.document?.document_date,
          documentNumber: rawResult.rawResult?.document?.document_number,
          supplierName: rawResult.rawResult?.document?.supplier_name,
          cifCode: rawResult.rawResult?.document?.cif_code,
          totalAmount: rawResult.rawResult?.document?.total_amount,
          processingMethod: "paddleocr-microservice-structured",
        };

        return {
          extractedProducts: validProducts,
          metadata,
        };
      }

      // Fallback: intentar parsing del texto crudo (método original)
      this.logger.warn(
        "No structured products from microservice, using text parsing fallback",
      );
      const extractedProducts = this.parseExtractedProducts(text, tenantId);

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
        processingMethod: "text-parsing-fallback",
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
    const lines = text.split("\n");
    let currentProduct: Partial<ExtractedProductDto> | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("PRODUCTO")) {
        // Nuevo producto detectado
        if (currentProduct && currentProduct.name) {
          products.push(
            this.sanitizeProduct(currentProduct as ExtractedProductDto),
          );
        }
        currentProduct = {};
      } else if (trimmedLine.startsWith("Nombre:")) {
        currentProduct!.name = trimmedLine.replace("Nombre:", "").trim();
      } else if (trimmedLine.startsWith("Cantidad:")) {
        const quantityMatch = trimmedLine.match(
          /Cantidad:\s*([\d.,]+)\s*(\w+)/,
        );
        if (quantityMatch) {
          currentProduct!.quantity = parseFloat(quantityMatch[1]);
          currentProduct!.unit = quantityMatch[2];
        }
      } else if (trimmedLine.startsWith("Precio unitario:")) {
        const priceMatch = trimmedLine.match(
          /Precio unitario:\s*([\d.,]+)\s*€/,
        );
        if (priceMatch) {
          currentProduct!.unitPrice = parseFloat(priceMatch[1]);
        }
      } else if (trimmedLine.startsWith("Categoría:")) {
        currentProduct!.category = trimmedLine.replace("Categoría:", "").trim();
      } else if (trimmedLine.startsWith("Alérgenos:")) {
        const allergensText = trimmedLine.replace("Alérgenos:", "").trim();
        currentProduct!.allergens =
          allergensText !== "Ninguno"
            ? allergensText.split(",").map((a) => a.trim().toUpperCase())
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
      name: product.name || "",
      description: "Producto importado automáticamente desde documento",
      quantity: product.quantity || 0,
      unit: product.unit || "ud",
      unitPrice: product.unitPrice || 0,
      supplier: "IMPORTADO",
      category: product.category || "",
      allergens: product.allergens || [],
      confidence: 0.85, // Default confidence from OCR
    };
  }

  public async enhanceProductRecognition(
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
        `Product "${product.name}" recognized with confidence ${result.confidence}`,
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
        `Product "${product.name}" has ${result.suggestions.length} suggestions`,
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
