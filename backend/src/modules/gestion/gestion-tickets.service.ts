import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { DateRange, assertRange } from "./gestion-period.util";
import { cents, inRange } from "./gestion-sql.util";

export interface TicketSummary {
  id: number;
  date: string;
  lines: number;
  units: number;
  base: number;
  total: number;
  hasVoids: boolean;
  /** Cabecera del TPV; null si el conector aún no la ha enviado. */
  table: string | null;
  diners: number | null;
  waiter: string | null;
  openedAt: string | null;
}

export interface TicketDetail {
  id: number;
  date: string;
  base: number;
  total: number;
  header: {
    table: string | null;
    diners: number | null;
    shift: string | null;
    openedAt: string | null;
    closedAt: string | null;
    waiter: string | null;
  } | null;
  payments: { method: string; amount: number; voided: boolean }[];
  lines: {
    line: number;
    name: string;
    type: string;
    units: number;
    base: number | null;
    total: number | null;
    voided: boolean;
    invited: boolean;
  }[];
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Tickets del TPV tal y como llegan de Cuiner (número = Id_VentasCab). De
 * momento sin mesa, comensales ni forma de pago: el conector aún no los envía.
 */
@Injectable()
export class GestionTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    range: DateRange,
    page = 1,
    search?: string,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<{
    items: TicketSummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    assertRange(range);
    const term = search?.trim();
    // Número de ticket exacto, o tickets que llevan un plato con ese nombre.
    const filter = !term
      ? Prisma.empty
      : /^\d+$/.test(term)
        ? Prisma.sql`AND s."idVentasCab" = ${Number(term)}`
        : Prisma.sql`AND s."idVentasCab" IN (
            SELECT s2."idVentasCab" FROM cuiner_sale_lines s2
            JOIN cuiner_dishes d ON d."tenantId" = s2."tenantId" AND d.tipo = s2.tipo AND d.producto = s2.producto
            WHERE s2."tenantId" = ${tenantId}
              AND s2.fecha >= ${range.from}::date AND s2.fecha < (${range.to}::date + 1)
              AND d.nombre ILIKE ${`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`})`;
    const offset = (Math.max(page, 1) - 1) * pageSize;
    const [rows, [{ count }]] = await Promise.all([
      this.prisma.$queryRaw<
        {
          id: number;
          date: string;
          lines: number;
          units: number;
          base: number;
          total: number;
          voids: number;
          mesa: string | null;
          comensales: number | null;
          camarero: string | null;
          opened_at: string | null;
        }[]
      >`
        SELECT s."idVentasCab" AS id, to_char(MIN(s.fecha), 'YYYY-MM-DD') AS date,
          (COUNT(*) FILTER (WHERE NOT s.anulada))::int AS lines,
          COALESCE(SUM(s.unidades) FILTER (WHERE NOT s.anulada), 0)::float8 AS units,
          COALESCE(SUM(s.base) FILTER (WHERE NOT s.anulada), 0)::float8 AS base,
          COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)) FILTER (WHERE NOT s.anulada), 0)::float8 AS total,
          (COUNT(*) FILTER (WHERE s.anulada))::int AS voids,
          MAX(ct.mesa) AS mesa, MAX(ct.comensales)::int AS comensales,
          MAX(COALESCE(w.name, 'Camarero ' || ct.camarero)) AS camarero, MAX(ct."openedAt") AS opened_at
        FROM cuiner_sale_lines s
        LEFT JOIN cuiner_tickets ct ON ct."tenantId" = s."tenantId" AND ct."idVentasCab" = s."idVentasCab"
        LEFT JOIN cuiner_waiters w ON w."tenantId" = ct."tenantId" AND w.code = ct.camarero
        WHERE ${inRange(tenantId, range)} AND s.base IS NOT NULL ${filter}
        GROUP BY s."idVentasCab"
        ORDER BY s."idVentasCab" DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT s."idVentasCab")::int AS count
        FROM cuiner_sale_lines s
        WHERE ${inRange(tenantId, range)} AND s.base IS NOT NULL ${filter}`,
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        date: r.date,
        lines: r.lines,
        units: cents(r.units),
        base: cents(r.base),
        total: cents(r.total),
        hasVoids: r.voids > 0,
        table: r.mesa,
        diners: r.comensales,
        waiter: r.camarero,
        openedAt: r.opened_at,
      })),
      total: count,
      page: Math.max(page, 1),
      pageSize: pageSize,
    };
  }

  async detail(tenantId: string, id: number): Promise<TicketDetail> {
    const lines = await this.prisma.$queryRaw<
      {
        line: number;
        date: string;
        name: string;
        type: string;
        units: number;
        base: number | null;
        tax: number | null;
        voided: boolean;
        invited: boolean;
      }[]
    >`
      SELECT s.linea AS line, to_char(s.fecha, 'YYYY-MM-DD') AS date,
        COALESCE(d.nombre, s.producto) AS name, s.tipo AS type,
        s.unidades::float8 AS units, s.base::float8 AS base, s.impuesto::float8 AS tax,
        s.anulada AS voided, s.invitacion AS invited
      FROM cuiner_sale_lines s
      LEFT JOIN cuiner_dishes d ON d."tenantId" = s."tenantId" AND d.tipo = s.tipo AND d.producto = s.producto
      WHERE s."tenantId" = ${tenantId} AND s."idVentasCab" = ${id} AND s.base IS NOT NULL
      ORDER BY s.linea`;
    if (lines.length === 0) {
      throw new NotFoundException("Ticket no encontrado");
    }
    const [header, payments] = await Promise.all([
      this.prisma.cuinerTicket.findUnique({
        where: { tenantId_idVentasCab: { tenantId, idVentasCab: id } },
      }),
      this.prisma.cuinerTicketPayment.findMany({
        where: { tenantId, idVentasCab: id },
        orderBy: { linea: "asc" },
      }),
    ]);
    const waiter = header?.camarero
      ? await this.prisma.cuinerWaiter.findUnique({
          where: {
            tenantId_code: { tenantId, code: header.camarero },
          },
        })
      : null;
    const charged = lines.filter((l) => !l.voided);
    return {
      id,
      date: lines[0].date,
      header: header && {
        table: header.mesa,
        diners: header.comensales,
        shift: header.turno,
        openedAt: header.openedAt,
        closedAt: header.closedAt,
        waiter: header.camarero
          ? (waiter?.name ?? `Camarero ${header.camarero}`)
          : null,
      },
      payments: payments.map((p) => ({
        method: p.formaPago,
        amount: cents(p.importe),
        voided: p.anulada,
      })),
      base: cents(charged.reduce((n, l) => n + (l.base ?? 0), 0)),
      total: cents(
        charged.reduce((n, l) => n + (l.base ?? 0) + (l.tax ?? 0), 0),
      ),
      lines: lines.map((l) => ({
        line: l.line,
        name: l.name,
        type: l.type,
        units: l.units,
        base: l.base === null ? null : cents(l.base),
        total: l.base === null ? null : cents(l.base + (l.tax ?? 0)),
        voided: l.voided,
        invited: l.invited,
      })),
    };
  }
}
