import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { addDays, deltaPercent } from "./gestion-period.util";
import { CHARGED, cents, inRange } from "./gestion-sql.util";
import {
  CALENDAR_DATE_KINDS,
  CalendarDateKind,
  CalendarRegion,
  suggestedDates,
} from "./gestion-calendar-suggestions.util";

const WEEKDAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];
/** Semanas antes y después con las que se compara un festivo. */
const NORMAL_WINDOW_DAYS = 28;

export interface DayRow {
  date: string;
  /** 1 = lunes … 7 = domingo. */
  dow: number;
  total: number;
  tickets: number;
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

function assertYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new BadRequestException("Año no válido");
  }
}

/**
 * Estacionalidad: cuándo se vende más en el año (calendario día a día, mejores
 * días, media por día de la semana, semanas fuertes de todos los años) y cómo
 * rinden los festivos y fechas importantes frente a un día normal.
 */
@Injectable()
export class GestionSeasonalityService {
  constructor(private readonly prisma: PrismaService) {}

  private async dailySales(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<DayRow[]> {
    const rows = await this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(s.fecha, 'YYYY-MM-DD') AS date, EXTRACT(ISODOW FROM s.fecha)::int AS dow,
        COALESCE(SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)), 0)::float8 AS total,
        (COUNT(DISTINCT s."idVentasCab"))::int AS tickets
      FROM cuiner_sale_lines s
      WHERE ${inRange(tenantId, { from, to })} AND ${CHARGED}
      GROUP BY 1, 2 ORDER BY 1`;
    return rows.map((r) => ({ ...r, total: cents(r.total) }));
  }

  async analysis(tenantId: string, year: number) {
    assertYear(year);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    // Días de alrededor para comparar los festivos de principio y final de año.
    const windowFrom = addDays(from, -NORMAL_WINDOW_DAYS);
    const windowTo = addDays(to, NORMAL_WINDOW_DAYS);
    const [around, weeks, dates, nearbyDates] = await Promise.all([
      this.dailySales(tenantId, windowFrom, windowTo),
      this.strongWeeks(tenantId),
      this.list(tenantId, year),
      // También las fechas señaladas de los años vecinos: Navidad no es un
      // «miércoles normal» para comparar Año Nuevo.
      this.prisma.gestionCalendarDate.findMany({
        where: {
          tenantId,
          date: {
            gte: new Date(`${windowFrom}T00:00:00Z`),
            lte: new Date(`${windowTo}T00:00:00Z`),
          },
        },
        select: { date: true },
      }),
    ]);
    const days = around.filter((d) => d.date >= from && d.date <= to);

    const byWeekday = WEEKDAYS.map((weekday, i) => {
      const list = days.filter((d) => d.dow === i + 1);
      const total = list.reduce((n, d) => n + d.total, 0);
      return {
        weekday,
        daysWithSales: list.length,
        avgTotal: list.length ? cents(total / list.length) : 0,
      };
    });

    const specialDays = new Set(nearbyDates.map((d) => toIso(d.date)));
    const sales = new Map(around.map((d) => [d.date, d]));
    const holidays = dates.map((d) => {
      const day = sales.get(d.date);
      const dow = new Date(`${d.date}T00:00:00Z`).getUTCDay() || 7;
      // Día normal: mismo día de la semana, ±4 semanas, con venta y sin fecha especial.
      const normal = around.filter(
        (a) =>
          a.dow === dow &&
          a.date !== d.date &&
          !specialDays.has(a.date) &&
          Math.abs(Date.parse(a.date) - Date.parse(d.date)) <=
            NORMAL_WINDOW_DAYS * 86_400_000,
      );
      const normalAvg = normal.length
        ? cents(normal.reduce((n, a) => n + a.total, 0) / normal.length)
        : null;
      return {
        id: d.id,
        date: d.date,
        name: d.name,
        kind: d.kind,
        weekday: WEEKDAYS[dow - 1],
        total: day?.total ?? 0,
        tickets: day?.tickets ?? 0,
        /** Sin venta ese día: cerrado, o aún no ha llegado. */
        open: !!day,
        normalAvg,
        deltaPct: day && normalAvg ? deltaPercent(day.total, normalAvg) : null,
      };
    });

    return {
      year,
      days,
      topDays: [...days]
        .sort((a, b) => b.total - a.total)
        .slice(0, 20)
        .map((d) => ({
          ...d,
          weekday: WEEKDAYS[d.dow - 1],
          special: dates.filter((x) => x.date === d.date).map((x) => x.name),
        })),
      byWeekday,
      weeks,
      holidays,
    };
  }

  /** Media de ventas por semana del año (ISO) con todo el histórico, y la del año en curso. */
  private async strongWeeks(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      { week: number; years: number; avg: number; best: number }[]
    >`
      SELECT week, COUNT(*)::int AS years, AVG(total)::float8 AS avg, MAX(total)::float8 AS best
      FROM (
        SELECT EXTRACT(ISOYEAR FROM s.fecha)::int AS y, EXTRACT(WEEK FROM s.fecha)::int AS week,
          SUM(COALESCE(s.base, 0) + COALESCE(s.impuesto, 0)) AS total
        FROM cuiner_sale_lines s
        WHERE s."tenantId" = ${tenantId} AND ${CHARGED}
        GROUP BY 1, 2
      ) w
      GROUP BY week ORDER BY week`;
    return rows.map((r) => ({
      week: r.week,
      years: r.years,
      avgTotal: cents(r.avg),
      bestTotal: cents(r.best),
    }));
  }

  async list(tenantId: string, year: number) {
    assertYear(year);
    const rows = await this.prisma.gestionCalendarDate.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lte: new Date(`${year}-12-31T00:00:00Z`),
        },
      },
      orderBy: [{ date: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      date: toIso(r.date),
      name: r.name,
      kind: r.kind as CalendarDateKind,
    }));
  }

  /** Carga las fechas sugeridas del año; las que ya estén (misma fecha y nombre) no se duplican. */
  async seed(tenantId: string, year: number, region: CalendarRegion) {
    assertYear(year);
    const { count } = await this.prisma.gestionCalendarDate.createMany({
      data: suggestedDates(year, region).map((d) => ({
        tenantId,
        date: new Date(`${d.date}T00:00:00Z`),
        name: d.name,
        kind: d.kind,
      })),
      skipDuplicates: true,
    });
    return { added: count, dates: await this.list(tenantId, year) };
  }

  async create(
    tenantId: string,
    input: { date: string; name: string; kind: string },
  ) {
    if (!CALENDAR_DATE_KINDS.includes(input.kind as CalendarDateKind)) {
      throw new BadRequestException("Tipo de fecha no válido");
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException("Pon un nombre a la fecha");
    }
    // 2025-02-30 no existe: sin esto se guardaba como 2 de marzo.
    const day = new Date(`${input.date}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || toIso(day) !== input.date) {
      throw new BadRequestException("Esa fecha no existe");
    }
    assertYear(day.getUTCFullYear());
    const row = await this.prisma.gestionCalendarDate.upsert({
      where: {
        tenantId_date_name: {
          tenantId,
          date: new Date(`${input.date}T00:00:00Z`),
          name,
        },
      },
      update: { kind: input.kind },
      create: {
        tenantId,
        date: new Date(`${input.date}T00:00:00Z`),
        name,
        kind: input.kind,
      },
    });
    return {
      id: row.id,
      date: toIso(row.date),
      name: row.name,
      kind: row.kind,
    };
  }

  async remove(tenantId: string, id: string) {
    const { count } = await this.prisma.gestionCalendarDate.deleteMany({
      where: { id, tenantId },
    });
    return { deleted: count };
  }
}
