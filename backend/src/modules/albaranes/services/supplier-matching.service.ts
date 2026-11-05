import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  calculateSimilarity,
  normalizeCifNif,
  normalizeProductDescription,
} from "../../../common/utils/string-similarity";

export interface SupplierMatchResult {
  supplierId: string | null;
  matchType: "CIF_EXACT" | "NAME_FUZZY" | "NONE";
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
      `Matching supplier for tenant ${input.tenantId}: CIF=${input.cifNif || "none"}, Name=${input.name || "none"}`,
    );

    // 1. Try exact CIF match if provided
    if (input.cifNif) {
      const cifMatch = await this.matchByCif(input.cifNif, input.tenantId);
      if (cifMatch) {
        this.logger.log(`CIF exact match found: ${cifMatch.id}`);
        return {
          supplierId: cifMatch.id,
          matchType: "CIF_EXACT",
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
    this.logger.log("No supplier match found");
    return {
      supplierId: null,
      matchType: "NONE",
      confidence: 0,
      suggestions: [],
    };
  }

  /**
   * Attempts exact match by CIF/NIF (case-insensitive, formatting normalized)
   */
  private async matchByCif(cifNif: string, tenantId: string) {
    const normalizedCif = normalizeCifNif(cifNif);

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
    tenantId: string,
  ): Promise<SupplierMatchResult | null> {
    // Comparamos contra todos los proveedores activos del tenant (volumen bajo
    // por tenant): un `contains` SQL direccional descartaba candidatos válidos
    // cuando el nombre OCR (razón social larga) no era substring del nombre
    // comercial corto guardado en BD, o viceversa.
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: { id: true, name: true, cifNif: true, legalName: true },
    });

    if (suppliers.length === 0) {
      return null;
    }

    // El OCR extrae la razón social completa del papel, que se parece mucho
    // más a legalName (cuando ya se conoce) que al nombre comercial corto
    // (name); usamos el mejor de los dos por si legalName aún no está relleno.
    const normalizedInput = name.toLowerCase();
    const matchesWithScore = suppliers
      .map((supplier) => {
        const nameSimilarity = calculateSimilarity(
          normalizedInput,
          supplier.name.toLowerCase(),
        );
        const legalNameSimilarity = supplier.legalName
          ? calculateSimilarity(
              normalizedInput,
              supplier.legalName.toLowerCase(),
            )
          : 0;
        return {
          ...supplier,
          similarity: Math.max(nameSimilarity, legalNameSimilarity),
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const bestMatch = matchesWithScore[0];

    // High confidence: auto-match
    if (bestMatch.similarity >= this.HIGH_CONFIDENCE_THRESHOLD) {
      this.logger.log(
        `Name fuzzy match found: ${bestMatch.id} (similarity: ${bestMatch.similarity.toFixed(2)})`,
      );
      return {
        supplierId: bestMatch.id,
        matchType: "NAME_FUZZY",
        confidence: bestMatch.similarity,
        suggestions: matchesWithScore.slice(1, 4).map((s) => ({
          id: s.id,
          name: s.name,
          cifNif: s.cifNif,
          similarity: s.similarity,
        })),
      };
    }

    // El papel trae la razón social larga («COMESTIBLES SALAS MOLTO JUAN SALAS
    // QUINTA») y el proveedor se guardó con el nombre corto («Salas Moltó»):
    // la distancia de edición nunca llega al umbral. Si todas las palabras del
    // nombre guardado aparecen en el del papel, es él; si casan varios, gana
    // el que más palabras comparte, y en empate no se adivina.
    const containedMatch = this.matchByContainedName(name, suppliers);
    if (containedMatch) {
      this.logger.log(`Name contained in OCR name: ${containedMatch.id}`);
      return {
        supplierId: containedMatch.id,
        matchType: "NAME_FUZZY",
        confidence: this.HIGH_CONFIDENCE_THRESHOLD,
        suggestions: [],
      };
    }

    // Low confidence: return suggestions without auto-matching
    if (bestMatch.similarity >= this.LOW_CONFIDENCE_THRESHOLD) {
      this.logger.log(
        `Low confidence match (similarity: ${bestMatch.similarity.toFixed(2)}), returning suggestions`,
      );
      return {
        supplierId: null,
        matchType: "NONE",
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

  private matchByContainedName<
    T extends { id: string; name: string; legalName: string | null },
  >(ocrName: string, suppliers: T[]): T | null {
    const ocrWords = new Set(normalizeProductDescription(ocrName).split(" "));
    let best: { supplier: T; words: number } | null = null;
    let tie = false;
    for (const supplier of suppliers) {
      const words = Math.max(
        this.containedWordCount(supplier.name, ocrWords),
        supplier.legalName
          ? this.containedWordCount(supplier.legalName, ocrWords)
          : 0,
      );
      if (words === 0) {
        continue;
      }
      if (!best || words > best.words) {
        best = { supplier, words };
        tie = false;
      } else if (words === best.words) {
        tie = true;
      }
    }
    return best && !tie ? best.supplier : null;
  }

  /**
   * Nº de palabras del nombre si TODAS están en el texto del papel; 0 si falta
   * alguna. Una sola palabra de 1-3 letras no basta.
   */
  private containedWordCount(name: string, ocrWords: Set<string>): number {
    const words = normalizeProductDescription(name).split(" ").filter(Boolean);
    if (words.length === 0 || !words.every((w) => ocrWords.has(w))) {
      return 0;
    }
    if (words.length === 1 && words[0].length < 4) {
      return 0;
    }
    return words.length;
  }

  /**
   * Auto-fills empty supplier fields from OCR-extracted data.
   * Only overwrites fields that are currently null/empty in the DB.
   */
  async enrichSupplierFromOcr(
    supplierId: string,
    ocrData: {
      legalName?: string | null;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      sanitaryRegistry?: string | null;
    },
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        legalName: true,
        address: true,
        phone: true,
        email: true,
        sanitaryRegistry: true,
      },
    });

    if (!supplier) {
      return;
    }

    const updates: Record<string, string> = {};
    if (ocrData.legalName && !supplier.legalName) {
      updates.legalName = ocrData.legalName;
    }
    if (ocrData.address && !supplier.address) {
      updates.address = ocrData.address;
    }
    if (ocrData.phone && !supplier.phone) {
      updates.phone = ocrData.phone;
    }
    if (ocrData.email && !supplier.email) {
      updates.email = ocrData.email;
    }
    if (ocrData.sanitaryRegistry && !supplier.sanitaryRegistry) {
      updates.sanitaryRegistry = ocrData.sanitaryRegistry;
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.supplier.update({
        where: { id: supplierId },
        data: updates,
      });
      this.logger.log(
        `Enriched supplier ${supplierId} with OCR data: ${Object.keys(updates).join(", ")}`,
      );
    }
  }
}
