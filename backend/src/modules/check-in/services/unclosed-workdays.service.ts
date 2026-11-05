import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { AdjustmentsService } from "./adjustments.service";
import { WorkdayIncidence, localDate } from "./workday-calculator";
import { WorkdaysService, fullName } from "./workdays.service";

/** Cuántos días hacia atrás se buscan jornadas sin cerrar (hoy incluido). */
export const UNCLOSED_LOOKBACK_DAYS = 31;

export interface UnclosedDay {
  date: string;
  incidences: WorkdayIncidence[];
  /** Ya hay una solicitud de corrección sin resolver que afecta a ese día. */
  pendingCorrection: boolean;
}

export interface TeamUnclosedDay extends UnclosedDay {
  employeeId: string;
  employeeName: string;
}

const DAY_MS = 86_400_000;

/**
 * Avisos de olvido de fichaje: días recientes con una entrada sin salida o con
 * fichajes que no encajan. Se calculan al vuelo desde el registro de jornada
 * (no se guardan) y solo los ven la propia persona y gerencia. Una jornada
 * aún en curso no es un olvido y no sale.
 */
@Injectable()
export class UnclosedWorkdaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workdays: WorkdaysService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  async forEmployee(
    tenantId: string,
    employeeId: string,
    now: Date = new Date(),
  ): Promise<UnclosedDay[]> {
    const to = localDate(now, "Europe/Madrid");
    const from = new Date(
      Date.parse(`${to}T00:00:00Z`) - (UNCLOSED_LOOKBACK_DAYS - 1) * DAY_MS,
    )
      .toISOString()
      .slice(0, 10);
    const [{ days, timezone }, adjustments] = await Promise.all([
      this.workdays.getWorkdays(tenantId, employeeId, from, to, now),
      this.adjustments.listAllForEmployee(tenantId, employeeId),
    ]);
    const pending = adjustments.filter((a) => a.decision === null);

    return days
      .filter((day) => day.incidences.length > 0)
      .map((day) => {
        const punchIds = new Set(day.punches.map((p) => p.id));
        return {
          date: day.date,
          incidences: day.incidences,
          pendingCorrection: pending.some(
            (a) =>
              (a.targetPunchId && punchIds.has(a.targetPunchId)) ||
              (a.occurredAt && localDate(a.occurredAt, timezone) === day.date),
          ),
        };
      });
  }

  /** Días sin cerrar de todo el equipo activo, del más reciente al más antiguo. */
  async forTeam(
    tenantId: string,
    now: Date = new Date(),
  ): Promise<TeamUnclosedDay[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });
    const result: TeamUnclosedDay[] = [];
    for (const employee of employees) {
      const days = await this.forEmployee(tenantId, employee.id, now);
      result.push(
        ...days.map((day) => ({
          ...day,
          employeeId: employee.id,
          employeeName: fullName(employee),
        })),
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }
}
