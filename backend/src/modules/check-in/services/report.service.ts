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

/**
 * Periodo del informe: un mes natural o, con `weekStart` (lunes AAAA-MM-DD),
 * la semana de lunes a domingo. year/month siguen indicando el mes de
 * referencia (el del lunes).
 */
export interface ReportPeriodQuery {
  year: number;
  month: number;
  weekStart?: string;
}

export interface ReportPeriod {
  kind: "month" | "week";
  /** Fechas locales AAAA-MM-DD, ambas incluidas. */
  from: string;
  to: string;
  /** "octubre de 2026" o "semana del 26 de octubre al 1 de noviembre de 2026". */
  label: string;
  /** Para los textos: "del mes" / "de la semana". */
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
        // La hoja se aprueba por meses: un informe semanal no la arrastra.
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

/** "2026-10-26" + 6 -> "2026-11-01" (fechas de calendario, sin zona). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-01" -> "1 de noviembre". */
function dayAndMonth(date: string): string {
  return `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

export function resolvePeriod({
  year,
  month,
  weekStart,
}: ReportPeriodQuery): ReportPeriod {
  if (weekStart) {
    if (new Date(`${weekStart}T00:00:00Z`).getUTCDay() !== 1) {
      throw new BadRequestException("La semana debe empezar en lunes.");
    }
    const to = addDays(weekStart, 6);
    return {
      kind: "week",
      from: weekStart,
      to,
      label: `semana del ${
        weekStart.slice(5, 7) === to.slice(5, 7)
          ? Number(weekStart.slice(8, 10))
          : dayAndMonth(weekStart)
      } al ${dayAndMonth(to)} de ${to.slice(0, 4)}`,
      ofThe: "de la semana",
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
