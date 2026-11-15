import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  Bucket,
  CompareMode,
  DateRange,
  assertRange,
  bucketFor,
  comparisonAlignment,
  comparisonRange,
  deltaPercent,
} from "./gestion-period.util";
import { CHARGED, NO_FAMILY_LABEL, cents, inRange } from "./gestion-sql.util";

export interface DashboardKpis {
  /** Con IVA. */
  total: number;
  /** Sin IVA, con descuentos. */
  base: number;
  tickets: number;
  avgTicket: number;
  /** Importe con IVA de las líneas anuladas. */
  voidedTotal: number;
  invitedUnits: number;
  /** Líneas sin importe (anteriores a que el conector enviara importes). */
  missingAmounts: number;
}

export interface SeriesPoint {
  key: string;
  total: number;
  tickets: number;
  /** Solo en la serie de comparación: tramo del periodo actual al que equivale. */
  alignedKey?: string;
}

export interface DashboardResponse {
  range: DateRange;
  compare: { mode: CompareMode; range: DateRange };
  bucket: Bucket;
  kpis: DashboardKpis;
  compareKpis: DashboardKpis;
  /** Variación en % de cada KPI frente al periodo de comparación. */
  deltas: Record<keyof DashboardKpis, number | null>;
  series: SeriesPoint[];
  compareSeries: SeriesPoint[];
  topDishes: { key: string; name: string; units: number; total: number }[];
  families: { family: string; total: number; share: number }[];
}

interface KpiRow {
  total: number;
  base: number;
  tickets: number;
  voided_total: number;
  invited_units: number;
  missing: number;
}

/**
 * Panel de Gestión: KPIs de ventas del TPV (Cuiner) de un rango frente a otro,
 * evolución, platos más vendidos y reparto por familia. Cuenta lo cobrado:
 * fuera las líneas anuladas (así cuadra con la caja de Cuiner).
 */
