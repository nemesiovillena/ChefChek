import { BadRequestException, Injectable } from "@nestjs/common";
import { Employee, Shift, ShiftStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { CheckInSettingsService } from "../../check-in/services/check-in-settings.service";
import { localDate } from "../../check-in/services/workday-calculator";
import {
  WorkdaysService,
  fullName,
} from "../../check-in/services/workdays.service";
import { formatDate, parseDate } from "./absence-days.util";
import { DayComparison, compareDay } from "./plan-vs-actual.util";
import { addDays, isMonday } from "./shift-time.util";

export interface PlanVsActualRow extends DayComparison {
  employeeId: string;
  employeeName: string;
  date: string;
  /** Coste estimado (horas × coste hora de la ficha); null si la ficha no lo tiene. */
  plannedCost: number | null;
  actualCost: number | null;
}

/** Horas × coste hora, en euros con dos decimales. */
export function laborCost(minutes: number, hourlyCost: number | null) {
  return hourlyCost === null
    ? null
    : Math.round((minutes / 60) * hourlyCost * 100) / 100;
}

/**
 * Cruza los turnos publicados con las jornadas fichadas. Solo para gerencia:
 * las respuestas llevan coste laboral.
 */
@Injectable()
export class PlanVsActualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
    private readonly settings: CheckInSettingsService,
  ) {}

  /** Plan frente a real de una semana en un centro, por persona y día. */
  async getWeek(
    tenantId: string,
    locationId: string,
    weekStart: string,
    now: Date = new Date(),
  ) {
    const monday = parseDate(weekStart);
    if (!isMonday(monday)) {
      throw new BadRequestException("La semana debe empezar en lunes.");
    }
    const sunday = addDays(monday, 6);
    const [employees, shifts] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          tenantId,
          isActive: true,
          locations: { some: { locationId } },
        },
        orderBy: [{ section: "asc" }, { firstName: "asc" }],
      }),
      this.prisma.shift.findMany({
        where: {
          tenantId,
          locationId,
          status: ShiftStatus.PUBLISHED,
          employeeId: { not: null },
          date: { gte: monday, lte: sunday },
        },
      }),
    ]);
    const rows = await this.buildRows(tenantId, employees, shifts, {
      from: formatDate(monday),
      to: formatDate(sunday),
      includeUnplanned: true,
      now,
    });
    const sum = (pick: (row: PlanVsActualRow) => number | null) =>
      Math.round(
        rows.reduce((total, row) => total + (pick(row) ?? 0), 0) * 100,
      ) / 100;
    return {
      weekStart: formatDate(monday),
      rows,
      totals: {
        plannedMinutes: sum((r) => r.plannedMinutes),
        workedMinutes: sum((r) => r.workedMinutes),
        plannedCost: sum((r) => r.plannedCost),
        actualCost: sum((r) => r.actualCost),
      },
    };
  }

  /**
   * Turnos publicados de hoy en todos los centros, con su estado: quién no
   * ha fichado, quién llegó tarde, quién está trabajando.
   */
  async getToday(tenantId: string, now: Date = new Date()) {
    const locations = await this.prisma.location.findMany({
      where: { tenantId },
      select: { id: true, timezone: true },
    });
    const todayByLocation = new Map(
      locations.map((l) => [l.id, localDate(now, l.timezone)]),
    );
    const dates = [...new Set(todayByLocation.values())].sort();
    if (dates.length === 0) {
      return { rows: [] };
    }
    const shifts = (
      await this.prisma.shift.findMany({
        where: {
          tenantId,
          status: ShiftStatus.PUBLISHED,
          employeeId: { not: null },
          date: { in: dates.map(parseDate) },
        },
      })
    ).filter(
      (shift) =>
        todayByLocation.get(shift.locationId) === formatDate(shift.date),
    );
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { in: shifts.map((s) => s.employeeId as string) },
      },
      orderBy: [{ firstName: "asc" }],
    });
    const rows = await this.buildRows(tenantId, employees, shifts, {
      from: dates[0],
      to: dates[dates.length - 1],
      includeUnplanned: false,
      now,
    });
    return { rows };
  }

  private async buildRows(
    tenantId: string,
    employees: Employee[],
    shifts: Shift[],
    options: { from: string; to: string; includeUnplanned: boolean; now: Date },
  ): Promise<PlanVsActualRow[]> {
    const { scheduleToleranceMinutes } = await this.settings.get(tenantId);
    const perEmployee = await Promise.all(
      employees.map(async (employee) => {
        const { days, timezone } = await this.workdays.getWorkdays(
          tenantId,
          employee.id,
          options.from,
          options.to,
          options.now,
        );
        const planned = new Map<string, Shift[]>();
        for (const shift of shifts) {
          if (shift.employeeId === employee.id) {
            const date = formatDate(shift.date);
            planned.set(date, [...(planned.get(date) ?? []), shift]);
          }
        }
        const worked = new Map(days.map((day) => [day.date, day]));
        const dates = new Set(planned.keys());
        if (options.includeUnplanned) {
          for (const day of days) {
            if (day.workedMinutes > 0 || day.open) {
              dates.add(day.date);
            }
          }
        }
        return [...dates].sort().map((date): PlanVsActualRow => {
          const day = worked.get(date);
          const workSegments =
            day?.segments.filter((s) => s.kind === "WORK") ?? [];
          const firstEntry = day?.punches.find(
            (p) => p.type === "IN" && !p.voided,
          );
          const comparison = compareDay({
            date,
            timezone,
            planned: planned.get(date) ?? [],
            actual: day
              ? {
                  firstEntryAt:
                    firstEntry?.occurredAt ?? workSegments[0]?.start ?? null,
                  lastExitAt:
                    workSegments[workSegments.length - 1]?.end ?? null,
                  workedMinutes: day.workedMinutes,
                  open: day.open,
                }
              : null,
            now: options.now,
            toleranceMinutes: scheduleToleranceMinutes,
          });
          return {
            employeeId: employee.id,
            employeeName: fullName(employee),
            date,
            ...comparison,
            plannedCost: laborCost(
              comparison.plannedMinutes,
              employee.hourlyCost,
            ),
            actualCost: laborCost(
              comparison.workedMinutes,
              employee.hourlyCost,
            ),
          };
        });
      }),
    );
    return perEmployee.flat();
  }
}
