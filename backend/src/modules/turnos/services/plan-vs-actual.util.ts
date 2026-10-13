import { shiftInterval, shiftWorkMinutes } from "./shift-time.util";

const DAY_MS = 86_400_000;

/**
 * PENDING: el turno aún no ha empezado (o está dentro del margen).
 * IN_PROGRESS: ha fichado la entrada y sigue trabajando.
 * NO_SHOW: debería haber empezado y no hay fichaje.
 * INCIDENT: fichó, pero con retraso, salida anticipada o exceso.
 * UNPLANNED: trabajó un día sin turno publicado.
 */
export type DayComparisonStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "OK"
  | "NO_SHOW"
  | "INCIDENT"
  | "UNPLANNED";

export type DayComparisonFlag = "LATE" | "EARLY_LEAVE" | "OVER";

export interface PlannedShift {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface ActualDay {
  /** Primera entrada del día. */
  firstEntryAt: Date | null;
  /** Última salida; null si la jornada sigue abierta o no hay salida. */
  lastExitAt: Date | null;
  workedMinutes: number;
  /** Hay una entrada reciente sin salida todavía. */
  open: boolean;
}

export interface DayComparison {
  status: DayComparisonStatus;
  flags: DayComparisonFlag[];
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedMinutes: number;
  actualStart: string | null;
  actualEnd: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overMinutes: number;
}

/**
 * Minutos entre las 00:00 del día `date` (AAAA-MM-DD) y un instante, medidos
 * con el reloj de pared de la zona horaria. Puede pasar de 1440 (madrugada
 * del día siguiente) o ser negativo.
 */
export function localMinutesFrom(
  instant: Date,
  timezone: string,
  date: string,
): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const localDay = `${part("year")}-${part("month")}-${part("day")}`;
  const dayOffset = Math.round(
    (Date.parse(`${localDay}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
      DAY_MS,
  );
  return dayOffset * 1440 + Number(part("hour")) * 60 + Number(part("minute"));
}

/** 615 -> "10:15"; 1500 -> "01:00" (madrugada del día siguiente). */
export function minutesToClock(minutes: number): string {
  const inDay = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`;
}

/**
 * Compara lo planificado para una persona en un día con lo que fichó.
 * Varios turnos el mismo día (turno partido) se tratan como una jornada: se
 * mira la primera entrada, la última salida y el total trabajado.
 *
 * Función pura: recibe `now`.
 */
export function compareDay(input: {
  date: string;
  timezone: string;
  planned: PlannedShift[];
  actual: ActualDay | null;
  now: Date;
  toleranceMinutes: number;
}): DayComparison {
  const { date, timezone, planned, actual, toleranceMinutes } = input;
  const toLocal = (instant: Date) => localMinutesFrom(instant, timezone, date);

  const actualStart = actual?.firstEntryAt
    ? toLocal(actual.firstEntryAt)
    : null;
  const actualEnd =
    actual && !actual.open && actual.lastExitAt
      ? toLocal(actual.lastExitAt)
      : null;
  const workedMinutes = actual?.workedMinutes ?? 0;
  const base = {
    flags: [] as DayComparisonFlag[],
    actualStart: actualStart === null ? null : minutesToClock(actualStart),
    actualEnd: actualEnd === null ? null : minutesToClock(actualEnd),
    workedMinutes,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overMinutes: 0,
  };

  if (planned.length === 0) {
    return {
      ...base,
      status: "UNPLANNED",
      plannedStart: null,
      plannedEnd: null,
      plannedMinutes: 0,
    };
  }

  const intervals = planned.map((s) => shiftInterval(s.startTime, s.endTime));
  const plannedStart = Math.min(...intervals.map(([start]) => start));
  const plannedEnd = Math.max(...intervals.map(([, end]) => end));
  const plannedMinutes = planned.reduce(
    (sum, s) => sum + shiftWorkMinutes(s),
    0,
  );
  const result: DayComparison = {
    ...base,
    status: "OK",
    plannedStart: minutesToClock(plannedStart),
    plannedEnd: minutesToClock(plannedEnd),
    plannedMinutes,
  };

  if (actualStart === null) {
    result.status =
      toLocal(input.now) > plannedStart + toleranceMinutes
        ? "NO_SHOW"
        : "PENDING";
    return result;
  }

  result.lateMinutes = Math.max(0, actualStart - plannedStart);
  if (result.lateMinutes > toleranceMinutes) {
    result.flags.push("LATE");
  }
  if (actual?.open) {
    result.status = "IN_PROGRESS";
    return result;
  }

  if (actualEnd !== null) {
    result.earlyLeaveMinutes = Math.max(0, plannedEnd - actualEnd);
    if (result.earlyLeaveMinutes > toleranceMinutes) {
      result.flags.push("EARLY_LEAVE");
    }
  }
  result.overMinutes = Math.max(0, workedMinutes - plannedMinutes);
  if (result.overMinutes > toleranceMinutes) {
    result.flags.push("OVER");
  }
  result.status = result.flags.length > 0 ? "INCIDENT" : "OK";
  return result;
}