@Injectable()
export class GestionDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    tenantId: string,
    range: DateRange,
    mode: CompareMode,
  ): Promise<DashboardResponse> {
    assertRange(range);
    const compare = comparisonRange(range, mode);
    const bucket = bucketFor(range);
    const [kpis, compareKpis, series, compareSeries, topDishes, families] =
      await Promise.all([
        this.kpis(tenantId, range),
        this.kpis(tenantId, compare),
        this.series(tenantId, range, bucket),
        this.series(tenantId, compare, bucket),
        this.topDishes(tenantId, range),
        this.families(tenantId, range),
      ]);
    const deltas = Object.fromEntries(
      (Object.keys(kpis) as (keyof DashboardKpis)[]).map((k) => [
        k,
        deltaPercent(kpis[k], compareKpis[k]),
      ]),
    ) as DashboardResponse["deltas"];
    return {
      range,
      compare: { mode, range: compare },
      bucket,
      kpis,
      compareKpis,
      deltas,
      series,
      compareSeries: this.alignSeries(
        compareSeries,
        range,
        compare,
        mode,
        bucket,
      ),
      topDishes,
      families,
    };
  }

  /** Cada punto de la comparación con su tramo actual; sin pareja, fuera. */
  private alignSeries(
    points: SeriesPoint[],
    range: DateRange,
    compare: DateRange,
    mode: CompareMode,
    bucket: Bucket,
  ): SeriesPoint[] {
    const map = comparisonAlignment(range, compare, mode, bucket);
    return points.flatMap((p) => {
      const aligned = map.get(p.key);
      return aligned ? [{ ...p, alignedKey: aligned }] : [];
    });
  }

  private async kpis(tenantId: string, range: DateRange) {
    const [row] = await this.prisma.$queryRaw<KpiRow[]>`
      SELECT
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)) FILTER (WHERE ${CHARGED}), 0)::float8 AS total,
        COALESCE(SUM(s.base) FILTER (WHERE ${CHARGED}), 0)::float8 AS base,
        (COUNT(DISTINCT s."idVentasCab") FILTER (WHERE ${CHARGED}))::int AS tickets,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)) FILTER (WHERE s.anulada), 0)::float8 AS voided_total,
        COALESCE(SUM(s.unidades) FILTER (WHERE s.invitacion AND ${CHARGED}), 0)::float8 AS invited_units,
        (COUNT(*) FILTER (WHERE s.base IS NULL AND NOT s.anulada))::int AS missing
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)}`;
    const tickets = row?.tickets ?? 0;
    const total = row?.total ?? 0;
    return {
      total: cents(total),
      base: cents(row?.base ?? 0),
      tickets,
      avgTicket: tickets ? cents(total / tickets) : 0,
      voidedTotal: cents(row?.voided_total ?? 0),
      invitedUnits: cents(row?.invited_units ?? 0),
      missingAmounts: row?.missing ?? 0,
    };
  }

  private async series(
    tenantId: string,
    range: DateRange,
    bucket: Bucket,
  ): Promise<SeriesPoint[]> {
    const rows = await this.prisma.$queryRaw<SeriesPoint[]>`
      SELECT to_char(date_trunc(${Prisma.raw(`'${bucket}'`)}, s.fecha), 'YYYY-MM-DD') AS key,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total,
        (COUNT(DISTINCT s."idVentasCab"))::int AS tickets
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1 ORDER BY 1`;
    return rows.map((r) => ({ ...r, total: cents(r.total) }));
  }

  private async topDishes(tenantId: string, range: DateRange) {
    const rows = await this.prisma.$queryRaw<
      { key: string; name: string; units: number; total: number }[]
    >`
      SELECT s.tipo || '-' || s.producto AS key, COALESCE(d.nombre, s.producto) AS name,
        COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.invitacion), 0)::float8 AS units,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d
        ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1, 2 ORDER BY total DESC, units DESC LIMIT 10`;
    return rows.map((r) => ({
      ...r,
      units: cents(r.units),
      total: cents(r.total),
    }));
  }

  /** Reparto por familia de primer nivel («VINOS-VINO TINTO-COPA» → VINOS). */
  private async families(tenantId: string, range: DateRange) {
    const rows = await this.prisma.$queryRaw<
      { family: string | null; total: number }[]
    >`
      SELECT NULLIF(split_part(d.familia, '-', 1), '') AS family,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d
        ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1 ORDER BY total DESC`;
    const sum = rows.reduce((n, r) => n + r.total, 0);
    return rows.map((r) => ({
      family: r.family?.trim() || NO_FAMILY_LABEL,
      total: cents(r.total),
      share: sum > 0 ? cents((r.total / sum) * 100) : 0,
    }));
  }

  /**
   * Cuándo se vende más: los mejores días del rango y la media por día de la
   * semana (solo días con venta, así los días de cierre no hunden la media).
   */
  async calendar(tenantId: string, range: DateRange, limit = 10) {
    assertRange(range);
    const days = await this.prisma.$queryRaw<
      { day: string; dow: number; total: number; tickets: number }[]
    >`
      SELECT to_char(s.fecha, 'YYYY-MM-DD') AS day, EXTRACT(ISODOW FROM s.fecha)::int AS dow,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total,
        (COUNT(DISTINCT s."idVentasCab"))::int AS tickets
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1, 2`;
    const WEEKDAYS = [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
      "domingo",
    ];
    const byWeekday = WEEKDAYS.map((weekday, i) => {
      const list = days.filter((d) => d.dow === i + 1);
      const total = list.reduce((n, d) => n + d.total, 0);
      return {
        weekday,
        daysWithSales: list.length,
        avgTotal: list.length ? cents(total / list.length) : 0,
        avgTickets: list.length
          ? Math.round(
              (list.reduce((n, d) => n + d.tickets, 0) / list.length) * 10,
            ) / 10
          : 0,
      };
    });
    const topDays = [...days]
      .sort((a, b) => b.total - a.total)
      .slice(0, Math.min(Math.max(limit, 1), 50))
      .map((d) => ({
        date: d.day,
        weekday: WEEKDAYS[d.dow - 1],
        total: cents(d.total),
        tickets: d.tickets,
      }));
    return { range, daysWithSales: days.length, topDays, byWeekday };
  }
}
