import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { CuinerSaleLine, CuinerSaleStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  ConsumptionProduct,
  ConsumptionRecipe,
  directProductFormats,
  explodeRecipe,
} from "./cuiner-recipe-consumption";

/** Líneas pendientes procesadas por cada pulsación de «Aplicar ventas». */
const BATCH_SIZE = 5000;
/** Por debajo de esto el consumo es ruido de coma flotante. */
const EPSILON = 1e-9;
/**
 * Formato de compra que anuncia varias unidades ("Caja 24 u", "Saco 25 kg",
 * "C/6"...). Si el artículo cuenta ese formato como 1, el descuento por
 * formato saldría multiplicado: se avisa antes de aplicar.
 */
const MULTI_UNIT_FORMAT = /(caja|pack|bandeja|garrafa|saco|c\/)\s*\d+/i;

export interface SalesConsumptionPlan {
  pendingLines: number;
  appliedLineIds: string[];
  unmappedLineIds: string[];
  /** Formatos de compra a descontar por artículo (negativo = devolución). */
  consumption: {
    productId: string;
    name: string;
    unit: string;
    formats: number;
  }[];
  unmappedDishes: {
    tipo: string;
    producto: string;
    nombre: string;
    unidades: number;
  }[];
  warnings: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
}

/**
 * Aplica al stock de ChefChek las ventas del TPV de Cuiner: cada línea
 * enlazada a una receta (o artículo de venta directa) descuenta sus artículos
 * en formatos de compra, la misma unidad en que suma el albarán. Se hace a
 * mano con «Aplicar ventas» tras revisar la previsualización: un único
 * movimiento por artículo y tanda, y cada línea solo se aplica una vez.
 */
