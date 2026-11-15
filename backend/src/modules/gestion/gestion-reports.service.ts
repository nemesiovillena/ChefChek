import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { DateRange, assertRange } from "./gestion-period.util";
import { CHARGED, NO_FAMILY_LABEL, cents, inRange } from "./gestion-sql.util";
import type { GestionTable } from "./gestion-table.types";

export const GESTION_REPORT_KEYS = [
  "ranking",
  "interanual",
  "anulaciones",
  "iva",
] as const;
export type GestionReportKey = (typeof GESTION_REPORT_KEYS)[number];

export interface GestionReportQuery extends Partial<DateRange> {
  /** ranking: total | units. */
  by?: "total" | "units";
  /** ranking: desc = más vendidos, asc = menos vendidos. */
  order?: "desc" | "asc";
  limit?: number;
  /** interanual: último año y cuántos años hacia atrás. */
  year?: number;
  years?: number;
  /** anulaciones / iva. */
  groupBy?: "day" | "month" | "dish" | "total";
}

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const esDate = (iso: string) => iso.split("-").reverse().join("/");
const rangeText = (r: DateRange) => `${esDate(r.from)} – ${esDate(r.to)}`;
const LINE_TOTAL = Prisma.sql`COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)`;

/** Informes de ventas de Gestión, todos con la misma forma de tabla. */
@Injectable()
export class GestionReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    tenantId: string,
    key: string,
    q: GestionReportQuery,
  ): Promise<GestionTable> {
    switch (key) {
      case "ranking":
        return this.ranking(tenantId, this.range(q), q);
      case "interanual":
        return this.yearOverYear(tenantId, q);
      case "anulaciones":
        return this.voids(
          tenantId,
          this.range(q),
          q.groupBy === "dish" ? "dish" : "day",
        );
      case "iva":
        return this.vat(
          tenantId,
          this.range(q),
          q.groupBy === "day"
            ? "day"
            : q.groupBy === "total"
              ? "total"
              : "month",
        );
      default:
        throw new BadRequestException(`Informe desconocido: ${key}`);
    }
  }

  private range(q: GestionReportQuery): DateRange {
    if (!q.from || !q.to) {
      throw new BadRequestException("Indica las fechas del informe");
    }
    const range = { from: q.from, to: q.to };
    assertRange(range);
    return range;
  }

  private async ranking(
    tenantId: string,
    range: DateRange,
    q: GestionReportQuery,
  ): Promise<GestionTable> {
    const by = q.by === "units" ? "units" : "total";
    const dir = Prisma.raw(q.order === "asc" ? "ASC" : "DESC");
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
    const rows = await this.prisma.$queryRaw<
      {
        name: string;
        family: string | null;
        units: number;
        base: number;
        total: number;
      }[]
    >`
      SELECT COALESCE(d.nombre, s.producto) AS name, d.familia AS family,
        COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.invitacion), 0)::float8 AS units,
        COALESCE(SUM(s.base), 0)::float8 AS base,
        COALESCE(SUM(${LINE_TOTAL}), 0)::float8 AS total
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY s.tipo, s.producto, 1, 2
      ORDER BY ${Prisma.raw(by)} ${dir}, name
      LIMIT ${limit}`;
    const [{ sum }] = await this.prisma.$queryRaw<{ sum: number }[]>`
      SELECT COALESCE(SUM(${LINE_TOTAL}), 0)::float8 AS sum FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}`;
    return {
      key: "ranking",
      title:
        q.order === "asc" ? "Platos menos vendidos" : "Platos más vendidos",
      subtitle: `${rangeText(range)} · por ${by === "units" ? "unidades" : "importe"}`,
      columns: [
        { key: "pos", label: "#", kind: "int" },
        { key: "name", label: "Plato", kind: "text" },
        { key: "family", label: "Familia", kind: "text" },
        { key: "units", label: "Unidades", kind: "qty" },
        { key: "base", label: "Base", kind: "euros" },
        { key: "total", label: "Total con IVA", kind: "euros" },
        { key: "share", label: "% ventas", kind: "percent" },
      ],
      rows: rows.map((r, i) => ({
        pos: i + 1,
        name: r.name,
        family: r.family ? r.family.split("-").join(" › ") : NO_FAMILY_LABEL,
        units: cents(r.units),
        base: cents(r.base),
        total: cents(r.total),
        share: sum > 0 ? cents((r.total / sum) * 100) : 0,
      })),
      notes: [
        "Los platos de un menú cuentan unidades; el importe va en la línea del menú.",
        ...(q.order === "asc"
          ? ["Solo aparecen platos con alguna venta en el periodo."]
          : []),
      ],
    };
  }

  /** Ventas con IVA mes a mes de varios años seguidos, con la variación del último. */
  private async yearOverYear(
    tenantId: string,
    q: GestionReportQuery,
  ): Promise<GestionTable> {
    const last = q.year ?? new Date().getFullYear();
    const count = Math.min(Math.max(q.years ?? 3, 2), 10);
    const years = Array.from({ length: count }, (_, i) => last - count + 1 + i);
    const range = { from: `${years[0]}-01-01`, to: `${last}-12-31` };
    const data = await this.prisma.$queryRaw<
      { y: number; m: number; total: number }[]
    >`
      SELECT EXTRACT(YEAR FROM s.fecha)::int AS y, EXTRACT(MONTH FROM s.fecha)::int AS m,
        COALESCE(SUM(${LINE_TOTAL}), 0)::float8 AS total
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1, 2`;
    const value = (y: number, m: number) =>
      cents(data.find((d) => d.y === y && d.m === m)?.total ?? 0);
    const prev = years[years.length - 2];
    const pct = (a: number, b: number) =>
      b ? cents(((a - b) / b) * 100) : null;
    // Año en curso: los meses que aún no han llegado no se comparan (no son
    // un -100 %) y el total compara solo de enero al mes actual.
    const now = new Date();
    const lastMonth =
      last === now.getFullYear()
        ? now.getMonth() + 1
        : last > now.getFullYear()
          ? 0
          : 12;
    const rows = MONTHS.map((label, i) => {
      const row: Record<string, string | number | null> = { month: label };
      for (const y of years) {
        row[`y${y}`] = value(y, i + 1);
      }
      row.delta =
        i + 1 <= lastMonth ? pct(value(last, i + 1), value(prev, i + 1)) : null;
      return row;
    });
    const totals: Record<string, string | number | null> = { month: "Total" };
    for (const y of years) {
      totals[`y${y}`] = cents(
        rows.reduce((n, r) => n + (r[`y${y}`] as number), 0),
      );
    }
    const upTo = (y: number) =>
      rows.slice(0, lastMonth).reduce((n, r) => n + (r[`y${y}`] as number), 0);
    totals.delta = pct(cents(upTo(last)), cents(upTo(prev)));
    return {
      key: "interanual",
      title: "Comparativa interanual",
      subtitle: `${years[0]}–${last} · ventas con IVA por mes`,
      columns: [
        { key: "month", label: "Mes", kind: "text" },
        ...years.map((y) => ({
          key: `y${y}`,
          label: String(y),
          kind: "euros" as const,
        })),
        { key: "delta", label: `${last} vs ${prev}`, kind: "percent" },
      ],
      rows,
      totals,
      notes:
        lastMonth > 0 && lastMonth < 12
          ? [
              `${last} va por ${MONTHS[lastMonth - 1].toLowerCase()} (mes en curso incompleto): la variación del total compara de enero a ${MONTHS[lastMonth - 1].toLowerCase()} de ambos años.`,
            ]
          : [],
    };
  }

  private async voids(
    tenantId: string,
    range: DateRange,
    groupBy: "day" | "dish",
  ): Promise<GestionTable> {
    const group =
      groupBy === "dish"
        ? Prisma.sql`COALESCE(d.nombre, s.producto)`
        : Prisma.sql`to_char(s.fecha, 'YYYY-MM-DD')`;
    const rows = await this.prisma.$queryRaw<
      {
        label: string;
        voided_units: number;
        voided_total: number;
        invited_units: number;
      }[]
    >`
      SELECT ${group} AS label,
        COALESCE(SUM(s.unidades) FILTER (WHERE s.anulada), 0)::float8 AS voided_units,
        COALESCE(SUM(${LINE_TOTAL}) FILTER (WHERE s.anulada), 0)::float8 AS voided_total,
        COALESCE(SUM(s.unidades) FILTER (WHERE s.invitacion AND ${CHARGED}), 0)::float8 AS invited_units
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE ${inRange(tenantId, range)} AND s.base IS NOT NULL AND (s.anulada OR s.invitacion)
      GROUP BY 1
      ORDER BY ${groupBy === "dish" ? Prisma.sql`voided_total DESC, invited_units DESC` : Prisma.sql`1`}`;
    const mapped = rows.map((r) => ({
      label: groupBy === "day" ? esDate(r.label) : r.label,
      voidedUnits: cents(r.voided_units),
      voidedTotal: cents(r.voided_total),
      invitedUnits: cents(r.invited_units),
    }));
    const sum = (k: "voidedUnits" | "voidedTotal" | "invitedUnits") =>
      cents(mapped.reduce((n, r) => n + r[k], 0));
    return {
      key: "anulaciones",
      title: "Anulaciones e invitaciones",
      subtitle: `${rangeText(range)} · por ${groupBy === "dish" ? "plato" : "día"}`,
      columns: [
        {
          key: "label",
          label: groupBy === "dish" ? "Plato" : "Día",
          kind: "text",
        },
        { key: "voidedUnits", label: "Uds. anuladas", kind: "qty" },
        { key: "voidedTotal", label: "Importe anulado", kind: "euros" },
        { key: "invitedUnits", label: "Uds. invitadas", kind: "qty" },
      ],
      rows: mapped,
      totals: {
        label: "Total",
        voidedUnits: sum("voidedUnits"),
        voidedTotal: sum("voidedTotal"),
        invitedUnits: sum("invitedUnits"),
      },
      notes: ["Las invitaciones se sirven a 0 €: cuentan solo unidades."],
    };
  }

  /** IVA repercutido por tipo. El tipo se deduce de cuota / base de cada línea. */
  private async vat(
    tenantId: string,
    range: DateRange,
    groupBy: "day" | "month" | "total",
  ): Promise<GestionTable> {
    const period =
      groupBy === "total"
        ? Prisma.sql`'Total'`
        : Prisma.sql`to_char(date_trunc(${Prisma.raw(`'${groupBy}'`)}, s.fecha), 'YYYY-MM-DD')`;
    const rows = await this.prisma.$queryRaw<
      { period: string; rate: number | null; base: number; tax: number }[]
    >`
      SELECT ${period} AS period,
        CASE WHEN s.base <> 0 THEN ROUND((s.impuesto / s.base * 100)::numeric)::float8 END AS rate,
        COALESCE(SUM(s.base), 0)::float8 AS base,
        COALESCE(SUM(s.impuesto), 0)::float8 AS tax
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED} AND s.base IS NOT NULL AND s.base <> 0
      GROUP BY 1, 2 ORDER BY 1, 2`;
    const label = (p: string) =>
      groupBy === "total"
        ? p
        : groupBy === "day"
          ? esDate(p)
          : `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
    const mapped = rows.map((r) => ({
      period: label(r.period),
      rate: r.rate === null ? "—" : `${r.rate} %`,
      base: cents(r.base),
      tax: cents(r.tax),
      total: cents(r.base + r.tax),
    }));
    const sum = (k: "base" | "tax" | "total") =>
      cents(mapped.reduce((n, r) => n + r[k], 0));
    return {
      key: "iva",
      title: "IVA repercutido",
      subtitle: `${rangeText(range)} · por ${groupBy === "day" ? "día" : groupBy === "month" ? "mes" : "tipo"}`,
      columns: [
        { key: "period", label: "Periodo", kind: "text" },
        { key: "rate", label: "Tipo", kind: "text" },
        { key: "base", label: "Base imponible", kind: "euros" },
        { key: "tax", label: "Cuota IVA", kind: "euros" },
        { key: "total", label: "Total", kind: "euros" },
      ],
      rows: mapped,
      totals: {
        period: "Total",
        rate: "",
        base: sum("base"),
        tax: sum("tax"),
        total: sum("total"),
      },
      notes: [
        "Tipo deducido de cuota / base de cada línea; las líneas a 0 € (invitaciones, platos de menú) no suman.",
      ],
    };
  }
}
