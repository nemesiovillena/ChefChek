import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  AdjustmentWithDecision,
  AdjustmentsService,
} from "./adjustments.service";
import { MonthTotals, WorkdaysService, fullName } from "./workdays.service";

/** Datos del registro de jornada de una persona en un mes, listos para exportar. */
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
  timezone: string;
  days: Awaited<ReturnType<WorkdaysService["getMonth"]>>["days"];
  totals: MonthTotals;
  /** Correcciones que afectan a fichajes de este mes, con su decisión. */
  corrections: AdjustmentWithDecision[];
  /** Hoja aprobada vigente y conformidad del empleado, si existen. */
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
    year: number,
    month: number,
  ): Promise<WorkdayReport> {
    const [tenant, employee, monthData, allAdjustments, sheet] =
      await Promise.all([
        this.prisma.tenant.findUnique({ where: { id: tenantId } }),
        this.prisma.employee.findFirstOrThrow({
          where: { id: employeeId, tenantId },
          include: { defaultLocation: { select: { name: true } } },
        }),
        this.workdays.getMonth(tenantId, employeeId, year, month),
        this.adjustments.listAllForEmployee(tenantId, employeeId),
        this.prisma.timesheet.findFirst({
          where: { tenantId, employeeId, year, month },
          orderBy: { version: "desc" },
        }),
      ]);
    const ack = sheet
      ? await this.prisma.timesheetAck.findUnique({
          where: { timesheetId: sheet.id },
        })
      : null;

    // Correcciones del mes: las que añaden un fichaje en él o actúan sobre uno suyo.
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthPunchIds = new Set(
      monthData.days.flatMap((day) => day.punches.map((punch) => punch.id)),
    );
    const corrections = allAdjustments
      .filter(
        (a) =>
          (a.targetPunchId && monthPunchIds.has(a.targetPunchId)) ||
          monthPunchIds.has(a.id) ||
          (a.occurredAt &&
            localMonth(a.occurredAt, monthData.timezone) === prefix),
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
        jobTitle: employee.jobTitle,
        weeklyHours: employee.weeklyHours,
      },
      year,
      month,
      timezone: monthData.timezone,
      days: monthData.days,
      totals: monthData.totals,
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
   * Informes de todas las personas con actividad ese mes (o de una sola).
   * Las bajas se incluyen si ficharon: el registro se conserva 4 años.
   */
  async buildMany(
    tenantId: string,
    year: number,
    month: number,
    employeeId?: string,
  ): Promise<WorkdayReport[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, ...(employeeId ? { id: employeeId } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true },
    });
    const reports: WorkdayReport[] = [];
    for (const { id } of employees) {
      const report = await this.build(tenantId, id, year, month);
      if (employeeId || report.days.length > 0) {
        reports.push(report);
      }
    }
    return reports;
  }
}

function localMonth(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).format(instant);
}
