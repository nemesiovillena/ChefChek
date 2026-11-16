import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { DateRange, assertRange } from "./gestion-period.util";
import {
  CHARGED,
  NO_FAMILY_LABEL,
  cents,
  groupOf,
  inRange,
} from "./gestion-sql.util";
import {
  GestionProfitabilityService,
  MAX_LABOR_DAYS,
} from "./gestion-profitability.service";
import {
  MENU_CLASS_HINT,
  MENU_CLASS_LABEL,
  MenuClass,
  classifyMenu,
} from "./gestion-menu-engineering.util";
import type { GestionTable } from "./gestion-table.types";

export const PROFITABILITY_REPORT_KEYS = [
  "food-cost",
  "compras",
  "ingenieria-menu",
  "personal",
] as const;

const esDate = (iso: string) => iso.split("-").reverse().join("/");
const rangeText = (r: DateRange) => `${esDate(r.from)} – ${esDate(r.to)}`;
const pct = (part: number, whole: number) =>
  whole > 0 ? cents((part / whole) * 100) : null;
const familyText = (f: string | null) =>
  f ? f.split("-").join(" › ") : NO_FAMILY_LABEL;

export interface ProfitabilitySummary {
  range: DateRange;
  salesBase: number;
  foodCost: {
    total: number;
    pct: number | null;
    coverage: number | null;
    unknownDishes: number;
  };
  purchases: { total: number; pct: number | null };
  /** null: rango de más de un año (las horas salen de los fichajes). */
  labor: {
    total: number;
    pct: number | null;
    hours: number;
    withoutCost: number;
  } | null;
  primeCost: { total: number; pct: number | null } | null;
  menu: Record<MenuClass, number>;
}

