import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { WorkdaysService } from "../check-in/services/workdays.service";
import {
  DateRange,
  addDays,
  assertRange,
  rangeDays,
} from "./gestion-period.util";
import { CHARGED, cents, inRange } from "./gestion-sql.util";
import { unitCostOfDish } from "./gestion-dish-cost.util";

/** Ventas de un plato en el rango con su coste teórico por unidad. */
export interface DishSale {
  key: string;
  name: string;
  family: string | null;
  type: string;
  /** Unidades cobradas (sin invitaciones). */
  units: number;
  /** Unidades con precio: fuera las que van a 0 € dentro de un menú. */
  paidUnits: number;
  /** Unidades que salieron de cocina: cobradas + invitadas. */
  servedUnits: number;
  /** Ventas sin IVA. */
  base: number;
  /** Coste teórico por unidad; null = sin escandallo o sin enlazar. */
  unitCost: number | null;
}

export interface PurchaseRow {
  key: string;
  label: string;
  albaranes: number;
  base: number;
}

export interface LaborRow {
  employeeId: string;
  name: string;
  minutes: number;
  hourlyCost: number | null;
  cost: number | null;
}

/** El cálculo de horas recorre los fichajes de cada persona: un año como mucho. */
export const MAX_LABOR_DAYS = 366;
/** Tramo máximo que admite WorkdaysService.getWorkdays. */
const WORKDAYS_MAX_DAYS = 100;

/** Personas cuyas jornadas se calculan a la vez (cada una lanza varias consultas). */
const LABOR_CONCURRENCY = 4;

/** Como Promise.all, pero con como mucho `limit` tareas en marcha. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/** Parte un rango en tramos consecutivos de como mucho `size` días. */
export function chunkRange(range: DateRange, size: number): DateRange[] {
  const windows: DateRange[] = [];
  let from = range.from;
  while (from <= range.to) {
    const end = addDays(from, size - 1);
    const to = end < range.to ? end : range.to;
    windows.push({ from, to });
    from = addDays(to, 1);
  }
  return windows;
}

/**
 * Datos de rentabilidad de Gestión: coste teórico de lo vendido (escandallos
 * y bebidas enlazados en Cuiner), compras de los albaranes confirmados y
 * coste de personal de los fichajes (horas × coste/hora de la ficha).
 */
