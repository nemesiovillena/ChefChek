import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AbsenceStatus,
  Employee,
  PunchAdjustmentKind,
  VacationDayType,
} from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { AdjustmentsService } from "./adjustments.service";
import { CheckInSettingsService } from "./check-in-settings.service";
import {
  EffectivePunch,
  Workday,
  calculateWorkdays,
} from "./workday-calculator";
import {
  absenceDates,
  parseDate,
} from "../../turnos/services/absence-days.util";

const DAY_MS = 86_400_000;
/** Margen para no cortar una jornada que empieza antes o acaba después del rango. */
const RANGE_MARGIN_MS = 2 * DAY_MS;
const MAX_RANGE_DAYS = 100;

export interface WorkdayPunchView {
  id: string;
  type: string;
  occurredAt: Date;
  /** Fichaje real o añadido por una corrección aprobada. */
  origin: "PUNCH" | "ADJUSTMENT";
  /** Anulado por una corrección aprobada: se ve, pero no cuenta. */
  voided: boolean;
  needsReview: boolean;
  wasOffline: boolean;
  locationName: string | null;
  geofenceStatus: string | null;
}

/** Un día cubierto por una ausencia aprobada (vacaciones, baja, permiso…). */
export interface WorkdayAbsence {
  date: string;
  absenceId: string;
  typeName: string;
  color: string;
  isPaid: boolean;
  halfDay: boolean;
}

export interface MonthTotals {
  workedMinutes: number;
  breakMinutes: number;
  /**
   * Jornada pactada del periodo: horas semanales × días del periodo / 7,
   * menos los días de ausencia aprobada. Null = horas sin pactar.
   */
  expectedMinutes: number | null;
  overtimeMinutes: number | null;
  daysWorked: number;
  /** Días con incidencia (sin salida, secuencia) o con la jornada aún abierta. */
  incidenceCount: number;
  /** Días de ausencia aprobada; media jornada cuenta 0,5. */
  absenceDays: number;
}

export const fullName = (e: Pick<Employee, "firstName" | "lastName">) =>
  `${e.firstName} ${e.lastName}`.trim();

/**
 * Registro de jornada: deriva las jornadas de una persona a partir de sus
 * fichajes y de las correcciones aprobadas. No guarda nada: siempre se
 * recalcula desde la evidencia.
 */
