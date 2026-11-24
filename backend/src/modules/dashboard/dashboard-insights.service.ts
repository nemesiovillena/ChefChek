import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { RecipesService } from "../recipes/recipes.service";
import { CostingConfigService } from "../costing-config/costing-config.service";

/** Ventanas móviles que ofrece el Dashboard interactivo. */
export const SPEND_PERIODS = { MONTH: 30, QUARTER: 90, YEAR: 365 } as const;
export type SpendPeriod = keyof typeof SPEND_PERIODS;

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

interface SpendSqlRow {
  supplierId: string | null;
  supplierName: string | null;
  albaranes: number;
  amount: number;
}

export interface SpendRange {
  from: Date;
  to: Date;
}

/** Periodo actual (los últimos N días hasta ahora) y el inmediatamente anterior, de igual duración. */
export function spendRanges(
  period: SpendPeriod,
  now: Date = new Date(),
): { current: SpendRange; previous: SpendRange } {
  const days = SPEND_PERIODS[period];
  const currentFrom = new Date(now.getTime() - days * DAY_MS);
  const previousFrom = new Date(currentFrom.getTime() - days * DAY_MS);
  return {
    current: { from: currentFrom, to: now },
    previous: { from: previousFrom, to: currentFrom },
  };
}

/** Variación porcentual; null cuando no hay base con la que comparar. */
export function changePercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Datos reales del Dashboard interactivo: gasto por proveedor a partir de los
 * albaranes confirmados y coste de la carta a partir del escandallo vivo de
 * cada receta con PVP. Nada se estima ni se aproxima.
 */
@Injectable()
export class DashboardInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly costingConfig: CostingConfigService,
  ) {}

  async supplierSpend(tenantId: string, period: SpendPeriod) {
    const { current, previous } = spendRanges(period);
    // Mismo criterio que Gestión → Compras: importe neto de cada línea no
    // rechazada (el neto del papel o, si falta, cantidad × precio). El campo
    // `base` del albarán no sirve: la mayoría de albaranes lo dejan a 0.
    const sumBySupplier = (range: SpendRange) =>
      this.prisma.$queryRaw<SpendSqlRow[]>`
        SELECT a."supplierId" AS "supplierId", sp.name AS "supplierName",
          COUNT(DISTINCT a.id)::int AS albaranes,
          COALESCE(SUM(COALESCE(l."totalPrice", l."lineAmount")), 0)::float8 AS amount
        FROM albaranes a
        JOIN albaran_lines l ON l."albaranId" = a.id AND l."lineStatus" <> 'RECHAZADO'
        LEFT JOIN suppliers sp ON sp.id = a."supplierId" AND sp."tenantId" = a."tenantId"
        WHERE a."tenantId" = ${tenantId} AND a."deletedAt" IS NULL
          AND a.status IN ('CONFIRMADO', 'ARCHIVADO')
          AND a.date >= ${range.from} AND a.date < ${range.to}
        GROUP BY 1, 2`;
    const [now, before] = await Promise.all([
      sumBySupplier(current),
      sumBySupplier(previous),
    ]);

    const previousBySupplier = new Map(
      before.map((g) => [g.supplierId, g.amount]),
    );
    const rows = now
      .map((g) => {
        const previousAmount = previousBySupplier.get(g.supplierId) ?? 0;
        return {
          supplierId: g.supplierId,
          supplierName: g.supplierId
            ? (g.supplierName ?? "Proveedor eliminado")
            : "Sin proveedor asignado",
          amount: round2(g.amount),
          previousAmount: round2(previousAmount),
          changePercent: changePercent(g.amount, previousAmount),
          albaranes: g.albaranes,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const total = round2(now.reduce((sum, g) => sum + g.amount, 0));
    const previousTotal = round2(before.reduce((sum, g) => sum + g.amount, 0));
    return {
      success: true,
      data: {
        period,
        range: current,
        previousRange: previous,
        total,
        previousTotal,
        changePercent: changePercent(total, previousTotal),
        suppliers: rows,
      },
    };
  }

  async recipeMargins(tenantId: string) {
    const [config, active] = await Promise.all([
      this.costingConfig.getConfig(tenantId),
      this.prisma.recipe.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        select: { id: true, name: true, isDrink: true, sellingPrice: true },
      }),
    ]);
    const priced = active.filter((r) => (r.sellingPrice ?? 0) > 0);
    const live = await this.recipes.liveCosts(
      tenantId,
      priced.map((r) => r.id),
    );
    const target = config.targetCostPercentage;

    const rows = priced
      .map((r) => {
        const cost = live.get(r.id);
        const portions = cost?.portions ?? 0;
        const totalCost = cost?.totalCost ?? 0;
        const costPerPortion = portions > 0 ? totalCost / portions : totalCost;
        const sellingPrice = r.sellingPrice as number;
        const costPercentage = (costPerPortion / sellingPrice) * 100;
        return {
          recipeId: r.id,
          name: r.name,
          isDrink: r.isDrink,
          sellingPrice,
          costPerPortion,
          costPercentage,
          overTarget: costPercentage > target,
        };
      })
      .sort((a, b) => b.costPercentage - a.costPercentage);

    const averageCostPercentage =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + r.costPercentage, 0) / rows.length
        : null;
    return {
      success: true,
      data: {
        targetCostPercentage: target,
        averageCostPercentage,
        pricedCount: rows.length,
        withoutPriceCount: active.length - rows.length,
        overTargetCount: rows.filter((r) => r.overTarget).length,
        recipes: rows,
      },
    };
  }
}
