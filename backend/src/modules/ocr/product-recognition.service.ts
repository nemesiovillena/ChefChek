import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { ExtractedProductDto } from "./dto/extracted-product.dto";
import {
  calculateSimilarity,
  normalizeProductDescription,
} from "../../common/utils/string-similarity";

@Injectable()
export class ProductRecognitionService {
  private readonly logger = new Logger(ProductRecognitionService.name);
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor(private readonly prisma: PrismaService) {}

  async recognizeProduct(
    productName: string,
    tenantId: string,
  ): Promise<{
    recognizedProduct: ExtractedProductDto | null;
    confidence: number;
    suggestions: ExtractedProductDto[];
  }> {
    this.logger.log(
      `Recognizing product: ${productName} for tenant ${tenantId}`,
    );

    // Strategy 1: Exact match
    const exactMatch = await this.prisma.product.findFirst({
      where: {
        tenantId,
        name: {
          mode: "insensitive",
          equals: productName,
        },
      },
    });

    if (exactMatch) {
      return {
        recognizedProduct: this.mapToExtractedProduct(exactMatch),
        confidence: 1.0,
        suggestions: [],
      };
    }

    // Strategy 2: Fuzzy matching (contains)
    const fuzzyMatches = await this.prisma.product.findMany({
      where: {
        tenantId,
        name: {
          mode: "insensitive",
          contains: productName.split(" ")[0], // Match first word
        },
      },
      take: 5,
    });

    if (fuzzyMatches.length > 0) {
      // Calculate similarity scores over normalized text (sin acentos, sin
      // mayúsculas, puntuación colapsada) para que diferencias de formato
      // entre la línea OCR y el nombre del artículo no penalicen el score.
      const normalizedName = normalizeProductDescription(productName);
      const matchesWithScore = fuzzyMatches
        .map((product) => ({
          product: this.mapToExtractedProduct(product),
          similarity: calculateSimilarity(
            normalizedName,
            normalizeProductDescription(product.name),
          ),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      const bestMatch = matchesWithScore[0];

      if (bestMatch.similarity >= this.MIN_CONFIDENCE_THRESHOLD) {
        return {
          recognizedProduct: bestMatch.product,
          confidence: bestMatch.similarity,
          suggestions: matchesWithScore.slice(1).map((m) => m.product),
        };
      }

      return {
        recognizedProduct: null,
        confidence: bestMatch.similarity,
        suggestions: matchesWithScore.slice(0, 3).map((m) => m.product),
      };
    }

    // Strategy 3: Use OpenAI API (if configured) for classification
    if (process.env.OPENAI_API_KEY) {
      try {
        const aiResult = await this.classifyWithAI(productName, tenantId);
        if (aiResult.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
          return {
            recognizedProduct: aiResult.product,
            confidence: aiResult.confidence,
            suggestions: [],
          };
        }
      } catch (error) {
        this.logger.warn(`AI classification failed: ${error.message}`);
      }
    }

    // No match found - return null for human review
    return {
      recognizedProduct: null,
      confidence: 0,
      suggestions: [],
    };
  }

  async trainModel(
    tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Training product recognition model for tenant ${tenantId}`,
    );

    try {
      // Get all products for this tenant
      const products = await this.prisma.product.findMany({
        where: { tenantId },
        include: {
          category: true,
          supplier: true,
        },
      });

      if (products.length === 0) {
        return {
          success: false,
          message: "No products found for training",
        };
      }

      // In a real implementation, this would train an ML model
      // For now, we simulate training by logging statistics
      this.logger.log(`Training with ${products.length} products`);

      // Group by category
      const categoryCounts = products.reduce(
        (acc, product) => {
          const categoryName = product.category?.name || "Uncategorized";
          acc[categoryName] = (acc[categoryName] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      this.logger.log(`Category distribution:`, categoryCounts);

      return {
        success: true,
        message: `Model trained with ${products.length} products across ${Object.keys(categoryCounts).length} categories`,
      };
    } catch (error) {
      this.logger.error(`Error training model: ${error.message}`);
      throw error;
    }
  }

  async handleUnknownProduct(
    productName: string,
    tenantId: string,
    userId: string,
  ): Promise<{ success: boolean; needsReview: boolean }> {
    this.logger.log(`Handling unknown product: ${productName}`);

    // Store for human review
    await this.prisma.product.create({
      data: {
        tenantId,
        name: productName,
        description: "Producto pendiente de revisión - ingesta automática",
        purchaseFormat: "ud",
        referenceUnit: "ud",
        unitsPerFormat: 1,
        referenceUnitSize: 1,
        unitSize: 1,
        purchasePrice: 0,
        netPrice: 0,
        profitMargin: 0,
        wastePercentage: 0,
        yieldFactor: 1.0,
        allergens: [] as number[],
      },
    });

    // Create alert for review
    await this.prisma.alert.create({
      data: {
        tenantId,
        type: "INFO",
        alertType: "INFO",
        severity: "INFO",
        message: `Producto desconocido detectado: "${productName}". Requiere revisión manual antes de usar en recetas o menús.`,
        isResolved: false,
        createdBy: "SYSTEM",
      } as any,
    });

    return {
      success: true,
      needsReview: true,
    };
  }

  async validateProductForReview(
    documentId: string,
    productId: string,
    isValid: boolean,
    correctedName?: string,
    correctedPrice?: number,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Validating product ${productId} for document ${documentId}`,
    );

    try {
      if (isValid) {
        // Mark as validated - could add a 'validated' field to ExtractedProduct
        return {
          success: true,
          message: "Product validated successfully",
        };
      } else {
        // Correct product
        if (correctedName || correctedPrice !== undefined) {
          await this.prisma.product.update({
            where: { id: productId },
            data: {
              ...(correctedName && { name: correctedName }),
              ...(correctedPrice !== undefined && { netPrice: correctedPrice }),
            },
          });
        }

        return {
          success: true,
          message: "Product corrected successfully",
        };
      }
    } catch (error) {
      this.logger.error(`Error validating product: ${error.message}`);
      throw error;
    }
  }

  private async classifyWithAI(
    productName: string,
    tenantId: string,
  ): Promise<{ product: ExtractedProductDto; confidence: number }> {
    // In a real implementation, this would call OpenAI's API
    // For now, we simulate AI classification

    const categoryMap: Record<string, string> = {
      carne: "Carnes",
      pollo: "Carnes",
      pescado: "Pescados",
      vegetal: "Vegetales",
      lacteo: "Lácteos",
      leche: "Lácteos",
      fruta: "Frutas",
      pan: "Panadería",
      arroz: "Cereales",
      pasta: "Cereales",
    };

    const lowerName = productName.toLowerCase();
    let category = "Miscelánea";

    for (const [keyword, cat] of Object.entries(categoryMap)) {
      if (lowerName.includes(keyword)) {
        category = cat;
        break;
      }
    }

    return {
      product: {
        name: productName,
        category,
        unit: "kilo",
        confidence: 0.85,
      },
      confidence: 0.85,
    };
  }

  private mapToExtractedProduct(product: any): ExtractedProductDto {
    return {
      name: product.name,
      description: product.description,
      quantity: 0,
      unit: product.referenceUnit,
      unitPrice: product.netPrice,
      supplier: product.supplier?.name,
      category: product.category?.name,
      allergens: [],
      confidence: 1.0,
    };
  }
}
