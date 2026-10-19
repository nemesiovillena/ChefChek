import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { groupDishesByBrand } from "./cuiner-bulk-link-grouping";
import { CuinerServingMeasuresService } from "./cuiner-serving-measures.service";

/**
 * Datos del asistente de enlace masivo: platos sin enlazar cuyo nombre lleva
 * una palabra de medida, agrupados por marca y con el artículo propuesto.
 * La medida de cada plato la elige la pantalla, porque depende del artículo
 * que el usuario acabe eligiendo (COPA de vino o de licor).
 */
@Injectable()
export class CuinerBulkLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servingMeasures: CuinerServingMeasuresService,
  ) {}

  async candidates(tenantId: string) {
    const tipo = "P";
    const [measures, dishes, maps, sales, products] = await Promise.all([
      this.servingMeasures.list(tenantId),
      this.prisma.cuinerDish.findMany({ where: { tenantId, tipo } }),
      this.prisma.cuinerDishMap.findMany({
        where: { tenantId, tipo },
        select: { producto: true },
      }),
      this.prisma.cuinerSaleLine.groupBy({
        by: ["producto"],
        where: { tenantId, tipo, anulada: false },
        _sum: { unidades: true },
      }),
      this.prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          referenceUnit: true,
          avgUnitWeight: true,
          category: { select: { name: true } },
        },
      }),
    ]);
    const mapped = new Set(maps.map((m) => m.producto));
    const sold = new Map(sales.map((s) => [s.producto, s._sum.unidades ?? 0]));

    const groups = groupDishesByBrand(
      dishes
        .filter((d) => !mapped.has(d.producto))
        .map((d) => ({
          tipo: d.tipo,
          producto: d.producto,
          nombre: d.nombre,
          sold: sold.get(d.producto) ?? 0,
        })),
      measures,
      products.map((p) => ({
        id: p.id,
        name: p.name,
        referenceUnit: p.referenceUnit,
        categoryName: p.category?.name ?? null,
        avgUnitWeight: p.avgUnitWeight,
      })),
    );
    return { groups };
  }
}