@Injectable()
export class WorkdaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adjustments: AdjustmentsService,
    private readonly settings: CheckInSettingsService,
  ) {}

  async findEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: { defaultLocation: { select: { timezone: true } } },
    });
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
    return employee;
  }

  /** Jornadas entre dos fechas locales (AAAA-MM-DD), ambas incluidas. */
  async getWorkdays(
    tenantId: string,
    employeeId: string,
    from: string,
    to: string,
    now: Date = new Date(),
  ) {
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to}T00:00:00Z`);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
      throw new BadRequestException("Rango de fechas no válido.");
    }
    if ((toMs - fromMs) / DAY_MS > MAX_RANGE_DAYS) {
      throw new BadRequestException("El rango máximo es de 100 días.");
    }

    const employee = await this.findEmployee(tenantId, employeeId);
    const timezone = employee.defaultLocation?.timezone ?? "Europe/Madrid";
    const settings = await this.settings.get(tenantId);
    const rangeStart = new Date(fromMs - RANGE_MARGIN_MS);
    const rangeEnd = new Date(toMs + DAY_MS + RANGE_MARGIN_MS);

    const [punches, approved, absences] = await Promise.all([
      this.prisma.timePunch.findMany({
        where: {
          tenantId,
          employeeId,
          occurredAt: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: [{ occurredAt: "asc" }, { seq: "asc" }],
      }),
      this.adjustments.listApproved(tenantId, employeeId),
      this.approvedAbsenceDays(
        tenantId,
        employee.defaultLocationId,
        employeeId,
        from,
        to,
        settings.vacationDayType,
      ),
    ]);

    const voided = new Set(
      approved
        .filter(
          (a) =>
            a.kind === PunchAdjustmentKind.VOID ||
            a.kind === PunchAdjustmentKind.REPLACE,
        )
        .map((a) => a.targetPunchId as string),
    );
    const confirmed = new Set(
      approved
        .filter((a) => a.kind === PunchAdjustmentKind.CONFIRM)
        .map((a) => a.targetPunchId as string),
    );
    const added = approved.filter(
      (a) =>
        (a.kind === PunchAdjustmentKind.ADD ||
          a.kind === PunchAdjustmentKind.REPLACE) &&
        a.type &&
        a.occurredAt &&
        a.occurredAt >= rangeStart &&
        a.occurredAt <= rangeEnd,
    );

    const views: WorkdayPunchView[] = [
      ...punches.map((p) => ({
        id: p.id,
        type: p.type as string,
        occurredAt: p.occurredAt,
        origin: "PUNCH" as const,
        voided: voided.has(p.id),
        needsReview: p.needsReview && !confirmed.has(p.id) && !voided.has(p.id),
        wasOffline: p.wasOffline,
        locationName: p.locationName,
        geofenceStatus: p.geofenceStatus as string,
      })),
      ...added.map((a) => ({
        id: a.id,
        type: a.type as string,
        occurredAt: a.occurredAt as Date,
        origin: "ADJUSTMENT" as const,
        voided: voided.has(a.id),
        needsReview: false,
        wasOffline: false,
        locationName: null,
        geofenceStatus: null,
      })),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const effective: EffectivePunch[] = views
      .filter((v) => !v.voided)
      .map((v) => ({
        id: v.id,
        type: v.type as EffectivePunch["type"],
        occurredAt: v.occurredAt,
        fromAdjustment: v.origin === "ADJUSTMENT",
      }));

    const workdays = calculateWorkdays(effective, {
      timezone,
      breaksCountAsWork: settings.breaksCountAsWork,
      now,
      openGraceHours: settings.autoCloseAfterHours,
    }).filter((day) => day.date >= from && day.date <= to);

    // Cada día enseña todos sus fichajes, también los anulados: la corrección
    // no oculta lo que había.
    const byId = new Map(views.map((v) => [v.id, v]));
    const usedIds = new Set(workdays.flatMap((d) => d.punchIds));
    const days = workdays.map((day) => ({
      ...day,
      punches: [
        ...day.punchIds.map((id) => byId.get(id) as WorkdayPunchView),
        ...views.filter(
          (v) =>
            v.voided &&
            !usedIds.has(v.id) &&
            localDay(v.occurredAt, timezone) === day.date,
        ),
      ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()),
    }));

    return {
      employee: {
        id: employee.id,
        name: fullName(employee),
        weeklyHours: employee.weeklyHours,
      },
      timezone,
      days,
      absences,
      vacationDayType: settings.vacationDayType,
    };
  }

  /**
   * Días del rango con una ausencia aprobada. Cuentan los mismos días que en
   * el saldo de vacaciones: con días laborables, ni fines de semana ni festivos.
   */
  private async approvedAbsenceDays(
    tenantId: string,
    locationId: string | null,
    employeeId: string,
    from: string,
    to: string,
    dayType: VacationDayType,
  ): Promise<WorkdayAbsence[]> {
    const start = parseDate(from);
    const end = parseDate(to);
    const [absences, holidays] = await Promise.all([
      this.prisma.absence.findMany({
        where: {
          tenantId,
          employeeId,
          status: AbsenceStatus.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: { type: true },
        orderBy: { startDate: "asc" },
      }),
      dayType === VacationDayType.WORKING
        ? this.prisma.holiday.findMany({
            where: {
              tenantId,
              date: { gte: start, lte: end },
              OR: [{ locationId: null }, { locationId }],
            },
            select: { date: true },
          })
        : [],
    ]);
    const holidayDates = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10)),
    );
    return absences.flatMap((absence) =>
      absenceDates(
        absence.startDate < start ? start : absence.startDate,
        absence.endDate > end ? end : absence.endDate,
        { dayType, holidays: holidayDates },
      ).map((date) => ({
        date,
        absenceId: absence.id,
        typeName: absence.type.name,
        color: absence.type.color,
        isPaid: absence.type.isPaid,
        halfDay: absence.halfDay,
      })),
    );
  }

  /** Jornadas y totales de un mes natural. */
  async getMonth(
    tenantId: string,
    employeeId: string,
    year: number,
    month: number,
    now: Date = new Date(),
  ) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${year}-${pad(month)}-01`;
    const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;
    const result = await this.getPeriod(tenantId, employeeId, from, to, now);
    return { ...result, year, month };
  }

  /**
   * Jornadas y totales entre dos fechas locales (ambas incluidas). La
   * jornada pactada se prorratea por los días naturales del periodo.
   */
  async getPeriod(
    tenantId: string,
    employeeId: string,
    from: string,
    to: string,
    now: Date = new Date(),
  ) {
    const result = await this.getWorkdays(tenantId, employeeId, from, to, now);
    const periodDays =
      Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
          DAY_MS,
      ) + 1;
    return {
      ...result,
      totals: monthTotals(
        result.days,
        result.employee.weeklyHours,
        periodDays,
        result.absences,
        result.vacationDayType,
      ),
    };
  }
}

function localDay(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Totales del mes; sin horas pactadas no hay jornada esperada ni exceso.
 * Cada día de ausencia aprobada descuenta su parte de la jornada pactada:
 * 1/7 de la semana si se cuentan días naturales, 1/5 si son laborables.
 */
export function monthTotals(
  days: Workday[],
  weeklyHours: number | null,
  daysInMonth: number,
  absences: WorkdayAbsence[] = [],
  dayType: VacationDayType = VacationDayType.NATURAL,
): MonthTotals {
  const workedMinutes = days.reduce((sum, d) => sum + d.workedMinutes, 0);
  const absenceDays = absences.reduce(
    (sum, a) => sum + (a.halfDay ? 0.5 : 1),
    0,
  );
  const daysPerWeek = dayType === VacationDayType.WORKING ? 5 : 7;
  const expectedMinutes =
    weeklyHours === null
      ? null
      : Math.max(
          0,
          Math.round(
            (weeklyHours * 60 * daysInMonth) / 7 -
              (weeklyHours * 60 * absenceDays) / daysPerWeek,
          ),
        );
  return {
    workedMinutes,
    breakMinutes: days.reduce((sum, d) => sum + d.breakMinutes, 0),
    expectedMinutes,
    overtimeMinutes:
      expectedMinutes === null
        ? null
        : Math.max(0, workedMinutes - expectedMinutes),
    daysWorked: days.filter((d) => d.workedMinutes > 0).length,
    incidenceCount: days.filter((d) => d.incidences.length > 0 || d.open)
      .length,
    absenceDays,
  };
}
