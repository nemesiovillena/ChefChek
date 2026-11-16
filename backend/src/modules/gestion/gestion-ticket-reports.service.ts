import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { DateRange, assertRange } from "./gestion-period.util";
import { CHARGED, cents, inRange } from "./gestion-sql.util";
import type { GestionTable } from "./gestion-table.types";

export const TICKET_REPORT_KEYS = [
  "caja-diaria",
  "franjas-horarias",
  "camareros",
] as const;

const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const esDate = (iso: string) => iso.split("-").reverse().join("/");
const rangeText = (r: DateRange) => `${esDate(r.from)} – ${esDate(r.to)}`;
const NO_TICKET_DATA =
  "Sin cabeceras de ticket en este periodo: llegan con la versión del conector que envía mesa, comensales, horas y cobros.";

/**
 * Importe con IVA de cada ticket cobrado según sus líneas (mismo criterio que
 * el panel), unido a su cabecera (mesa, comensales, turno, horas, camarero).
 */
export function ticketTotals(tenantId: string, range: DateRange) {
  return Prisma.sql`
    WITH totals AS (
      SELECT s."idVentasCab" AS id, to_char(MIN(s.fecha), 'YYYY-MM-DD') AS day,
        SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)) AS total
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, range)} AND ${CHARGED}
      GROUP BY 1
    )
    SELECT t.id, t.day, t.total, ct.comensales, ct.turno, ct."openedAt",
      CASE WHEN ct.camarero IS NULL THEN NULL
        ELSE COALESCE(w.name, 'Camarero ' || ct.camarero) END AS camarero
    FROM totals t
    JOIN cuiner_tickets ct ON ct."tenantId" = ${tenantId} AND ct."idVentasCab" = t.id
    LEFT JOIN cuiner_waiters w ON w."tenantId" = ct."tenantId" AND w.code = ct.camarero`;
}

/** Desde esta hora de apertura de la mesa el ticket es una cena. */
const DINNER_FROM_HOUR = 18;

/**
 * Comida o cena según la hora de apertura de la mesa: el TPV de Cuiner puede
 * marcar todo como COMIDAS. Sin hora, se usa el turno del TPV.
 */
function shiftOf(t: TicketRow): "COMIDAS" | "CENAS" {
  if (t.openedAt) {
    const h = Number(t.openedAt.slice(0, 2));
    // De madrugada (antes de las 6) sigue siendo la cena de la noche anterior.
    return h >= DINNER_FROM_HOUR || h < 6 ? "CENAS" : "COMIDAS";
  }
  return (t.turno ?? "").toUpperCase() === "CENAS" ? "CENAS" : "COMIDAS";
}

/** El día de un restaurante empieza por la mañana: la madrugada va al final. */
const dayOrder = (h: number) => (h < 6 ? h + 24 : h);

interface TicketRow {
  id: number;
  day: string;
  total: number;
  comensales: number | null;
  turno: string | null;
  openedAt: string | null;
  camarero: string | null;
}

