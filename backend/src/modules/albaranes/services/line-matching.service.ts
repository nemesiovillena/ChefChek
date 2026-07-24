import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { ProductRecognitionService } from "../../ocr/product-recognition.service";
import { LineMatchStatus } from "@prisma/client";
import { normalizeProductDescription } from "../../../common/utils/string-similarity";

export interface MatchLineInput {
  description: string;
  articleNumber?: string;
  tenantId: string;
  supplierId?: string;
}

export interface RememberAliasInput {
  tenantId: string;
  supplierId: string;
  description: string;
  productId: string;
  confirmedBy?: string;
}

export interface MatchSuggestion {
  id: string;
  name: string;
  netPrice: number;
  referenceUnit: string;
  similarity: number;
}

export interface MatchLineResult {
  matchedProductId: string | null;
  matchStatus: LineMatchStatus;
  confidence: number;
  suggestions: MatchSuggestion[];
}

@Injectable()
export class LineMatchingService {
  private readonly logger = new Logger(LineMatchingService.name);

  // Confidence thresholds
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productRecognition: ProductRecognitionService,
  ) {}

  /**
   * Match a single albaran line to a product
   * Strategy:
   * 1. Exact match by article number (barcode)
   * 2. Description match via ProductRecognitionService
   */
  async matchLine(input: MatchLineInput): Promise<MatchLineResult> {
    this.logger.debug(
      `Matching line: ${input.description} (article: ${input.articleNumber || "none"})`,
    );

    // 1. Try article number match (barcode)
    if (input.articleNumber) {
      const barcodeMatch = await this.matchByArticleNumber(
        input.articleNumber,
        input.tenantId,
      );

      if (barcodeMatch) {
        this.logger.log(
          `Barcode match found for ${input.articleNumber}: ${barcodeMatch.name}`,
        );
        return {
          matchedProductId: barcodeMatch.id,
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 1.0,
          suggestions: [],
        };
      }
    }

    // 2. Try description match
    if (!input.description || input.description.trim().length === 0) {
      this.logger.warn("Empty description, returning NUEVO status");
      return {
        matchedProductId: null,
        matchStatus: LineMatchStatus.NUEVO,
        confidence: 0,
        suggestions: [],
      };
    }

    // 2.1 Alias aprendido: mismo proveedor ya escribió este texto antes y el
    // usuario confirmó a qué producto corresponde (ver rememberAlias). Evita
    // repetir la misma corrección manual en cada albarán del proveedor.
    if (input.supplierId) {
      const alias = await this.findAlias(
        input.tenantId,
        input.supplierId,
        input.description,
      );

      if (alias) {
        this.logger.log(
          `Alias match for supplier ${input.supplierId}: "${input.description}" -> ${alias.productId}`,
        );
        return {
          matchedProductId: alias.productId,
          matchStatus: LineMatchStatus.MATCH_ALTO,
          confidence: 1.0,
          suggestions: [],
        };
      }
    }

    const recognitionResult = await this.productRecognition.recognizeProduct(
      input.description,
      input.tenantId,
    );

    const confidence = recognitionResult.confidence;

    // High confidence: auto-assign product
    if (confidence >= this.HIGH_CONFIDENCE_THRESHOLD) {
      const productId = await this.findProductIdByName(
        recognitionResult.recognizedProduct?.name,
        input.tenantId,
      );

      this.logger.log(
        `High confidence match (${confidence.toFixed(2)}): ${input.description} -> ${recognitionResult.recognizedProduct?.name || "unknown"}`,
      );

      return {
        matchedProductId: productId,
        matchStatus: LineMatchStatus.MATCH_ALTO,
        confidence,
        suggestions: this.mapSuggestions(recognitionResult.suggestions),
      };
    }

    // Medium confidence: return suggestions for manual review
    if (confidence >= this.LOW_CONFIDENCE_THRESHOLD) {
      this.logger.log(
        `Medium confidence match (${confidence.toFixed(2)}): ${input.description} - requires review`,
      );

      return {
        matchedProductId: null,
        matchStatus: LineMatchStatus.MATCH_DUDOSO,
        confidence,
        suggestions: this.mapSuggestions(recognitionResult.suggestions),
      };
    }

    // Low confidence: new product
    this.logger.log(
      `Low confidence match (${confidence.toFixed(2)}): ${input.description} - marking as NUEVO`,
    );

    return {
      matchedProductId: null,
      matchStatus: LineMatchStatus.NUEVO,
      confidence,
      suggestions: [],
    };
  }

  /**
   * Match all lines of an albaran in batch
   */
  async matchAllLines(albaranId: string, tenantId: string): Promise<void> {
    this.logger.log(`Matching all lines for albaran ${albaranId}`);

    const albaran = await this.prisma.albaran.findFirst({
      where: { id: albaranId, tenantId },
      include: { lines: true },
    });

    if (!albaran) {
      this.logger.warn(`Albaran ${albaranId} not found for tenant ${tenantId}`);
      return;
    }

    this.logger.log(`Processing ${albaran.lines.length} lines`);

    for (const line of albaran.lines) {
      try {
        const result = await this.matchLine({
          description: line.description,
          articleNumber: line.articleNumber || undefined,
          tenantId,
          supplierId: albaran.supplierId || undefined,
        });

        await this.prisma.albaranLine.update({
          where: { id: line.id },
          data: {
            matchedProductId: result.matchedProductId,
            matchStatus: result.matchStatus,
            confidence: result.confidence,
          },
        });

        this.logger.debug(
          `Line ${line.id} matched: status=${result.matchStatus}, confidence=${result.confidence.toFixed(2)}`,
        );
      } catch (error) {
        this.logger.error(
          `Error matching line ${line.id}: ${error.message}`,
          error.stack,
        );
        // Continue with next line
      }
    }

    this.logger.log(`Completed matching all lines for albaran ${albaranId}`);
  }

  /**
   * Look up a previously confirmed supplier alias for this description.
   */
  private async findAlias(
    tenantId: string,
    supplierId: string,
    description: string,
  ) {
    const normalizedDescription = normalizeProductDescription(description);
    if (!normalizedDescription) {
      return null;
    }

    return this.prisma.supplierProductAlias.findUnique({
      where: {
        tenantId_supplierId_normalizedDescription: {
          tenantId,
          supplierId,
          normalizedDescription,
        },
      },
    });
  }

  /**
   * Record (or refresh) a supplier alias after a user manually confirms which
   * product a raw line description corresponds to. Best-effort: a failure
   * here must not break the caller's primary action (assigning the product).
   */
  async rememberAlias(input: RememberAliasInput): Promise<void> {
    const normalizedDescription = normalizeProductDescription(
      input.description,
    );
    if (!normalizedDescription) {
      return;
    }

    try {
      await this.prisma.supplierProductAlias.upsert({
        where: {
          tenantId_supplierId_normalizedDescription: {
            tenantId: input.tenantId,
            supplierId: input.supplierId,
            normalizedDescription,
          },
        },
        create: {
          tenantId: input.tenantId,
          supplierId: input.supplierId,
          normalizedDescription,
          productId: input.productId,
          confirmedBy: input.confirmedBy,
        },
        update: {
          productId: input.productId,
          confirmedBy: input.confirmedBy,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to remember alias: ${error.message}`);
    }
  }

  /**
   * Match by article number (barcode)
   */
  private async matchByArticleNumber(articleNumber: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        barcode: articleNumber,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return product;
  }

  /**
   * Find product ID by name (exact match, case-insensitive)
   */
  private async findProductIdByName(
    productName: string | undefined,
    tenantId: string,
  ): Promise<string | null> {
    if (!productName) {
      return null;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        name: {
          mode: "insensitive",
          equals: productName,
        },
      },
      select: { id: true },
    });

    return product?.id || null;
  }

  /**
   * Map ProductRecognitionService suggestions to our format
   */
  private mapSuggestions(
    suggestions:
      | Array<{ name: string; unitPrice?: number; unit?: string }>
      | undefined,
  ): MatchSuggestion[] {
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    return suggestions
      .filter((s) => s.name)
      .slice(0, 5)
      .map((s, index) => ({
        id: `suggestion-${index}`, // Placeholder ID (would need actual product lookup)
        name: s.name,
        netPrice: s.unitPrice || 0,
        // "kilo", no "kg": símbolo real del catálogo del tenant, para que si
        // se acepta la sugerencia el producto creado coincida con el
        // selector de "Unidad de referencia" (ver unit-symbols.ts, frontend).
        referenceUnit: s.unit || "kilo",
        similarity: 0.7 - index * 0.1, // Decreasing similarity
      }));
  }
}
