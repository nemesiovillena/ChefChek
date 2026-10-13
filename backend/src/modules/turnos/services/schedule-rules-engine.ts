import { shiftInterval, shiftWorkMinutes } from "./shift-time.util";

const DAY_MINUTES = 24 * 60;
const DAY_MS = 86_400_000;
/** A partir de qué parte del tope anual de horas extra se avisa. */
const OVERTIME_WARNING_RATIO = 0.9;

export type ScheduleRuleCode =
  | "DESCANSO_ENTRE_JORNADAS"
  | "JORNADA_DIARIA"
  | "HORAS_SEMANALES"
  | "DESCANSO_SEMANAL"
  | "HORAS_EXTRA_ANUALES";

export interface RuleShift {
  id: string;
  employeeId: string;
  /** Día en que empieza el turno (AAAA-MM-DD). */
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface RuleEmployee {
  id: string;
  name: string;
  weeklyHours: number;
  /** Horas extra ya aprobadas en el año, en minutos. */
  overtimeYearMinutes: number;
}

export interface RuleThresholds {
  maxDailyHours: number;
  minRestBetweenShiftsHours: number;
  weeklyRestDays: number;
  overtimeYearlyCap: number;
}

export interface ScheduleAlert {
  code: ScheduleRuleCode;
  employeeId: string;
  /** Día de la semana al que se refiere, o null si es de toda la semana. */
  date: string | null;
  shiftIds: string[];
  message: string;
}

export interface ScheduleRulesInput {
  /** Lunes de la semana que se revisa (AAAA-MM-DD). */
  weekStart: string;
  /**
   * Turnos con persona asignada de la semana y de los días pegados a ella (el
   * domingo anterior y el lunes siguiente), en cualquier centro.
   */
  shifts: RuleShift[];
  employees: RuleEmployee[];
  thresholds: RuleThresholds;
}

interface PlacedShift {
  id: string;
  /** Posición del día respecto al lunes: -1 = domingo anterior, 7 = lunes siguiente. */
  day: number;
  date: string;
  /** Minutos desde las 00:00 del lunes. */
  start: number;
  end: number;
  workMinutes: number;
}

/** "9 h" o "9 h 30 min". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Avisos legales de una semana planificada. Son orientativos: avisan, no
 * impiden guardar. Los umbrales salen de los parámetros de convenio.
 *
 * - Un turno partido es una sola jornada: el hueco entre sus tramos no es
 *   descanso entre jornadas.
 * - Un turno que cruza la medianoche pertenece al día en que empieza.
 * - El descanso semanal se mide como el mayor hueco sin trabajo dentro de la
 *   semana (de lunes 00:00 a domingo 24:00).
 *
 * Función pura: no lee la base de datos ni el reloj.
 */
export function evaluateScheduleRules(
  input: ScheduleRulesInput,
): ScheduleAlert[] {
  const { thresholds } = input;
  const weekStartMs = Date.parse(`${input.weekStart}T00:00:00Z`);
  const alerts: ScheduleAlert[] = [];

  for (const employee of input.employees) {
    const placed: PlacedShift[] = input.shifts
      .filter((shift) => shift.employeeId === employee.id)
      .map((shift) => {
        const day = Math.round(
          (Date.parse(`${shift.date}T00:00:00Z`) - weekStartMs) / DAY_MS,
        );
        const [start, end] = shiftInterval(shift.startTime, shift.endTime);
        return {
          id: shift.id,
          day,
          date: shift.date,
          start: day * DAY_MINUTES + start,
          end: day * DAY_MINUTES + end,
          workMinutes: shiftWorkMinutes(shift),
        };
      })
      .sort((a, b) => a.start - b.start);

    const inWeek = placed.filter((shift) => shift.day >= 0 && shift.day <= 6);
    if (inWeek.length === 0) {
      continue;
    }

    const byDay = new Map<number, PlacedShift[]>();
    for (const shift of placed) {
      byDay.set(shift.day, [...(byDay.get(shift.day) ?? []), shift]);
    }
    const days = [...byDay.keys()].sort((a, b) => a - b);

    // Jornada diaria.
    for (const day of days) {
      if (day < 0 || day > 6) {
        continue;
      }
      const shifts = byDay.get(day) as PlacedShift[];
      const minutes = shifts.reduce((sum, s) => sum + s.workMinutes, 0);
      if (minutes > thresholds.maxDailyHours * 60) {
        alerts.push({
          code: "JORNADA_DIARIA",
          employeeId: employee.id,
          date: shifts[0].date,
          shiftIds: shifts.map((s) => s.id),
          message: `${employee.name} tiene ${formatMinutes(minutes)} planificadas ese día (máximo ${formatMinutes(thresholds.maxDailyHours * 60)}).`,
        });
      }
    }

    // Descanso entre el final de una jornada y el inicio de la siguiente.
    for (let i = 1; i < days.length; i += 1) {
      const previous = byDay.get(days[i - 1]) as PlacedShift[];
      const next = byDay.get(days[i]) as PlacedShift[];
      const previousEnd = Math.max(...previous.map((s) => s.end));
      const nextStart = Math.min(...next.map((s) => s.start));
      const rest = nextStart - previousEnd;
      if (rest >= thresholds.minRestBetweenShiftsHours * 60) {
        continue;
      }
      const nextInWeek = days[i] <= 6;
      const anchor = nextInWeek ? next[0] : previous[0];
      if (anchor.day < 0 || anchor.day > 6) {
        continue;
      }
      alerts.push({
        code: "DESCANSO_ENTRE_JORNADAS",
        employeeId: employee.id,
        date: anchor.date,
        shiftIds: [...previous, ...next]
          .filter((s) => s.day >= 0 && s.day <= 6)
          .map((s) => s.id),
        message: `${employee.name} descansa ${formatMinutes(Math.max(0, rest))} entre dos jornadas (mínimo ${formatMinutes(thresholds.minRestBetweenShiftsHours * 60)}).`,
      });
    }

    // Horas de la semana frente a las pactadas.
    const weekMinutes = inWeek.reduce((sum, s) => sum + s.workMinutes, 0);
    if (weekMinutes > employee.weeklyHours * 60) {
      alerts.push({
        code: "HORAS_SEMANALES",
        employeeId: employee.id,
        date: null,
        shiftIds: [],
        message: `${employee.name} tiene ${formatMinutes(weekMinutes)} planificadas esta semana (pactadas ${formatMinutes(employee.weeklyHours * 60)}).`,
      });
    }

    // Descanso semanal: mayor hueco sin trabajo dentro de la semana.
    const weekEnd = 7 * DAY_MINUTES;
    let cursor = 0;
    let longestRest = 0;
    for (const shift of placed) {
      const start = Math.max(0, Math.min(shift.start, weekEnd));
      const end = Math.max(0, Math.min(shift.end, weekEnd));
      if (end <= start) {
        continue;
      }
      longestRest = Math.max(longestRest, start - cursor);
      cursor = Math.max(cursor, end);
    }
    longestRest = Math.max(longestRest, weekEnd - cursor);
    if (longestRest < thresholds.weeklyRestDays * DAY_MINUTES) {
      alerts.push({
        code: "DESCANSO_SEMANAL",
        employeeId: employee.id,
        date: null,
        shiftIds: [],
        message: `${employee.name} no llega a ${String(thresholds.weeklyRestDays).replace(".", ",")} días seguidos de descanso esta semana (el mayor es de ${formatMinutes(longestRest)}).`,
      });
    }

    // Horas extra del año cerca del tope.
    const capMinutes = thresholds.overtimeYearlyCap * 60;
    if (
      capMinutes > 0 &&
      employee.overtimeYearMinutes >= capMinutes * OVERTIME_WARNING_RATIO
    ) {
      alerts.push({
        code: "HORAS_EXTRA_ANUALES",
        employeeId: employee.id,
        date: null,
        shiftIds: [],
        message: `${employee.name} lleva ${formatMinutes(employee.overtimeYearMinutes)} extra este año (tope ${formatMinutes(capMinutes)}).`,
      });
    }
  }

  return alerts;
}
