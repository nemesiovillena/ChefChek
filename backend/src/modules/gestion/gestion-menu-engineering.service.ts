import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  DateRange,
  addDays,
  assertRange,
  rangeDays,
} from "./gestion-period.util";
import { cents, groupOf, inRange } from "./gestion-sql.util";
import {
  DishSale,
  GestionProfitabilityService,
  PurchaseRow,
} from "./gestion-profitability.service";
import {
  MenuClass,
  OmnesResult,
  classifyMenu,
  omnesOf,
  paretoOf,
} from "./gestion-menu-engineering.util";

export type MenuScope = "comida" | "bebida";

/** Familias de bebida por su nombre en el TPV. */
const DRINK_FAMILY =
  /BEBIDA|VINO|CAFE|CAFÉ|CERVEZA|REFRESCO|AGUA|LICOR|COPA|COCTEL|CÓCTEL|INFUSI|ZUMO|CAVA|BODEGA|ALCOHOL/i;

/** Platos de carta con ventas cobradas en carta (las raciones de menú van a 0 €). */
const sold = (d: DishSale) => d.type === "P" && d.paidUnits > 0 && d.base > 0;

/**
 * Comida o bebida por familia: por su nombre en el TPV (VINOS, CAFE…) o, si
 * el nombre no lo dice, si la mayoría de sus recetas son de bebida. Un plato
 * enlazado a un artículo no cuenta: las zamburiñas también se venden así.
 */
export function scopeOfGroups(dishes: DishSale[]): Map<string, MenuScope> {
  const votes = new Map<string, { drink: number; food: number }>();
  for (const d of dishes) {
    const g = groupOf(d.family);
    const v = votes.get(g) ?? { drink: 0, food: 0 };
    if (d.drink === true) {
      v.drink += 1;
    }
    if (d.drink === false) {
      v.food += 1;
    }
    votes.set(g, v);
  }
  const out = new Map<string, MenuScope>();
  for (const [g, v] of votes) {
    const drink = DRINK_FAMILY.test(g) || v.drink > v.food;
    out.set(g, drink ? "bebida" : "comida");
  }
  return out;
}

export interface MenuEngineeringRow {
  key: string;
  name: string;
  cost: number;
  price: number;
  margin: number;
  costPct: number | null;
  units: number;
  totalCost: number;
  revenue: number;
  totalMargin: number;
  popularity: number;
  popular: boolean;
  profitable: boolean;
  menuClass: MenuClass;
  /** Receta enlazada, para abrir el escandallo. */
  recipeId: string | null;
  /** Clase en el periodo anterior de igual duración; null si no se vendió. */
  previousClass: MenuClass | null;
}

export interface MenuEngineeringAnalysis {
  range: DateRange;
  previousRange: DateRange;
  scope: MenuScope;
  popularityFactor: number;
  /** Familias con venta; `costed` = platos con coste (entran en la matriz). */
  groups: { name: string; dishes: number; costed: number; revenue: number }[];
  group: string | null;
  matrix: {
    rows: MenuEngineeringRow[];
    /** Platos vendidos del grupo que no entran por no tener coste. */
    withoutCost: {
      key: string;
      name: string;
      units: number;
      recipeId: string | null;
    }[];
    thresholds: { popularity: number; margin: number };
    totals: {
      units: number;
      totalCost: number;
      revenue: number;
      totalMargin: number;
      costPct: number | null;
    };
    /** Medias simples (por plato) y ponderadas (por unidad vendida). */
    simpleMeans: { cost: number; price: number; margin: number };
    weightedMeans: { cost: number; price: number; margin: number };
  };
  pareto: {
    dishes: number;
    byRevenue: { needed: number; items: ParetoItem[] };
    byUnits: { needed: number; items: ParetoItem[] };
  };
  omnes: OmnesResult | null;
  grayZone: GrayZone;
  costRatios: CostRatios;
}

/** Ratios de coste sobre la cifra de ventas (sin IVA) del periodo. */
export interface CostRatios {
  salesBase: number;
  /** Coste total de materia prima: el coste real de la zona gris. */
  rawMaterial: { cost: number; pct: number | null };
  /** Compras por categoría: la primera es la materia prima principal. */
  byCategory: { label: string; cost: number; pct: number | null }[];
}

