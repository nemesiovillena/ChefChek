import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { getUnitMeta } from "../../common/utils/product-costing.util";
import { measureToReferenceQuantity } from "./cuiner-recipe-consumption";
import {
  CreateServingMeasureDto,
  UpdateServingMeasureDto,
} from "./dto/cuiner.dto";

/**
 * Medidas con las que arranca cada local la primera vez que abre la lista.
 * Son orientativas: el local las ajusta a lo que sirve de verdad.
 * «Copa» aparece dos veces a propósito (licor y vino); al enlazar se elige.
 */
export const DEFAULT_SERVING_MEASURES: {
  name: string;
  quantity: number;
  unit: string;
  keywords: string[];
}[] = [
  { name: "Chupito", quantity: 4, unit: "cl", keywords: ["CHUPITO", "CHUP"] },
  { name: "Piedra", quantity: 5, unit: "cl", keywords: ["PIEDRA"] },
  { name: "Tubo", quantity: 5, unit: "cl", keywords: ["TUBO"] },
  {
    name: "Combinado",
    quantity: 6,
    unit: "cl",
    keywords: ["COMBI", "COMBINADO"],
  },
  { name: "Copa licor", quantity: 5, unit: "cl", keywords: ["COPA"] },
  {
    name: "Copa vino",
    quantity: 15,
    unit: "cl",
    keywords: ["COPA", "CATAVINO"],
  },
  { name: "Caña", quantity: 20, unit: "cl", keywords: ["CAÑA"] },
  { name: "Caña doble", quantity: 40, unit: "cl", keywords: ["CAÑA DOBLE"] },
  { name: "Jarra", quantity: 50, unit: "cl", keywords: ["JARRA"] },
  {
    name: "Café",
    quantity: 7,
    unit: "g",
    keywords: ["CAFE", "CORTADO", "AMERICANO"],
  },
];

/** Palabras clave en mayúsculas, sin huecos sobrantes ni repetidas. */
function normalizeKeywords(keywords: string[] | undefined): string[] {
  const clean = (keywords ?? [])
    .map((k) => k.trim().replace(/\s+/g, " ").toUpperCase())
    .filter(Boolean);
  return [...new Set(clean)];
}

function assertKnownUnit(unit: string) {
  if (!getUnitMeta(unit)) {
    throw new BadRequestException(
      `Unidad «${unit}» no válida: usa cl, ml, l, g, kg o ud`,
    );
  }
}

@Injectable()
export class CuinerServingMeasuresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista las medidas del local; la primera vez crea las de por defecto. */
  async list(tenantId: string) {
    const count = await this.prisma.servingMeasure.count({
      where: { tenantId },
    });
    if (count === 0) {
      await this.prisma.servingMeasure.createMany({
        data: DEFAULT_SERVING_MEASURES.map((m) => ({ ...m, tenantId })),
        skipDuplicates: true,
      });
    }
    const [measures, usage] = await Promise.all([
      this.prisma.servingMeasure.findMany({
        where: { tenantId },
        orderBy: [{ unit: "asc" }, { quantity: "asc" }, { name: "asc" }],
      }),
      this.prisma.cuinerDishMap.groupBy({
        by: ["servingMeasureId"],
        where: { tenantId, servingMeasureId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const linked = new Map(
      usage.map((u) => [u.servingMeasureId, u._count._all]),
    );
    return measures.map((m) => ({ ...m, linkedDishes: linked.get(m.id) ?? 0 }));
  }

  async create(tenantId: string, dto: CreateServingMeasureDto) {
    assertKnownUnit(dto.unit);
    try {
      return await this.prisma.servingMeasure.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          quantity: dto.quantity,
          unit: dto.unit.trim().toLowerCase(),
          keywords: normalizeKeywords(dto.keywords),
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error, dto.name);
    }
  }

  /**
   * Cambiar cantidad o unidad afecta a las ventas que se apliquen desde
   * ahora; los movimientos de stock ya hechos no se recalculan.
   */
  async update(tenantId: string, id: string, dto: UpdateServingMeasureDto) {
    const current = await this.findOrThrow(tenantId, id);
    if (dto.unit !== undefined) {
      assertKnownUnit(dto.unit);
      await this.assertUnitFitsLinkedProducts(tenantId, id, dto.unit);
    }
    try {
      return await this.prisma.servingMeasure.update({
        where: { id: current.id },
        data: {
          name: dto.name?.trim(),
          quantity: dto.quantity,
          unit: dto.unit?.trim().toLowerCase(),
          keywords:
            dto.keywords !== undefined
              ? normalizeKeywords(dto.keywords)
              : undefined,
        },
      });
    } catch (error) {
      throw this.mapUniqueError(error, dto.name ?? current.name);
    }
  }

  /** No se borra una medida en uso: los platos se quedarían descontando 1 ud. */
  async remove(tenantId: string, id: string) {
    await this.findOrThrow(tenantId, id);
    const linked = await this.prisma.cuinerDishMap.count({
      where: { tenantId, servingMeasureId: id },
    });
    if (linked > 0) {
      throw new ConflictException(
        `La usan ${linked} plato(s). Cámbiales la medida antes de borrarla`,
      );
    }
    await this.prisma.servingMeasure.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * La medida debe poder pasarse a la unidad de referencia del artículo
   * (cl → litro, g → kilo). Si no, el consumo saldría con factor 1 y
   * descontaría cantidades absurdas, que es justo el fallo que evitamos.
   */
  assertMeasureFitsProduct(
    measure: { name: string; unit: string },
    product: {
      name: string;
      referenceUnit: string;
      avgUnitWeight?: number | null;
    },
  ) {
    if (
      measureToReferenceQuantity(
        { quantity: 1, unit: measure.unit },
        product,
      ) !== null
    ) {
      return;
    }
    const byPieces =
      getUnitMeta(measure.unit)?.category === "unidad" &&
      getUnitMeta(product.referenceUnit)?.category !== "unidad";
    throw new BadRequestException(
      byPieces
        ? `Para vender «${product.name}» por unidades, indica su peso medio por unidad en la ficha del artículo`
        : `La medida «${measure.name}» (${measure.unit}) no encaja con «${product.name}», que se cuenta en ${product.referenceUnit || "sin unidad"}`,
    );
  }

  async findOrThrow(tenantId: string, id: string) {
    const measure = await this.prisma.servingMeasure.findFirst({
      where: { id, tenantId },
    });
    if (!measure) {
      throw new NotFoundException("Medida no encontrada");
    }
    return measure;
  }

  private async assertUnitFitsLinkedProducts(
    tenantId: string,
    measureId: string,
    unit: string,
  ) {
    const maps = await this.prisma.cuinerDishMap.findMany({
      where: {
        tenantId,
        servingMeasureId: measureId,
        productId: { not: null },
      },
      select: { productId: true },
    });
    if (maps.length === 0) {
      return;
    }
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: { in: maps.map((m) => m.productId as string) },
      },
      select: { name: true, referenceUnit: true, avgUnitWeight: true },
    });
    for (const product of products) {
      this.assertMeasureFitsProduct({ name: "editada", unit }, product);
    }
  }

  private mapUniqueError(error: unknown, name: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new ConflictException(`Ya existe una medida llamada «${name}»`);
    }
    return error;
  }
}
