import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  AdjustmentWithDecision,
  AdjustmentsService,
} from "./adjustments.service";
import { MonthTotals, WorkdaysService, fullName } from "./workdays.service";
import { currentPositionTitles } from "../../users/current-position-titles";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Máximo de días de un informe por fechas (un año). */
export const MAX_RANGE_DAYS = 366;

/**
 * Periodo del informe: un mes natural o, con `from` y `to` (AAAA-MM-DD, ambas
 * incluidas), un rango de fechas libre. year/month siguen indicando el mes de
 * referencia (el de `from`).
 */
export interface ReportPeriodQuery {
  year: number;
  month: number;
  from?: string;
  to?: string;
}

export interface ReportPeriod {
  kind: "month" | "range";
  /** Fechas locales AAAA-MM-DD, ambas incluidas. */
  from: string;
  to: string;
  /** "octubre de 2026" o "del 26 de octubre al 1 de noviembre de 2026". */
  label: string;
  /** Para los textos: "del mes" / "del periodo". */
  ofThe: string;
}

/** Datos del registro de jornada de una persona en un periodo, listos para exportar. */
export interface WorkdayReport {
  company: { name: string; taxId: string | null; address: string | null };
  center: string | null;
  employee: {
    id: string;
    name: string;
    nationalId: string | null;
    socialSecurityNumber: string | null;
    jobTitle: string | null;
    weeklyHours: number;
  };
  year: number;
  month: number;
  period: ReportPeriod;
  timezone: string;
  days: Awaited<ReturnType<WorkdaysService["getMonth"]>>["days"];
  totals: MonthTotals;
  /** Correcciones que afectan a fichajes del periodo, con su decisión. */
  corrections: AdjustmentWithDecision[];
  /** Hoja aprobada vigente y conformidad del empleado (solo informes mensuales). */
  approval: {
    version: number;
    approvedByName: string;
    approvedAt: Date;
    acknowledgedAt: Date | null;
  } | null;
}

/**
 * Reúne el registro de jornada de un mes. No formatea: PDF, Excel y CSV
 * parten de esta misma estructura (report-export.service.ts), de modo que un
 * futuro formato oficial solo exige otro exportador.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  /** Informe de una persona. */
  async build(
    tenantId: string,
    employeeId: string,
    query: ReportPeriodQuery,
  ): Promise<WorkdayReport> {
    const { year, month } = query;
    const period = resolvePeriod(query);
    const isMonth = period.kind === "month";
    const [tenant, employee, periodData, allAdjustments, sheet] =
      await Promise.all([
        this.prisma.tenant.findUnique({ where: { id: tenantId } }),
        this.prisma.employee.findFirstOrThrow({
          where: { id: employeeId, tenantId },
          include: { defaultLocation: { select: { name: true } } },
        }),
        this.workdays.getPeriod(tenantId, employeeId, period.from, period.to),
        this.adjustments.listAllForEmployee(tenantId, employeeId),
        // La hoja se aprueba por meses: un informe por fechas no la arrastra.
        isMonth
          ? this.prisma.timesheet.findFirst({
              where: { tenantId, employeeId, year, month },
              orderBy: { version: "desc" },
            })
          : null,
      ]);
    const ack = sheet
      ? await this.prisma.timesheetAck.findUnique({
          where: { timesheetId: sheet.id },
        })
      : null;
    // Puesto vigente de su cuenta en Empleados → Puestos.
    const positionTitle =
      (employee.userId &&
        (
          await currentPositionTitles(this.prisma, tenantId, [employee.userId])
        ).get(employee.userId)) ||
      null;

    // Correcciones del periodo: las que añaden un fichaje en él o actúan sobre uno suyo.
    const periodPunchIds = new Set(
      periodData.days.flatMap((day) => day.punches.map((punch) => punch.id)),
    );
    const inPeriod = (instant: Date) => {
      const day = localDay(instant, periodData.timezone);
      return day >= period.from && day <= period.to;
    };
    const corrections = allAdjustments
      .filter(
        (a) =>
          (a.targetPunchId && periodPunchIds.has(a.targetPunchId)) ||
          periodPunchIds.has(a.id) ||
          (a.occurredAt && inPeriod(a.occurredAt)),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      company: {
        name: tenant?.name ?? "",
        taxId: tenant?.cifNif ?? null,
        address:
          [
            tenant?.addressStreet,
            tenant?.addressPostalCode,
            tenant?.addressCity,
          ]
            .filter(Boolean)
            .join(", ") || null,
      },
      center: employee.defaultLocation?.name ?? null,
      employee: {
        id: employee.id,
        name: fullName(employee),
        nationalId: employee.nationalId,
        socialSecurityNumber: employee.socialSecurityNumber,
        jobTitle: positionTitle,
        weeklyHours: employee.weeklyHours,
      },
      year,
      month,
      period,
      timezone: periodData.timezone,
      days: periodData.days,
      totals: periodData.totals,
      corrections,
      approval: sheet
        ? {
            version: sheet.version,
            approvedByName: sheet.approvedByName,
            approvedAt: sheet.approvedAt,
            acknowledgedAt: ack?.ackAt ?? null,
          }
        : null,
    };
  }

  /**
   * Informes de todas las personas con actividad en el periodo (o de una sola).
   * Las bajas se incluyen si ficharon: el registro se conserva 4 años.
   */
  async buildMany(
    tenantId: string,
    query: ReportPeriodQuery,
    employeeId?: string,
  ): Promise<WorkdayReport[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, ...(employeeId ? { id: employeeId } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true },
    });
    const reports: WorkdayReport[] = [];
    for (const { id } of employees) {
      const report = await this.build(tenantId, id, query);
      if (employeeId || report.days.length > 0) {
        reports.push(report);
      }
    }
    return reports;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Días naturales entre dos fechas AAAA-MM-DD, ambas incluidas. */
function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

/** "2026-11-01" -> "1 de noviembre". */
function dayAndMonth(date: string): string {
  return `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** Comprueba que es una fecha de calendario real ("2026-02-30" no lo es). */
function isRealDate(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** "del 3 al 17 de octubre de 2026", "del 20 de diciembre de 2025 al 5 de enero de 2026". */
function rangeLabel(from: string, to: string): string {
  if (from === to) {
    return `${dayAndMonth(from)} de ${from.slice(0, 4)}`;
  }
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  const start = sameMonth
    ? String(Number(from.slice(8, 10)))
    : sameYear
      ? dayAndMonth(from)
      : `${dayAndMonth(from)} de ${from.slice(0, 4)}`;
  return `del ${start} al ${dayAndMonth(to)} de ${to.slice(0, 4)}`;
}

export function resolvePeriod({
  year,
  month,
  from,
  to,
}: ReportPeriodQuery): ReportPeriod {
  if (from || to) {
    if (!from || !to || !isRealDate(from) || !isRealDate(to)) {
      throw new BadRequestException("Indica las fechas de inicio y de fin.");
    }
    if (to < from) {
      throw new BadRequestException(
        "La fecha de fin no puede ser anterior a la de inicio.",
      );
    }
    if (daysBetween(from, to) > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        "El periodo no puede pasar de un año. Divídelo en varios informes.",
      );
    }
    return {
      kind: "range",
      from,
      to,
      label: rangeLabel(from, to),
      ofThe: "del periodo",
    };
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    kind: "month",
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(daysInMonth)}`,
    label: `${MONTHS[month - 1]} de ${year}`,
    ofThe: "del mes",
  };
}

function localDay(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
