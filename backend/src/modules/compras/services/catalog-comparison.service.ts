import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CatalogLineStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  calculateSimilarity,
  normalizeProductDescription,
} from "../../../common/utils/string-similarity";

// Sin anclaje a un producto canónico (a diferencia del matching de líneas
// contra artículos), así que se exige más parecido de texto que el umbral
// "dudoso" de LineMatchingService para evitar falsos emparejamientos entre
// descripciones de proveedores distintos. Subido de 0.55 a 0.8 (mismo umbral
// "alto" que LineMatchingService) tras confirmar en datos reales que 0.55
// emparejaba productos distintos: "Ensalada"↔"Ensaladilla" (~0.73) y
// "Chorizo ibérico"↔"Chorizo mini" (~0.53) por compartir prefijo de texto,
// no por ser el mismo artículo. Trade-off: con el umbral más estricto,
// artículos iguales con nombres muy distintos entre proveedores quedarán
// sin agrupar (mejor eso que un falso positivo).
const SIMILARITY_THRESHOLD = 0.8;

export interface CatalogComparisonEntry {
  catalogImportId: string;
  supplierName: string;
  lineId: string;
  rawName: string;
  purchaseFormat: string | null;
  unitPrice: number;
  isBestPrice: boolean;
}

export interface CatalogComparisonGroup {
  representativeName: string;
  entries: CatalogComparisonEntry[];
}

/**
 * Compara líneas EN CRUDO entre 2+ catálogos ya extraídos (sin pasar por
 * aceptar/aplicar): agrupa por parecido de nombre entre proveedores y marca
 * el precio más barato de cada grupo. Complementa a la comparativa contra
 * Artículos (que exige que la línea ya esté emparejada con un producto
 * existente) — aquí no hace falta tener el artículo dado de alta.
 */
@Injectable()
export class CatalogComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(
    tenantId: string,
    catalogImportIds: string[],
  ): Promise<CatalogComparisonGroup[]> {
    const uniqueIds = [...new Set(catalogImportIds)];
    if (uniqueIds.length < 2) {
      throw new BadRequestException(
        "Selecciona al menos 2 catálogos para comparar",
      );
    }

    const catalogImports = await this.prisma.catalogImport.findMany({
      where: { id: { in: uniqueIds }, tenantId },
      include: {
        supplier: { select: { name: true } },
        lines: { where: { lineStatus: { not: CatalogLineStatus.RECHAZADA } } },
      },
    });
    if (catalogImports.length !== uniqueIds.length) {
      throw new NotFoundException("Alguno de los catálogos no existe");
    }
    // Mismo orden que se pidió (findMany con `in` no lo garantiza)
    const ordered = uniqueIds.map(
      (id) => catalogImports.find((c) => c.id === id)!,
    );

    const groups: {
      representativeName: string;
      normalizedName: string;
      entries: CatalogComparisonEntry[];
    }[] = [];

    for (const catalogImport of ordered) {
      for (const line of catalogImport.lines) {
        const normalized = normalizeProductDescription(line.rawName);

        let bestGroup: (typeof groups)[number] | null = null;
        let bestScore = 0;
        for (const group of groups) {
          // Un catálogo no puede aportar 2 líneas al mismo grupo
          if (
            group.entries.some((e) => e.catalogImportId === catalogImport.id)
          ) {
            continue;
          }
          const score = calculateSimilarity(normalized, group.normalizedName);
          if (score > bestScore) {
            bestScore = score;
            bestGroup = group;
          }
        }

        const entry: CatalogComparisonEntry = {
          catalogImportId: catalogImport.id,
          supplierName: catalogImport.supplier.name,
          lineId: line.id,
          rawName: line.rawName,
          purchaseFormat: line.purchaseFormat,
          unitPrice: line.unitPrice,
          isBestPrice: false,
        };

        if (bestGroup && bestScore >= SIMILARITY_THRESHOLD) {
          bestGroup.entries.push(entry);
        } else {
          groups.push({
            representativeName: line.rawName,
            normalizedName: normalized,
            entries: [entry],
          });
        }
      }
    }

    for (const group of groups) {
      const minPrice = Math.min(...group.entries.map((e) => e.unitPrice));
      for (const entry of group.entries) {
        entry.isBestPrice = entry.unitPrice === minPrice;
      }
    }

    return groups
      .sort(
        (a, b) =>
          b.entries.length - a.entries.length ||
          a.representativeName.localeCompare(b.representativeName),
      )
      .map(({ representativeName, entries }) => ({
        representativeName,
        entries,
      }));
  }
}