interface ParetoItem {
  key: string;
  name: string;
  group: string;
  value: number;
  share: number;
  cumulative: number;
}

interface Cancellations {
  tickets: number;
  lines: number;
  total: number;
}

export interface GrayZone {
  salesBase: number;
  /** 1. Media simple del % de coste de los platos de la carta. */
  menuAverageCostPct: number | null;
  /** 2. Coste teórico de lo servido sobre su venta (ponderado por ventas). */
  theoreticalCostPct: number | null;
  theoreticalCost: number;
  /** % de las unidades servidas que tienen coste conocido. */
  coverage: number | null;
  /**
   * 3. Coste real: compras de albaranes del periodo (sin inventarios todavía:
   * lo que entra y no se gasta en el mes también cuenta).
   */
  realCost: number;
  realCostPct: number | null;
  /** Real − teórico, en puntos de % y en euros sobre la venta del periodo. */
  gapPoints: number | null;
  gapEuros: number | null;
  controls: {
    invitations: { units: number; cost: number; value: number };
    cancellations: { tickets: number; lines: number; total: number };
  };
}

/**
 * Menú engineering: matriz popularidad × rentabilidad de una familia, 80/20,
 * principios de Omnes, zona gris (coste teórico frente a real) y ratios de
 * coste.
 */
