/**
 * Resuelve periodos naturales ("semana pasada", "mes actual"…) a un rango de
 * fechas absoluto en la zona horaria del negocio (Europe/Madrid), teniendo en
 * cuenta el cambio de hora (DST). Lo usa la tool `get_lot_traceability` del
 * asistente para filtrar por `Albaran.date`.
 *
 * A diferencia de `period.util.ts` (ventanas móviles de 7/30 días), aquí la
 * semana es natural: lunes 00:00 → domingo 23:59:59.999 hora de Madrid.
 */

const TZ = "Europe/Madrid";

export type CalendarPeriod =
  | "semana_actual"
  | "semana_pasada"
  | "mes_actual"
  | "mes_pasado";

export interface DateRange {
  from: Date;
  to: Date;
}

/** Offset (ms) que hay que restar a un instante UTC para obtener la hora de `tz`. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  // `hour` puede venir como "24" a medianoche en algunos entornos.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/** Instante UTC que corresponde a una hora civil concreta de `TZ`. DST-safe. */
function zonedTimeToUtc(
  year: number,
  month1: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const naiveUtc = Date.UTC(year, month1 - 1, day, hour, minute, second, ms);
  const firstGuess = naiveUtc - tzOffsetMs(new Date(naiveUtc), TZ);
  // Un segundo pase corrige los días de cambio de hora, donde el offset del
  // instante estimado difiere del offset del instante ingenuo.
  const offset = tzOffsetMs(new Date(firstGuess), TZ);
  return new Date(naiveUtc - offset);
}

/** Componentes de fecha civil (Madrid) del instante `now`. */
function madridCivilDate(now: Date): {
  year: number;
  month1: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month1: get("month"), day: get("day") };
}

/** Índice de día de la semana en Madrid con lunes = 0 … domingo = 6. */
function madridWeekdayMondayZero(now: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[short] ?? 0;
}

/** Suma `days` a una fecha civil (aritmética sin zona horaria). */
function addCivilDays(
  d: { year: number; month1: number; day: number },
  days: number,
): { year: number; month1: number; day: number } {
  const t = Date.UTC(d.year, d.month1 - 1, d.day + days);
  const nd = new Date(t);
  return {
    year: nd.getUTCFullYear(),
    month1: nd.getUTCMonth() + 1,
    day: nd.getUTCDate(),
  };
}

/** Último instante inclusivo antes del inicio (exclusivo) del periodo siguiente. */
const lastInstantBefore = (exclusiveNextStart: Date): Date =>
  new Date(exclusiveNextStart.getTime() - 1);

/** Fin del día civil de Madrid en el que cae `now` (23:59:59.999 local). */
function endOfMadridToday(now: Date): Date {
  const c = madridCivilDate(now);
  const tomorrow = addCivilDays(c, 1);
  return lastInstantBefore(
    zonedTimeToUtc(tomorrow.year, tomorrow.month1, tomorrow.day),
  );
}

export function resolveCalendarPeriod(
  period: CalendarPeriod,
  now: Date = new Date(),
): DateRange {
  const civil = madridCivilDate(now);
  // Para periodos "en curso" no tiene sentido devolver un `to` en el futuro:
  // el prompt le dice al LLM que "esta semana" = lunes a hoy.
  const isCurrent = period === "semana_actual" || period === "mes_actual";
  const clampToNow = (to: Date) =>
    isCurrent && to.getTime() > now.getTime() ? endOfMadridToday(now) : to;

  if (period === "semana_actual" || period === "semana_pasada") {
    const weekday = madridWeekdayMondayZero(now);
    const shift = period === "semana_actual" ? 0 : -7;
    const monday = addCivilDays(civil, -weekday + shift);
    const nextMonday = addCivilDays(monday, 7);
    const from = zonedTimeToUtc(monday.year, monday.month1, monday.day);
    const nextStart = zonedTimeToUtc(
      nextMonday.year,
      nextMonday.month1,
      nextMonday.day,
    );
    return { from, to: clampToNow(lastInstantBefore(nextStart)) };
  }

  // mes_actual / mes_pasado
  const monthDelta = period === "mes_actual" ? 0 : -1;
  const y = civil.year;
  const m0 = civil.month1 - 1 + monthDelta;
  const startYear = y + Math.floor(m0 / 12);
  const startMonth1 = (((m0 % 12) + 12) % 12) + 1;
  const from = zonedTimeToUtc(startYear, startMonth1, 1);
  const nextMonth0 = m0 + 1;
  const nextYear = y + Math.floor(nextMonth0 / 12);
  const nextMonth1 = (((nextMonth0 % 12) + 12) % 12) + 1;
  const nextStart = zonedTimeToUtc(nextYear, nextMonth1, 1);
  return { from, to: clampToNow(lastInstantBefore(nextStart)) };
}

/** `true` si `value` es un `CalendarPeriod` válido. */
export function isCalendarPeriod(value: unknown): value is CalendarPeriod {
  return (
    value === "semana_actual" ||
    value === "semana_pasada" ||
    value === "mes_actual" ||
    value === "mes_pasado"
  );
}
