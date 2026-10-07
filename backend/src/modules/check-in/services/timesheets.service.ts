import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Timesheet } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { Actor, AdjustmentsService } from "./adjustments.service";
import { MonthTotals, WorkdaysService, fullName } from "./workdays.service";

const TOTAL_KEYS: (keyof MonthTotals)[] = [
  "workedMinutes",
  "breakMinutes",
  "expectedMinutes",
  "overtimeMinutes",
  "daysWorked",
  "incidenceCount",
];

/**
 * Hojas de horas mensuales. Aprobar un mes guarda una foto fija de sus
 * jornadas y totales; la tabla es append-only, así que una hoja aprobada no
 * cambia aunque después se corrija un fichaje. Reabrir = aprobar una versión
 * nueva, con su motivo; las anteriores se conservan.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  /** Estado del mes de cada empleado: totales al día y última hoja aprobada. */
  async listMonth(tenantId: string, year: number, month: number) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const rows = [];
    for (const employee of employees) {
      const state = await this.getState(tenantId, employee.id, year, month);
      // Las bajas solo aparecen si ese mes tienen algo que mostrar.
      if (
        !employee.isActive &&
        state.totals.workedMinutes === 0 &&
        !state.approved
      ) {
        continue;
      }
      rows.push({
        employeeId: employee.id,
        employeeName: fullName(employee),
        isActive: employee.isActive,
        totals: state.totals,
        pendingAdjustments: state.pendingAdjustments,
        approved: state.approved,
        acknowledgedAt: state.acknowledgedAt,
        changedSinceApproval: state.changedSinceApproval,
      });
    }
    return rows;
  }

  /** Totales actuales del mes, la hoja aprobada vigente y la conformidad. */
  async getState(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
  ) {
    const [monthData, approved, pending] = await Promise.all([
      this.workdays.getMonth(tenantId, employeeId, year, month),
      this.findLatest(tenantId, employeeId, year, month),
      this.adjustments.list(tenantId, { employeeId, onlyPending: true }),
    ]);
    const ack = approved
      ? await this.prisma.timesheetAck.findUnique({
          where: { timesheetId: approved.id },
        })
      : null;
    return {
      year,
      month,
      employee: monthData.employee,
      timezone: monthData.timezone,
      days: monthData.days,
      totals: monthData.totals,
      pendingAdjustments: pending.length,
      approved: approved ? summarize(approved) : null,
      acknowledgedAt: ack?.ackAt ?? null,
      changedSinceApproval: approved
        ? TOTAL_KEYS.some((key) => approved[key] !== monthData.totals[key])
        : false,
    };
  }

  async approve(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
    manager: Actor,
    reopenReason?: string,
  ) {
    const state = await this.getState(tenantId, employeeId, year, month);
    if (state.pendingAdjustments > 0) {
      throw new BadRequestException(
        "Hay solicitudes de corrección sin resolver de esta persona.",
      );
    }
    if (state.totals.incidenceCount > 0) {
      throw new BadRequestException(
        "Hay jornadas con incidencias o sin cerrar este mes. Corrígelas antes de aprobar.",
      );
    }
    const previous = await this.findLatest(tenantId, employeeId, year, month);
    if (previous && !reopenReason?.trim()) {
      throw new BadRequestException(
        "Este mes ya está aprobado. Indica el motivo para aprobarlo de nuevo.",
      );
    }
    try {
      const created = await this.prisma.timesheet.create({
        data: {
          tenantId,
          employeeId,
          employeeName: state.employee.name,
          year,
          month,
          version: (previous?.version ?? 0) + 1,
          ...state.totals,
          detail: state.days as unknown as Prisma.InputJsonValue,
          reopenReason: previous ? reopenReason?.trim() : null,
          approvedByUserId: manager.id,
          approvedByName: manager.name,
        },
      });
      return summarize(created);
    } catch (error) {
      // unique(tenant, empleado, año, mes, versión): dos aprobaciones a la vez.
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Otra persona acaba de aprobar este mes.");
      }
      throw error;
    }
  }

  /** Conformidad del empleado con la hoja vigente de ese mes. */
  async acknowledge(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
  ) {
    const latest = await this.findLatest(tenantId, employeeId, year, month);
    if (!latest) {
      throw new NotFoundException("Ese mes aún no está aprobado.");
    }
    await this.prisma.timesheetAck.createMany({
      data: [{ tenantId, timesheetId: latest.id, employeeId }],
      skipDuplicates: true,
    });
    const ack = await this.prisma.timesheetAck.findUnique({
      where: { timesheetId: latest.id },
    });
    return { timesheetId: latest.id, acknowledgedAt: ack?.ackAt ?? null };
  }

  private findLatest(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
  ) {
    return this.prisma.timesheet.findFirst({
      where: { tenantId, employeeId, year, month },
      orderBy: { version: "desc" },
    });
  }
}

/** La hoja sin el detalle día a día (pesa y no hace falta en los listados). */
function summarize(sheet: Timesheet) {
  const { detail: _detail, tenantId: _tenantId, ...rest } = sheet;
  return rest;
}