@Injectable()
export class GestionMenuEngineeringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: GestionProfitabilityService,
  ) {}

  async analysis(
    tenantId: string,
    q: DateRange & {
      scope?: MenuScope;
      group?: string;
      popularityFactor?: number;
    },
  ): Promise<MenuEngineeringAnalysis> {
    const range = { from: q.from, to: q.to };
    assertRange(range);
    const scope: MenuScope = q.scope === "bebida" ? "bebida" : "comida";
    const popularityFactor = q.popularityFactor === 0.7 ? 0.7 : 1;
    const days = rangeDays(range);
    const previousRange = {
      from: addDays(range.from, -days),
      to: addDays(range.from, -1),
    };

    const [dishes, previousDishes, purchases, cancellations] =
      await Promise.all([
        this.data.dishSales(tenantId, range),
        this.data.dishSales(tenantId, previousRange),
        this.data.purchases(tenantId, range, "category"),
        this.cancellations(tenantId, range),
      ]);
    const grayZone = this.grayZone(dishes, purchases, cancellations);
    const costRatios = this.costRatios(purchases, grayZone);

    const scopes = scopeOfGroups([...dishes, ...previousDishes]);
    const inScope = dishes.filter(
      (d) => sold(d) && scopes.get(groupOf(d.family)) === scope,
    );

    const byGroup = new Map<string, DishSale[]>();
    for (const d of inScope) {
      const g = groupOf(d.family);
      byGroup.set(g, [...(byGroup.get(g) ?? []), d]);
    }
    const groups = [...byGroup.entries()]
      .map(([name, list]) => ({
        name,
        dishes: list.length,
        costed: list.filter((d) => d.unitCost !== null).length,
        revenue: cents(list.reduce((n, d) => n + d.base, 0)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
    // Por defecto, la familia que más vende con al menos dos platos con coste:
    // una sin escandallos no tiene matriz que enseñar.
    const group =
      q.group && byGroup.has(q.group)
        ? q.group
        : ((groups.find((g) => g.costed >= 2) ?? groups[0])?.name ?? null);

    const list = group ? (byGroup.get(group) ?? []) : [];
    const previousList = group
      ? previousDishes.filter((d) => sold(d) && groupOf(d.family) === group)
      : [];

    const toInput = (d: DishSale) => ({
      key: d.key,
      // Solo lo vendido en carta: las raciones de menú van a 0 € y
      // rebajarían el precio medio.
      units: d.paidUnits,
      price: d.base / d.paidUnits,
      cost: d.unitCost as number,
    });
    const costed = list.filter((d) => d.unitCost !== null);
    const result = classifyMenu(costed.map(toInput), popularityFactor);
    const previous = new Map(
      classifyMenu(
        previousList.filter((d) => d.unitCost !== null).map(toInput),
        popularityFactor,
      ).items.map((i) => [i.key, i.menuClass]),
    );
    const byKey = new Map(list.map((d) => [d.key, d]));

    const rows: MenuEngineeringRow[] = result.items
      .map((i) => ({
        key: i.key,
        name: byKey.get(i.key)?.name ?? i.key,
        recipeId: byKey.get(i.key)?.recipeId ?? null,
        cost: cents(i.cost),
        price: cents(i.price),
        margin: cents(i.margin),
        costPct: i.price > 0 ? cents((i.cost / i.price) * 100) : null,
        units: cents(i.units),
        totalCost: cents(i.cost * i.units),
        revenue: cents(i.price * i.units),
        totalMargin: cents(i.margin * i.units),
        popularity: cents(i.mix),
        popular: i.popular,
        profitable: i.profitable,
        menuClass: i.menuClass,
        previousClass: previous.get(i.key) ?? null,
      }))
      .sort((a, b) => b.totalMargin - a.totalMargin);

    const units = result.items.reduce((n, i) => n + i.units, 0);
    const totalCost = result.items.reduce((n, i) => n + i.cost * i.units, 0);
    const revenue = result.items.reduce((n, i) => n + i.price * i.units, 0);
    const n = result.items.length;
    const avg = (f: (i: (typeof result.items)[number]) => number) =>
      n ? cents(result.items.reduce((s, i) => s + f(i), 0) / n) : 0;

    const paretoItems = (value: (d: DishSale) => number) => {
      const p = paretoOf(
        inScope.map((d) => ({
          key: d.key,
          name: d.name,
          group: groupOf(d.family),
          value: value(d),
        })),
      );
      return {
        needed: p.needed,
        items: p.items.map((i) => ({
          ...i,
          value: cents(i.value),
          share: cents(i.share),
          cumulative: cents(i.cumulative),
        })),
      };
    };

    const omnes = omnesOf(
      list.map((d) => ({ price: d.base / d.paidUnits, units: d.paidUnits })),
    );

    return {
      range,
      previousRange,
      scope,
      popularityFactor,
      groups,
      group,
      matrix: {
        rows,
        withoutCost: list
          .filter((d) => d.unitCost === null)
          .map((d) => ({
            key: d.key,
            name: d.name,
            units: cents(d.paidUnits),
            recipeId: d.recipeId,
          }))
          .sort((a, b) => b.units - a.units),
        thresholds: {
          popularity: cents(result.popularityThreshold),
          margin: cents(result.averageMargin),
        },
        totals: {
          units: cents(units),
          totalCost: cents(totalCost),
          revenue: cents(revenue),
          totalMargin: cents(revenue - totalCost),
          costPct: revenue > 0 ? cents((totalCost / revenue) * 100) : null,
        },
        simpleMeans: {
          cost: avg((i) => i.cost),
          price: avg((i) => i.price),
          margin: avg((i) => i.margin),
        },
        weightedMeans: {
          cost: units ? cents(totalCost / units) : 0,
          price: units ? cents(revenue / units) : 0,
          margin: units ? cents((revenue - totalCost) / units) : 0,
        },
      },
      pareto: {
        dishes: inScope.length,
        byRevenue: paretoItems((d) => d.base),
        byUnits: paretoItems((d) => d.paidUnits),
      },
      omnes: omnes && {
        ...omnes,
        minPrice: cents(omnes.minPrice),
        maxPrice: cents(omnes.maxPrice),
        amplitude: Math.round(omnes.amplitude * 100) / 100,
        bands: omnes.bands.map((b) => ({
          ...b,
          from: cents(b.from),
          to: cents(b.to),
        })),
        offeredAverage: cents(omnes.offeredAverage),
        demandedAverage: cents(omnes.demandedAverage),
        ratio: Math.round(omnes.ratio * 1000) / 1000,
      },
      grayZone,
      costRatios,
    };
  }

  private costRatios(purchases: PurchaseRow[], grayZone: GrayZone): CostRatios {
    const salesBase = grayZone.salesBase;
    const pctOf = (v: number) =>
      salesBase > 0 ? cents((v / salesBase) * 100) : null;
    return {
      salesBase,
      rawMaterial: {
        cost: grayZone.realCost,
        pct: pctOf(grayZone.realCost),
      },
      byCategory: purchases
        .filter((p) => p.base > 0)
        .map((p) => ({ label: p.label, cost: p.base, pct: pctOf(p.base) })),
    };
  }

  /**
   * Zona gris de toda la carta (comida y bebida): coste medio de la carta,
   * coste teórico de lo vendido en carta y coste real (todas las compras de
   * albaranes; sin inventarios todavía). Se compara en % sobre venta: el
   * teórico solo cuenta los platos con coste, así una cobertura baja no
   * infla la diferencia.
   */
  private grayZone(
    dishes: DishSale[],
    purchases: PurchaseRow[],
    cancellations: Cancellations,
  ): GrayZone {
    const salesBase = dishes.reduce((n, d) => n + d.base, 0);
    const countable = dishes.filter((d) => d.type !== "M");
    const known = countable.filter((d) => d.unitCost !== null);
    // Solo la carta: las raciones dentro de un menú van a 0 € (su venta está
    // en la línea del menú), así que si su coste contara, el teórico subiría
    // sin la venta que lo paga. Uds. de carta = servidas − las de menú.
    const cartaUnits = (d: DishSale) => d.servedUnits - (d.units - d.paidUnits);
    const theoreticalCost = known.reduce(
      (n, d) => n + cartaUnits(d) * (d.unitCost as number),
      0,
    );
    const knownBase = known.reduce((n, d) => n + d.base, 0);
    const served = countable.reduce((n, d) => n + d.servedUnits, 0);
    const knownServed = known.reduce((n, d) => n + d.servedUnits, 0);
    const menuDishes = known.filter(sold);
    const menuAverageCostPct = menuDishes.length
      ? cents(
          (menuDishes.reduce(
            (n, d) => n + (d.unitCost as number) / (d.base / d.paidUnits),
            0,
          ) /
            menuDishes.length) *
            100,
        )
      : null;
    const purchasesTotal = purchases.reduce((n, p) => n + p.base, 0);
    const realCost = purchasesTotal;
    const theoreticalCostPct =
      knownBase > 0 ? cents((theoreticalCost / knownBase) * 100) : null;
    const realCostPct =
      salesBase > 0 ? cents((realCost / salesBase) * 100) : null;
    const gapPoints =
      theoreticalCostPct !== null && realCostPct !== null
        ? cents(realCostPct - theoreticalCostPct)
        : null;
    const invited = countable.filter(
      (d) => d.servedUnits - d.units > 0 && d.unitCost !== null,
    );
    return {
      salesBase: cents(salesBase),
      menuAverageCostPct,
      theoreticalCostPct,
      theoreticalCost: cents(theoreticalCost),
      coverage: served > 0 ? cents((knownServed / served) * 100) : null,
      realCost: cents(realCost),
      realCostPct,
      gapPoints,
      gapEuros:
        gapPoints !== null ? cents((gapPoints / 100) * salesBase) : null,
      controls: {
        invitations: {
          units: cents(
            countable.reduce(
              (n, d) => n + Math.max(0, d.servedUnits - d.units),
              0,
            ),
          ),
          cost: cents(
            invited.reduce(
              (n, d) => n + (d.servedUnits - d.units) * (d.unitCost as number),
              0,
            ),
          ),
          value: cents(
            countable
              .filter((d) => d.servedUnits - d.units > 0 && d.paidUnits > 0)
              .reduce(
                (n, d) =>
                  n + (d.servedUnits - d.units) * (d.base / d.paidUnits),
                0,
              ),
          ),
        },
        cancellations,
      },
    };
  }

  /**
   * Líneas anuladas en caja: importe con IVA, líneas y tickets. Son sobre todo
   * errores de marcado (cantidades o precios mal puestos), no platos devueltos.
   */
  private async cancellations(
    tenantId: string,
    range: DateRange,
  ): Promise<Cancellations> {
    const [row] = await this.prisma.$queryRaw<
      { tickets: number; lines: number; total: number }[]
    >`
      SELECT COUNT(DISTINCT s."idVentasCab")::int AS tickets, COUNT(*)::int AS lines,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND s.anulada = true`;
    return {
      tickets: row?.tickets ?? 0,
      lines: row?.lines ?? 0,
      total: cents(row?.total ?? 0),
    };
  }
}
