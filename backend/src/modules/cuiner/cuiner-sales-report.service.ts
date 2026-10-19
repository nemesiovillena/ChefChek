import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  DISH_LEVEL,
  NO_FAMILY,
  ReportGroupBy,
  belongsToFamily,
  cents,
  familyAtLevel,
  familyLabel,
  periodLabel,
} from "./cuiner-sales-report-grouping";

export interface SalesReportQuery {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  /** 1-3 nivel de familia, 4 plato a plato. */
  level: number;
  /** Ruta de familia para bajar al detalle («BEBIDAS ALCOHOL-LICORES»). */
  family?: string;
}

export interface SalesReportAmounts {
  units: number;
  /** Unidades servidas como invitación (importe 0). */
  invitedUnits: number;
  /** Sin IVA, con descuentos. */
  base: number;
  /** Con IVA. */
  total: number;
}

export interface SalesReportRow extends SalesReportAmounts {
  /** Ruta de familia o «tipo-producto» del plato. */
  key: string;
  label: string;
  /** Familia del plato en el nivel de plato (para mostrar de dónde cuelga). */
  family?: string;
  /** % del total con IVA del periodo. */
  share: number;
}

export interface SalesReport {
  query: SalesReportQuery;
  periods: {
    key: string;
    label: string;
    rows: SalesReportRow[];
    totals: SalesReportAmounts;
  }[];
  totals: SalesReportAmounts;
  /** Líneas sin importes (recibidas antes de que el conector los enviara). */
  missingAmounts: number;
  history: { done: boolean; oldestDate: string | null };
}

interface AggregateRow {
  period: string;
  tipo: string;
  producto: string;
  nombre: string | null;
  familia: string | null;
  units: number;
  invited: number;
  base: number;
  total: number;
  missing: number;
}

/** date_trunc por agrupación; «total» no trocea (un solo periodo). */
const TRUNC_UNIT: Record<Exclude<ReportGroupBy, "total">, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

const MAX_DAYS_BY_DAY = 400;

const emptyAmounts = (): SalesReportAmounts => ({
  units: 0,
  invitedUnits: 0,
  base: 0,
  total: 0,
});

const addTo = (target: SalesReportAmounts, row: AggregateRow) => {
  target.units += row.units;
  target.invitedUnits += row.invited;
  target.base += row.base;
  target.total += row.total;
};

const rounded = (a: SalesReportAmounts): SalesReportAmounts => ({
  units: cents(a.units),
  invitedUnits: cents(a.invitedUnits),
  base: cents(a.base),
  total: cents(a.total),
});

/**
 * Informe de ventas del TPV de Cuiner por periodo y familia de la carta.
 * Cuenta lo que se cobró: excluye las líneas anuladas (así cuadra con la
 * caja de Cuiner) e incluye el histórico importado. Las invitaciones suman
 * unidades aparte y no importe. La familia es la actual del plato en la carta.
 */
@Injectable()
export class CuinerSalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(tenantId: string, query: SalesReportQuery): Promise<SalesReport> {
    if (query.from > query.to) {
      throw new BadRequestException(
        "La fecha de inicio es posterior a la de fin",
      );
    }
    const days =
      (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 + 1;
    if (query.groupBy === "day" && days > MAX_DAYS_BY_DAY) {
      throw new BadRequestException(
        "Por días se pueden pedir como mucho 400 días: agrupa por semana o mes",
      );
    }

    const [aggregates, config, oldest] = await Promise.all([
      this.aggregate(tenantId, query),
      this.prisma.cuinerConfig.findUnique({
        where: { tenantId },
        select: { historyDone: true },
      }),
      this.prisma.cuinerSaleLine.aggregate({
        where: { tenantId },
        _min: { fecha: true },
      }),
    ]);

    const family = query.family;
    const rows = family
      ? aggregates.filter((r) => belongsToFamily(r.familia, family))
      : aggregates;

    const periods = new Map<
      string,
      { rows: Map<string, SalesReportRow>; totals: SalesReportAmounts }
    >();
    const totals = emptyAmounts();
    for (const row of rows) {
      const period = periods.get(row.period) ?? {
        rows: new Map(),
        totals: emptyAmounts(),
      };
      periods.set(row.period, period);
      const path = familyAtLevel(row.familia, query.level);
      const key =
        query.level >= DISH_LEVEL ? `${row.tipo}-${row.producto}` : path;
      const entry = period.rows.get(key) ?? {
        key,
        label:
          query.level >= DISH_LEVEL
            ? (row.nombre ?? row.producto)
            : path === NO_FAMILY
              ? NO_FAMILY
              : familyLabel(path),
        ...(query.level >= DISH_LEVEL
          ? { family: familyLabel(familyAtLevel(row.familia, 3)) }
          : {}),
        ...emptyAmounts(),
        share: 0,
      };
      addTo(entry, row);
      period.rows.set(key, entry);
      addTo(period.totals, row);
      addTo(totals, row);
    }

    const range = { from: query.from, to: query.to };
    return {
      query,
      periods: [...periods.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, period]) => ({
          key,
          label: periodLabel(query.groupBy, key, range),
          rows: [...period.rows.values()]
            .map((r) => ({
              ...r,
              ...rounded(r),
              share:
                period.totals.total > 0
                  ? cents((r.total / period.totals.total) * 100)
                  : 0,
            }))
            .sort((a, b) => b.total - a.total || b.units - a.units),
          totals: rounded(period.totals),
        })),
      totals: rounded(totals),
      missingAmounts: rows.reduce((n, r) => n + r.missing, 0),
      history: {
        done: config?.historyDone ?? false,
        oldestDate: oldest._min.fecha
          ? oldest._min.fecha.toISOString().slice(0, 10)
          : null,
      },
    };
  }

  /**
   * Suma por periodo y plato en la base de datos. La fecha de venta se guarda
   * a primera hora del día de caja, así que el rango va de las 00:00 del
   * primer día a las 00:00 del día siguiente al último (aprovecha el índice).
   */
  private aggregate(
    tenantId: string,
    query: SalesReportQuery,
  ): Promise<AggregateRow[]> {
    const period =
      query.groupBy === "total"
        ? Prisma.sql`${query.from}::text`
        : Prisma.sql`to_char(date_trunc(${Prisma.raw(`'${TRUNC_UNIT[query.groupBy]}'`)}, s.fecha), 'YYYY-MM-DD')`;
    return this.prisma.$queryRaw<AggregateRow[]>`
      SELECT ${period} AS period, s.tipo, s.producto, d.nombre, d.familia,
        COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.invitacion), 0)::float8 AS units,
        COALESCE(SUM(s.unidades) FILTER (WHERE s.invitacion), 0)::float8 AS invited,
        COALESCE(SUM(s.base), 0)::float8 AS base,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total,
        (COUNT(*) FILTER (WHERE s.base IS NULL))::int AS missing
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d
        ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE s."tenantId" = ${tenantId}
        AND s.anulada = false
        AND s.fecha >= ${query.from}::date
        AND s.fecha < (${query.to}::date + 1)
      GROUP BY 1, 2, 3, 4, 5`;
  }
}