/** Informes de caja y sala con las cabeceras de ticket y los cobros de Cuiner. */
@Injectable()
export class GestionTicketReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    tenantId: string,
    key: string,
    q: Partial<DateRange>,
  ): Promise<GestionTable> {
    if (!q.from || !q.to) {
      throw new BadRequestException("Indica las fechas del informe");
    }
    const range = { from: q.from, to: q.to };
    assertRange(range);
    const tickets = await this.prisma.$queryRaw<
      TicketRow[]
    >`${ticketTotals(tenantId, range)}`;
    switch (key) {
      case "caja-diaria":
        return this.dailyCash(tenantId, range, tickets);
      case "franjas-horarias":
        return this.hourly(range, tickets);
      case "camareros":
        return this.waiters(range, tickets);
      default:
        throw new BadRequestException(`Informe desconocido: ${key}`);
    }
  }

  /** Cierre de cada día: tickets, comensales, gasto por comensal, comidas/cenas y cobros por forma de pago. */
  private async dailyCash(
    tenantId: string,
    range: DateRange,
    tickets: TicketRow[],
  ): Promise<GestionTable> {
    const payments = await this.prisma.$queryRaw<
      { day: string; forma: string; importe: number }[]
    >`
      SELECT to_char(ct.fecha, 'YYYY-MM-DD') AS day, p."formaPago" AS forma, SUM(p.importe)::float8 AS importe
      FROM cuiner_ticket_payments p
      JOIN cuiner_tickets ct ON ct."tenantId" = p."tenantId" AND ct."idVentasCab" = p."idVentasCab"
      WHERE p."tenantId" = ${tenantId} AND p.anulada = false
        AND ct.fecha >= ${range.from}::date AND ct.fecha < (${range.to}::date + 1)
        AND p."idVentasCab" IN (
          SELECT s."idVentasCab" FROM cuiner_sale_lines s
          WHERE ${inRange(tenantId, range)} AND ${CHARGED}
        )
      GROUP BY 1, 2`;
    const formas = [...new Set(payments.map((p) => p.forma))].sort();
    const days = [...new Set(tickets.map((t) => t.day))].sort();
    const rows = days.map((day) => {
      const list = tickets.filter((t) => t.day === day);
      const total = list.reduce((n, t) => n + t.total, 0);
      const diners = list.reduce((n, t) => n + (t.comensales ?? 0), 0);
      const withDiners = list
        .filter((t) => (t.comensales ?? 0) > 0)
        .reduce((n, t) => n + t.total, 0);
      const byShift = (s: "COMIDAS" | "CENAS") =>
        list.filter((t) => shiftOf(t) === s).reduce((n, t) => n + t.total, 0);
      const row: Record<string, string | number | null> = {
        day: esDate(day),
        tickets: list.length,
        diners,
        perDiner: diners > 0 ? cents(withDiners / diners) : null,
        lunch: cents(byShift("COMIDAS")),
        dinner: cents(byShift("CENAS")),
        total: cents(total),
      };
      for (const f of formas) {
        row[`pay_${f}`] = cents(
          payments
            .filter((p) => p.day === day && p.forma === f)
            .reduce((n, p) => n + p.importe, 0),
        );
      }
      return row;
    });
    const sum = (k: string) =>
      cents(rows.reduce((n, r) => n + ((r[k] as number) ?? 0), 0));
    const totalDiners = rows.reduce((n, r) => n + (r.diners as number), 0);
    const totals: Record<string, string | number | null> = {
      day: "Total",
      tickets: rows.reduce((n, r) => n + (r.tickets as number), 0),
      diners: totalDiners,
      perDiner:
        totalDiners > 0
          ? cents(
              tickets
                .filter((t) => (t.comensales ?? 0) > 0)
                .reduce((n, t) => n + t.total, 0) / totalDiners,
            )
          : null,
      lunch: sum("lunch"),
      dinner: sum("dinner"),
      total: sum("total"),
    };
    for (const f of formas) {
      totals[`pay_${f}`] = sum(`pay_${f}`);
    }
    return {
      key: "caja-diaria",
      title: "Caja diaria",
      subtitle: `${rangeText(range)} · con IVA`,
      columns: [
        { key: "day", label: "Día", kind: "text" },
        { key: "tickets", label: "Tickets", kind: "int" },
        { key: "diners", label: "Comensales", kind: "int" },
        { key: "perDiner", label: "Gasto/comensal", kind: "euros" },
        { key: "lunch", label: "Comidas", kind: "euros" },
        { key: "dinner", label: "Cenas", kind: "euros" },
        { key: "total", label: "Ventas", kind: "euros" },
        ...formas.map((f) => ({
          key: `pay_${f}`,
          label: f.charAt(0) + f.slice(1).toLowerCase(),
          kind: "euros" as const,
        })),
      ],
      rows,
      totals,
      notes: [
        ...(tickets.length === 0 ? [NO_TICKET_DATA] : []),
        "Ventas = líneas cobradas de los tickets; cobros = formas de pago registradas en el TPV (pueden diferir por redondeos, propinas o cobros parciales).",
        "Gasto por comensal solo con los tickets que tienen comensales (barra sin comensales no cuenta).",
        `Comidas y cenas por la hora de apertura de la mesa (cena desde las ${DINNER_FROM_HOUR}:00).`,
      ],
    };
  }

  /** Ventas por hora de apertura de la mesa y día de la semana. */
  private hourly(range: DateRange, tickets: TicketRow[]): GestionTable {
    const withHour = tickets.filter((t) => t.openedAt);
    const hours = [
      ...new Set(withHour.map((t) => Number(t.openedAt!.slice(0, 2)))),
    ].sort((a, b) => dayOrder(a) - dayOrder(b));
    const weekdayOf = (day: string) =>
      (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const rows = hours.map((h) => {
      const list = withHour.filter(
        (t) => Number(t.openedAt!.slice(0, 2)) === h,
      );
      const row: Record<string, string | number | null> = {
        hour: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`,
      };
      WEEKDAYS.forEach((_, i) => {
        row[`d${i}`] = cents(
          list
            .filter((t) => weekdayOf(t.day) === i)
            .reduce((n, t) => n + t.total, 0),
        );
      });
      row.tickets = list.length;
      row.total = cents(list.reduce((n, t) => n + t.total, 0));
      return row;
    });
    const totals: Record<string, string | number | null> = { hour: "Total" };
    WEEKDAYS.forEach((_, i) => {
      totals[`d${i}`] = cents(
        rows.reduce((n, r) => n + (r[`d${i}`] as number), 0),
      );
    });
    totals.tickets = withHour.length;
    totals.total = cents(withHour.reduce((n, t) => n + t.total, 0));
    return {
      key: "franjas-horarias",
      title: "Ventas por franja horaria",
      subtitle: `${rangeText(range)} · hora de apertura de la mesa`,
      columns: [
        { key: "hour", label: "Franja", kind: "text" },
        ...WEEKDAYS.map((w, i) => ({
          key: `d${i}`,
          label: w,
          kind: "euros" as const,
        })),
        { key: "tickets", label: "Tickets", kind: "int" },
        { key: "total", label: "Total", kind: "euros" },
      ],
      rows,
      totals,
      notes: [
        ...(tickets.length === 0 ? [NO_TICKET_DATA] : []),
        "Cada ticket cuenta en la hora en que se abrió la mesa; con IVA.",
      ],
    };
  }

  /** Ventas por camarero (usuario del TPV que abrió el ticket). */
  private waiters(range: DateRange, tickets: TicketRow[]): GestionTable {
    const names = [...new Set(tickets.map((t) => t.camarero ?? "—"))];
    const rows = names
      .map((name) => {
        const list = tickets.filter((t) => (t.camarero ?? "—") === name);
        const total = list.reduce((n, t) => n + t.total, 0);
        const diners = list.reduce((n, t) => n + (t.comensales ?? 0), 0);
        return {
          name: name === "—" ? "Sin camarero" : name,
          tickets: list.length,
          diners,
          total: cents(total),
          avgTicket: list.length ? cents(total / list.length) : null,
          perDiner:
            diners > 0
              ? cents(
                  list
                    .filter((t) => (t.comensales ?? 0) > 0)
                    .reduce((n, t) => n + t.total, 0) / diners,
                )
              : null,
        };
      })
      .sort((a, b) => b.total - a.total);
    return {
      key: "camareros",
      title: "Ventas por camarero",
      subtitle: `${rangeText(range)} · con IVA`,
      columns: [
        { key: "name", label: "Camarero", kind: "text" },
        { key: "tickets", label: "Tickets", kind: "int" },
        { key: "diners", label: "Comensales", kind: "int" },
        { key: "total", label: "Ventas", kind: "euros" },
        { key: "avgTicket", label: "Ticket medio", kind: "euros" },
        { key: "perDiner", label: "Gasto/comensal", kind: "euros" },
      ],
      rows,
      totals: {
        name: "Total",
        tickets: tickets.length,
        diners: rows.reduce((n, r) => n + r.diners, 0),
        total: cents(rows.reduce((n, r) => n + r.total, 0)),
        avgTicket: null,
        perDiner: null,
      },
      notes: [
        ...(tickets.length === 0 ? [NO_TICKET_DATA] : []),
        "Camarero = usuario del TPV de Cuiner que abrió el ticket (nombre de su ficha de personal en Cuiner).",
      ],
    };
  }
}