@Injectable()
export class GestionProfitabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
  ) {}

  async dishSales(tenantId: string, range: DateRange): Promise<DishSale[]> {
    assertRange(range);
    const rows = await this.prisma.$queryRaw<
      {
        tipo: string;
        producto: string;
        name: string;
        family: string | null;
        units: number;
        paid: number;
        served: number;
        base: number;
        no_stock: boolean | null;
        total_cost: number | null;
        portions: number | null;
        purchase_price: number | null;
        unit_size: number | null;
        reference_unit: string | null;
        avg_unit_weight: number | null;
        measure_qty: number | null;
        measure_unit: string | null;
      }[]
    >`
      SELECT s.tipo, s.producto, COALESCE(d.nombre, s.producto) AS name, d.familia AS family,
        COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.invitacion), 0)::float8 AS units,
        COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.invitacion AND s.base <> 0), 0)::float8 AS paid,
        COALESCE(SUM(s.unidades), 0)::float8 AS served,
        COALESCE(SUM(s.base), 0)::float8 AS base,
        m."noStock" AS no_stock,
        r."totalCost"::float8 AS total_cost, r.portions::float8 AS portions,
        p."purchasePrice"::float8 AS purchase_price, p."unitSize"::float8 AS unit_size,
        p."referenceUnit" AS reference_unit, p."avgUnitWeight"::float8 AS avg_unit_weight,
        sm.quantity::float8 AS measure_qty, sm.unit AS measure_unit
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      LEFT JOIN cuiner_dish_maps m ON m."tenantId" = s."tenantId" AND m.tipo = s.tipo AND m.producto = s.producto
      LEFT JOIN recipes r ON r.id = m."recipeId" AND r."tenantId" = s."tenantId" AND r."deletedAt" IS NULL
      LEFT JOIN products p ON p.id = m."productId" AND p."tenantId" = s."tenantId" AND p."deletedAt" IS NULL
      LEFT JOIN serving_measures sm ON sm.id = m."servingMeasureId" AND sm."tenantId" = s."tenantId"
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY s.tipo, s.producto, d.nombre, d.familia, m."noStock", r.id, p.id, sm.id`;
    return rows.map((r) => ({
      key: `${r.tipo}-${r.producto}`,
      name: r.name,
      family: r.family,
      type: r.tipo,
      units: r.units,
      paidUnits: r.paid,
      servedUnits: r.served,
      base: r.base,
      unitCost: unitCostOfDish({
        noStock: r.no_stock,
        recipe:
          r.total_cost !== null && r.portions !== null
            ? { totalCost: r.total_cost, portions: r.portions }
            : null,
        product:
          r.purchase_price !== null && r.unit_size !== null
            ? {
                purchasePrice: r.purchase_price,
                unitSize: r.unit_size,
                referenceUnit: r.reference_unit ?? "und",
                avgUnitWeight: r.avg_unit_weight,
              }
            : null,
        measure:
          r.measure_qty !== null && r.measure_unit
            ? { quantity: r.measure_qty, unit: r.measure_unit }
            : null,
      }),
    }));
  }

  /**
   * Compras sin IVA de los albaranes recibidos (confirmados o archivados, sin
   * líneas rechazadas), por proveedor o por
   * categoría del artículo. Se suman las líneas (importe neto del papel, o
   * cantidad × precio si no lo hay): la base de la cabecera no siempre está.
   */
  async purchases(
    tenantId: string,
    range: DateRange,
    groupBy: "supplier" | "category",
  ): Promise<PurchaseRow[]> {
    assertRange(range);
    const group =
      groupBy === "category"
        ? Prisma.sql`COALESCE(c.id, '-'), COALESCE(c.name, 'Sin categoría')`
        : Prisma.sql`COALESCE(sp.id, '-'), COALESCE(sp.name, 'Sin proveedor')`;
    const rows = await this.prisma.$queryRaw<
      { key: string; label: string; albaranes: number; base: number }[]
    >`
      SELECT ${group}, COUNT(DISTINCT a.id)::int AS albaranes,
        COALESCE(SUM(COALESCE(l."totalPrice", l."lineAmount")), 0)::float8 AS base
      FROM albaranes a
      JOIN albaran_lines l ON l."albaranId" = a.id AND l."lineStatus" <> 'RECHAZADO'
      LEFT JOIN suppliers sp ON sp.id = a."supplierId" AND sp."tenantId" = a."tenantId"
      LEFT JOIN products pr ON pr.id = l."matchedProductId" AND pr."tenantId" = a."tenantId"
      LEFT JOIN categories c ON c.id = pr."categoryId"
      WHERE a."tenantId" = ${tenantId} AND a."deletedAt" IS NULL
        AND a.status IN ('CONFIRMADO', 'ARCHIVADO')
        AND a.date >= ${range.from}::date AND a.date < (${range.to}::date + 1)
      GROUP BY 1, 2 ORDER BY base DESC`;
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      albaranes: r.albaranes,
      base: cents(r.base),
    }));
  }

  /** Horas fichadas y coste por persona; null si el rango pasa de un año. */
  async labor(tenantId: string, range: DateRange): Promise<LaborRow[] | null> {
    assertRange(range);
    if (rangeDays(range) > MAX_LABOR_DAYS) {
      return null;
    }
    // Solo quien fichó en el rango (±1 día por los turnos que cruzan la
    // medianoche): calcular jornadas cuesta varias consultas por persona.
    const punched = await this.prisma.timePunch.groupBy({
      by: ["employeeId"],
      where: {
        tenantId,
        occurredAt: {
          gte: new Date(`${addDays(range.from, -1)}T00:00:00Z`),
          lt: new Date(`${addDays(range.to, 2)}T00:00:00Z`),
        },
      },
    });
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, id: { in: punched.map((p) => p.employeeId) } },
      select: { id: true, firstName: true, lastName: true, hourlyCost: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const rows = await mapWithConcurrency(
      employees,
      LABOR_CONCURRENCY,
      async (e) => {
        let minutes = 0;
        for (const window of chunkRange(range, WORKDAYS_MAX_DAYS)) {
          const { days } = await this.workdays.getWorkdays(
            tenantId,
            e.id,
            window.from,
            window.to,
          );
          minutes += days.reduce((n, d) => n + d.workedMinutes, 0);
        }
        // Un coste/hora a 0 es una ficha sin rellenar, no personal gratis.
        const hourlyCost =
          e.hourlyCost !== null && e.hourlyCost > 0 ? e.hourlyCost : null;
        return {
          employeeId: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          minutes,
          hourlyCost,
          cost: hourlyCost === null ? null : cents((minutes / 60) * hourlyCost),
        };
      },
    );
    return rows.filter((r) => r.minutes > 0);
  }
}