@Injectable()
export class CuinerStockService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(tenantId: string) {
    const plan = await this.buildPlan(tenantId);
    const { appliedLineIds, unmappedLineIds, ...rest } = plan;
    return {
      ...rest,
      linesToApply: appliedLineIds.length,
      linesUnmapped: unmappedLineIds.length,
    };
  }

  async apply(tenantId: string) {
    const config = await this.prisma.cuinerConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new BadRequestException(
        "El conector de Cuiner no está configurado",
      );
    }
    // Sin almacén elegido, las ventas descuentan del stock general (sin
    // almacén), el mismo en el que suman los albaranes confirmados sin almacén.
    const warehouseId = config.warehouseId ?? null;
    const plan = await this.buildPlan(tenantId);
    if (plan.appliedLineIds.length === 0 && plan.unmappedLineIds.length === 0) {
      return { applied: 0, unmapped: 0, movements: 0 };
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: plan.consumption.map((c) => c.productId) } },
      select: { id: true, purchaseFormat: true, referenceUnit: true },
    });
    const unitOf = new Map(
      products.map((p) => [p.id, p.purchaseFormat || p.referenceUnit]),
    );
    const period = this.describePeriod(plan.dateFrom, plan.dateTo);

    const movements = await this.prisma.$transaction(
      async (tx) => {
        // Reserva las líneas antes de tocar el stock: si otra pulsación
        // simultánea ya las aplicó, el recuento no cuadra y se deshace todo.
        const claimed = await tx.cuinerSaleLine.updateMany({
          where: {
            id: { in: plan.appliedLineIds },
            tenantId,
            status: CuinerSaleStatus.PENDIENTE,
          },
          data: { status: CuinerSaleStatus.APLICADA },
        });
        if (claimed.count !== plan.appliedLineIds.length) {
          throw new ConflictException(
            "Las ventas se están aplicando desde otra sesión; vuelve a intentarlo",
          );
        }
        await tx.cuinerSaleLine.updateMany({
          where: {
            id: { in: plan.unmappedLineIds },
            tenantId,
            status: CuinerSaleStatus.PENDIENTE,
          },
          data: { status: CuinerSaleStatus.SIN_MAPEO },
        });

        const movementIds: string[] = [];
        for (const item of plan.consumption) {
          const quantity = Math.round(Math.abs(item.formats) * 10000) / 10000;
          if (quantity === 0) {
            continue;
          }
          const movement = await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId,
              type: item.formats > 0 ? "EXIT" : "ENTRANCE",
              quantity,
              unit: unitOf.get(item.productId) ?? item.unit,
              reason: `Ventas Cuiner ${period}`,
            },
          });
          movementIds.push(movement.id);

          // El stock puede quedar negativo: refleja lo vendido aunque la
          // entrada de mercancía no se haya registrado aún.
          const delta = item.formats > 0 ? -quantity : quantity;
          const stock = await tx.stock.findFirst({
            where: { tenantId, productId: item.productId, warehouseId },
          });
          if (stock) {
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: { increment: delta }, lastUpdated: new Date() },
            });
          } else {
            await tx.stock.create({
              data: {
                tenantId,
                productId: item.productId,
                warehouseId,
                quantity: delta,
              },
            });
          }
        }

        if (movementIds.length > 0) {
          await tx.cuinerSaleLine.updateMany({
            where: { id: { in: plan.appliedLineIds } },
            data: { stockMovementIds: movementIds },
          });
        }
        return movementIds.length;
      },
      { timeout: 60000 },
    );

    return {
      applied: plan.appliedLineIds.length,
      unmapped: plan.unmappedLineIds.length,
      movements,
    };
  }

  /** Tras enlazar platos, devuelve a pendiente las líneas que ya tienen enlace. */
  async requeueUnmapped(tenantId: string) {
    const maps = await this.prisma.cuinerDishMap.findMany({
      where: { tenantId },
      select: { tipo: true, producto: true },
    });
    if (maps.length === 0) {
      return { requeued: 0 };
    }
    const { count } = await this.prisma.cuinerSaleLine.updateMany({
      where: {
        tenantId,
        status: CuinerSaleStatus.SIN_MAPEO,
        OR: maps.map((m) => ({ tipo: m.tipo, producto: m.producto })),
      },
      data: { status: CuinerSaleStatus.PENDIENTE },
    });
    return { requeued: count };
  }

  private describePeriod(from: Date | null, to: Date | null): string {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (!from || !to) {
      return "";
    }
    return fmt(from) === fmt(to)
      ? `del ${fmt(from)}`
      : `del ${fmt(from)} al ${fmt(to)}`;
  }

  private async buildPlan(tenantId: string): Promise<SalesConsumptionPlan> {
    const [pendingLines, lines] = await Promise.all([
      this.prisma.cuinerSaleLine.count({
        where: { tenantId, status: CuinerSaleStatus.PENDIENTE },
      }),
      this.prisma.cuinerSaleLine.findMany({
        where: { tenantId, status: CuinerSaleStatus.PENDIENTE },
        orderBy: [{ idVentasCab: "asc" }, { linea: "asc" }],
        take: BATCH_SIZE,
      }),
    ]);
    const empty: SalesConsumptionPlan = {
      pendingLines,
      appliedLineIds: [],
      unmappedLineIds: [],
      consumption: [],
      unmappedDishes: [],
      warnings: [],
      dateFrom: null,
      dateTo: null,
    };
    if (lines.length === 0) {
      return empty;
    }

    const [maps, recipes, products, dishes] = await Promise.all([
      this.prisma.cuinerDishMap.findMany({ where: { tenantId } }),
      this.loadRecipes(tenantId),
      this.loadProducts(tenantId),
      this.prisma.cuinerDish.findMany({ where: { tenantId } }),
    ]);
    const mapByKey = new Map(maps.map((m) => [`${m.tipo}-${m.producto}`, m]));
    const dishName = new Map(
      dishes.map((d) => [`${d.tipo}-${d.producto}`, d.nombre]),
    );

    const totals = new Map<string, number>();
    const unmapped = new Map<
      string,
      { tipo: string; producto: string; unidades: number }
    >();
    const warnings = new Set<string>();
    const plan = { ...empty };

    const markUnmapped = (line: CuinerSaleLine) => {
      plan.unmappedLineIds.push(line.id);
      const key = `${line.tipo}-${line.producto}`;
      const entry = unmapped.get(key) ?? {
        tipo: line.tipo,
        producto: line.producto,
        unidades: 0,
      };
      entry.unidades += line.unidades;
      unmapped.set(key, entry);
    };

    for (const line of lines) {
      const map = mapByKey.get(`${line.tipo}-${line.producto}`);
      const recipe = map?.recipeId ? recipes.get(map.recipeId) : undefined;
      const product = map?.productId ? products.get(map.productId) : undefined;
      if (!recipe && !product) {
        markUnmapped(line);
        continue;
      }

      if (recipe) {
        const { formats, missing } = explodeRecipe(
          recipe.id,
          line.unidades,
          recipes,
          products,
        );
        missing.forEach((m) =>
          warnings.add(
            `La receta «${recipe.name}» usa una sub-receta que no existe (${m})`,
          ),
        );
        formats.forEach((qty, productId) =>
          totals.set(productId, (totals.get(productId) ?? 0) + qty),
        );
      } else if (product && product.tracksInventory) {
        totals.set(
          product.id,
          (totals.get(product.id) ?? 0) +
            directProductFormats(line.unidades, product),
        );
      }
      plan.appliedLineIds.push(line.id);
      plan.dateFrom =
        !plan.dateFrom || line.fecha < plan.dateFrom
          ? line.fecha
          : plan.dateFrom;
      plan.dateTo =
        !plan.dateTo || line.fecha > plan.dateTo ? line.fecha : plan.dateTo;
    }

    plan.consumption = [...totals.entries()]
      .filter(([, formats]) => Math.abs(formats) > EPSILON)
      .map(([productId, formats]) => {
        const p = products.get(productId);
        if (p && p.unitSize === 1 && MULTI_UNIT_FORMAT.test(p.purchaseFormat)) {
          warnings.add(
            `«${p.name}» se compra en «${p.purchaseFormat}» pero cuenta ese formato como 1 unidad: revisa sus unidades por formato antes de aplicar`,
          );
        }
        return {
          productId,
          name: p?.name ?? productId,
          unit: p?.referenceUnit ?? "",
          formats,
        };
      })
      .sort((a, b) => b.formats - a.formats);
    plan.unmappedDishes = [...unmapped.values()]
      .map((d) => ({
        ...d,
        nombre: dishName.get(`${d.tipo}-${d.producto}`) ?? d.producto,
      }))
      .sort((a, b) => b.unidades - a.unidades);
    plan.warnings = [...warnings];
    return plan;
  }

  private async loadRecipes(
    tenantId: string,
  ): Promise<Map<string, ConsumptionRecipe>> {
    const rows = await this.prisma.recipe.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        portions: true,
        portionSize: true,
        ingredients: {
          select: { productId: true, quantity: true, unit: true },
        },
        subRecipes: {
          select: { subRecipeId: true, quantity: true, unit: true },
        },
      },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async loadProducts(
    tenantId: string,
  ): Promise<Map<string, ConsumptionProduct & { purchaseFormat: string }>> {
    const rows = await this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        referenceUnit: true,
        unitSize: true,
        tracksInventory: true,
        purchaseFormat: true,
      },
    });
    return new Map(rows.map((p) => [p.id, p]));
  }
}
