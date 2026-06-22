import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { calculateSimilarity, normalizeCifNif } from '../../../common/utils/string-similarity';

export interface SupplierMatchResult {
  supplierId: string | null;
  matchType: 'CIF_EXACT' | 'NAME_FUZZY' | 'NONE';
  confidence: number;
  suggestions: Array<{
    id: string;
    name: string;
    cifNif?: string | null;
    similarity: number;
  }>;
}

@Injectable()
export class SupplierMatchingService {
  private readonly logger = new Logger(SupplierMatchingService.name);
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;
  private readonly LOW_CONFIDENCE_THRESHOLD = 0.5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attempts to match a supplier based on CIF/NIF or name.
   * Priority: CIF exact match > name fuzzy match > no match
   *
   * @param input - Object containing cifNif (optional), name (optional), and tenantId
   * @returns Match result with supplier ID, match type, confidence, and suggestions
   */
  async matchSupplier(input: {
    cifNif?: string;
    name?: string;
    tenantId: string;
  }): Promise<SupplierMatchResult> {
    this.logger.log(
      `Matching supplier for tenant ${input.tenantId}: CIF=${input.cifNif || 'none'}, Name=${input.name || 'none'}`
    );

    // 1. Try exact CIF match if provided
    if (input.cifNif) {
      const cifMatch = await this.matchByCif(input.cifNif, input.tenantId);
      if (cifMatch) {
        this.logger.log(`CIF exact match found: ${cifMatch.id}`);
        return {
          supplierId: cifMatch.id,
          matchType: 'CIF_EXACT',
          confidence: 1.0,
          suggestions: [],
        };
      }
    }

    // 2. Try fuzzy name match if provided
    if (input.name) {
      const nameMatch = await this.matchByName(input.name, input.tenantId);
      if (nameMatch) {
        return nameMatch;
      }
    }

    // 3. No match found
    this.logger.log('No supplier match found');
    return {
      supplierId: null,
      matchType: 'NONE',
      confidence: 0,
      suggestions: [],
    };
  }

  /**
   * Attempts exact match by CIF/NIF (case-insensitive, formatting normalized)
   */
  private async matchByCif(cifNif: string, tenantId: string) {
    const normalizedCif = normalizeCifNif(cifNif);

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        tenantId,
        cifNif: {
          not: null,
        },
      },
    });

    // Fetch all suppliers with CIF and compare normalized values
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenantId,
        cifNif: { not: null },
      },
      select: { id: true, name: true, cifNif: true },
    });

    for (const s of suppliers) {
      if (s.cifNif && normalizeCifNif(s.cifNif) === normalizedCif) {
        return s;
      }
    }

    return null;
  }

  /**
   * Attempts fuzzy match by supplier name.
   * Returns auto-match if best similarity >= 0.8
   * Returns suggestions if best similarity between 0.5 and 0.8
   * Returns NONE if no good matches
   */
  private async matchByName(
    name: string,
    tenantId: string
  ): Promise<SupplierMatchResult | null> {
    // Get suppliers where name contains the search term
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenantId,
        isActive: true,
        name: {
          mode: 'insensitive',
          contains: name,
        },
      },
      select: { id: true, name: true, cifNif: true },
      take: 10,
    });

    if (suppliers.length === 0) {
      return null;
    }

    // Calculate similarity scores
    const matchesWithScore = suppliers
      .map((supplier) => ({
        ...supplier,
        similarity: calculateSimilarity(name.toLowerCase(), supplier.name.toLowerCase()),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const bestMatch = matchesWithScore[0];

    // High confidence: auto-match
    if (bestMatch.similarity >= this.HIGH_CONFIDENCE_THRESHOLD) {
      this.logger.log(
        `Name fuzzy match found: ${bestMatch.id} (similarity: ${bestMatch.similarity.toFixed(2)})`
      );
      return {
        supplierId: bestMatch.id,
        matchType: 'NAME_FUZZY',
        confidence: bestMatch.similarity,
        suggestions: matchesWithScore.slice(1, 4).map((s) => ({
          id: s.id,
          name: s.name,
          cifNif: s.cifNif,
          similarity: s.similarity,
        })),
      };
    }

    // Low confidence: return suggestions without auto-matching
    if (bestMatch.similarity >= this.LOW_CONFIDENCE_THRESHOLD) {
      this.logger.log(
        `Low confidence match (similarity: ${bestMatch.similarity.toFixed(2)}), returning suggestions`
      );
      return {
        supplierId: null,
        matchType: 'NONE',
        confidence: bestMatch.similarity,
        suggestions: matchesWithScore.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          cifNif: s.cifNif,
          similarity: s.similarity,
        })),
      };
    }

    // No good matches
    return null;
  }
}