/** Resumen de rentabilidad e informes en la tabla común de Gestión. */
@Injectable()
export class GestionProfitabilityReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: GestionProfitabilityService,
  ) {}

  private async salesBase(tenantId: string, range: DateRange): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ base: number }[]>`
      SELECT COALESCE(SUM(s.base), 0)::float8 AS base FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}`;
    return row?.base ?? 0;
  }

  async summary(
    tenantId: string,
    range: DateRange,
  ): Promise<ProfitabilitySummary> {
    assertRange(range);
    const [salesBase, dishes, purchases, labor] = await Promise.all([
      this.salesBase(tenantId, range),
      this.data.dishSales(tenantId, range),
      this.data.purchases(tenantId, range, "supplier"),
      this.data.labor(tenantId, range),
    ]);
    const known = dishes.filter((d) => d.unitCost !== null);
    const foodCost = known.reduce(
      (n, d) => n + d.servedUnits * (d.unitCost as number),
      0,
    );
    // La cobertura no cuenta las líneas de menú (tipo M): su coste va en los
    // platos que lo componen, que ya llegan como líneas propias.
    const countable = dishes.filter((d) => d.type !== "M");
    const served = countable.reduce((n, d) => n + d.servedUnits, 0);
    const knownServed = countable
      .filter((d) => d.unitCost !== null)
      .reduce((n, d) => n + d.servedUnits, 0);
    const purchasesTotal = purchases.reduce((n, p) => n + p.base, 0);
    const laborTotal = labor?.reduce((n, l) => n + (l.cost ?? 0), 0) ?? 0;
    const menu = { estrella: 0, caballo: 0, puzzle: 0, perro: 0 };
    for (const i of this.menuItems(dishes).items) {
      menu[i.menuClass] += 1;
    }
    return {
      range,
      salesBase: cents(salesBase),
      foodCost: {
        total: cents(foodCost),
        pct: pct(foodCost, salesBase),
        coverage: pct(knownServed, served),
        unknownDishes: countable.filter((d) => d.unitCost === null).length,
      },
      purchases: {
        total: cents(purchasesTotal),
        pct: pct(purchasesTotal, salesBase),
      },
      labor: labor && {
        total: cents(laborTotal),
        pct: pct(laborTotal, salesBase),
        hours: cents(labor.reduce((n, l) => n + l.minutes, 0) / 60),
        withoutCost: labor.filter((l) => l.hourlyCost === null).length,
      },
      primeCost: labor && {
        total: cents(foodCost + laborTotal),
        pct: pct(foodCost + laborTotal, salesBase),
      },
      menu,
    };
  }

  async build(
    tenantId: string,
    key: string,
    q: Partial<DateRange> & { groupBy?: string },
  ): Promise<GestionTable> {
    if (!q.from || !q.to) {
      throw new BadRequestException("Indica las fechas del informe");
    }
    const range = { from: q.from, to: q.to };
    assertRange(range);
    switch (key) {
      case "food-cost":
        return this.foodCostTable(tenantId, range);
      case "compras":
        return this.purchasesTable(
          tenantId,
          range,
          q.groupBy === "category" ? "category" : "supplier",
        );
      case "ingenieria-menu":
        return this.menuTable(tenantId, range);
      case "personal":
        return this.laborTable(tenantId, range);
      default:
        throw new BadRequestException(`Informe desconocido: ${key}`);
    }
  }

  /**
   * Platos de carta con precio y coste conocidos (los platos de menú van a
   * 0 €). Cada plato se compara con los de su misma familia de primer nivel:
   * un café no compite en popularidad con un segundo.
   */
  private menuItems(
    dishes: Awaited<ReturnType<GestionProfitabilityService["dishSales"]>>,
  ) {
    const candidates = dishes.filter(
      (d) =>
        d.type === "P" && d.paidUnits > 0 && d.base > 0 && d.unitCost !== null,
    );
    const byKey = new Map(candidates.map((d) => [d.key, d]));
    const groups = new Map<string, typeof candidates>();
    for (const d of candidates) {
      const g = groupOf(d.family);
      groups.set(g, [...(groups.get(g) ?? []), d]);
    }
    const items: (ReturnType<typeof classifyMenu>["items"][number] & {
      group: string;
      groupSize: number;
    })[] = [];
    for (const [group, list] of groups) {
      const result = classifyMenu(
        list.map((d) => ({
          key: d.key,
          // Solo lo vendido en carta: las raciones dentro de un menú van a 0 €
          // y rebajarían el precio medio.
          units: d.paidUnits,
          price: d.base / d.paidUnits,
          cost: d.unitCost as number,
        })),
      );
      items.push(
        ...result.items.map((i) => ({ ...i, group, groupSize: list.length })),
      );
    }
    return { items, byKey };
  }

  private async foodCostTable(
    tenantId: string,
    range: DateRange,
  ): Promise<GestionTable> {
    const [dishes, salesBase] = await Promise.all([
      this.data.dishSales(tenantId, range),
      this.salesBase(tenantId, range),
    ]);
    const rows = dishes
      .map((d) => {
        const cost = d.unitCost === null ? null : d.servedUnits * d.unitCost;
        return {
          name: d.name,
          family: familyText(d.family),
          served: cents(d.servedUnits),
          base: cents(d.base),
          unitCost: d.unitCost === null ? null : cents(d.unitCost),
          cost: cost === null ? null : cents(cost),
          pct: cost === null ? null : pct(cost, d.base),
          status: d.unitCost === null ? "Sin escandallo o sin enlazar" : "",
        };
      })
      .sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.base - a.base);
    const totalCost = rows.reduce((n, r) => n + (r.cost ?? 0), 0);
    return {
      key: "food-cost",
      title: "Food cost teórico",
      subtitle: `${rangeText(range)} · coste de escandallo de lo servido`,
      columns: [
        { key: "name", label: "Plato", kind: "text" },
        { key: "family", label: "Familia", kind: "text" },
        { key: "served", label: "Uds. servidas", kind: "qty" },
        { key: "base", label: "Ventas sin IVA", kind: "euros" },
        { key: "unitCost", label: "Coste ud.", kind: "euros" },
        { key: "cost", label: "Coste total", kind: "euros" },
        { key: "pct", label: "Food cost", kind: "percent" },
        { key: "status", label: "Aviso", kind: "text" },
      ],
      rows,
      totals: {
        name: "Total",
        family: "",
        served: null,
        base: cents(salesBase),
        unitCost: null,
        cost: cents(totalCost),
        pct: pct(totalCost, salesBase),
        status: "",
      },
      notes: [
        "Coste = unidades servidas (cobradas + invitadas) × coste del escandallo por ración, o del artículo y su medida en las bebidas.",
        "Los platos de un menú cuestan pero venden a 0 €: su venta está en la línea del menú. El food cost fiable es el del total.",
        "Platos sin escandallo o sin enlazar en Cuiner no suman coste: enlázalos para que el total sea completo.",
        "El coste de cada receta es el guardado en su escandallo: si cambian precios de compra, abre y guarda la receta para actualizarlo.",
      ],
    };
  }

  private async purchasesTable(
    tenantId: string,
    range: DateRange,
    groupBy: "supplier" | "category",
  ): Promise<GestionTable> {
    const [rows, salesBase] = await Promise.all([
      this.data.purchases(tenantId, range, groupBy),
      this.salesBase(tenantId, range),
    ]);
    const total = rows.reduce((n, r) => n + r.base, 0);
    return {
      key: "compras",
      title:
        groupBy === "category"
          ? "Compras por categoría"
          : "Compras por proveedor",
      subtitle: `${rangeText(range)} · albaranes recibidos, sin IVA`,
      columns: [
        {
          key: "label",
          label: groupBy === "category" ? "Categoría" : "Proveedor",
          kind: "text",
        },
        ...(groupBy === "supplier"
          ? [{ key: "albaranes", label: "Albaranes", kind: "int" as const }]
          : []),
        { key: "base", label: "Compras sin IVA", kind: "euros" },
        { key: "share", label: "% compras", kind: "percent" },
        { key: "onSales", label: "% sobre ventas", kind: "percent" },
      ],
      rows: rows.map((r) => ({
        label: r.label,
        albaranes: r.albaranes,
        base: r.base,
        share: pct(r.base, total),
        onSales: pct(r.base, salesBase),
      })),
      totals: {
        label: "Total",
        albaranes: rows.reduce((n, r) => n + r.albaranes, 0),
        base: cents(total),
        share: total > 0 ? 100 : null,
        onSales: pct(total, salesBase),
      },
      notes: [
        `Ventas sin IVA del periodo: ${cents(salesBase).toLocaleString("es-ES")} €. Albaranes confirmados o archivados, sin líneas rechazadas; un albarán con importes mal leídos se nota aquí.`,
      ],
    };
  }

  private async menuTable(
    tenantId: string,
    range: DateRange,
  ): Promise<GestionTable> {
    const dishes = await this.data.dishSales(tenantId, range);
    const { items, byKey } = this.menuItems(dishes);
    const order: MenuClass[] = ["estrella", "caballo", "puzzle", "perro"];
    const rows = items
      .sort(
        (a, b) =>
          a.group.localeCompare(b.group) ||
          order.indexOf(a.menuClass) - order.indexOf(b.menuClass) ||
          b.units - a.units,
      )
      .map((i) => ({
        group: i.groupSize < 3 ? `${i.group} (${i.groupSize})` : i.group,
        menuClass: MENU_CLASS_LABEL[i.menuClass],
        name: byKey.get(i.key)?.name ?? i.key,
        units: cents(i.units),
        mix: cents(i.mix),
        price: cents(i.price),
        cost: cents(i.cost),
        margin: cents(i.margin),
      }));
    return {
      key: "ingenieria-menu",
      title: "Ingeniería de menú",
      subtitle: `${rangeText(range)} · popularidad × margen dentro de cada familia`,
      columns: [
        { key: "group", label: "Grupo", kind: "text" },
        { key: "menuClass", label: "Clase", kind: "text" },
        { key: "name", label: "Plato", kind: "text" },
        { key: "units", label: "Uds.", kind: "qty" },
        { key: "mix", label: "Mix en su grupo", kind: "percent" },
        { key: "price", label: "Precio medio", kind: "euros" },
        { key: "cost", label: "Coste", kind: "euros" },
        { key: "margin", label: "Margen ud.", kind: "euros" },
      ],
      rows,
      notes: [
        "Cada plato se compara con los de su misma familia: popular si su mix llega a la media del grupo (100 % / nº de platos); margen alto si deja al menos el margen medio (ponderado) del grupo. Más detalle en Gestión › Menú engineering.",
        ...order.map((c) => `${MENU_CLASS_LABEL[c]}: ${MENU_CLASS_HINT[c]}`),
        "Solo platos de carta con escandallo y sus ventas en carta: las raciones de menú (a 0 €) y los platos sin coste no entran.",
        "Un grupo con menos de 3 platos (número entre paréntesis) apenas se puede comparar: tómalo con cautela.",
      ],
    };
  }

  private async laborTable(
    tenantId: string,
    range: DateRange,
  ): Promise<GestionTable> {
    const [labor, salesBase] = await Promise.all([
      this.data.labor(tenantId, range),
      this.salesBase(tenantId, range),
    ]);
    if (!labor) {
      throw new BadRequestException(
        `El coste de personal se calcula para un año como mucho (${MAX_LABOR_DAYS} días)`,
      );
    }
    const total = labor.reduce((n, l) => n + (l.cost ?? 0), 0);
    const missing = labor.filter((l) => l.hourlyCost === null).length;
    return {
      key: "personal",
      title: "Coste de personal",
      subtitle: `${rangeText(range)} · horas fichadas × coste/hora`,
      columns: [
        { key: "name", label: "Persona", kind: "text" },
        { key: "hours", label: "Horas", kind: "qty" },
        { key: "hourlyCost", label: "Coste/hora", kind: "euros" },
        { key: "cost", label: "Coste", kind: "euros" },
      ],
      rows: labor.map((l) => ({
        name: l.name,
        hours: cents(l.minutes / 60),
        hourlyCost: l.hourlyCost,
        cost: l.cost,
      })),
      totals: {
        name: "Total",
        hours: cents(labor.reduce((n, l) => n + l.minutes, 0) / 60),
        hourlyCost: null,
        cost: cents(total),
      },
      notes: [
        `Personal sobre ventas sin IVA: ${pct(total, salesBase)?.toLocaleString("es-ES") ?? "—"} %.`,
        ...(missing > 0
          ? [
              `${missing} persona(s) sin coste/hora en su ficha: no suman coste. Rellénalo en Personal → Empleados.`,
            ]
          : []),
      ],
    };
  }
}
