/**
 * Utilidades de periodo del motor de checklist, en zona Europe/Madrid. Único
 * punto de verdad para `periodKey`/`periodStart` — no reimplementar en otro
 * sitio (fase 2 del plan SICTED). Mismo patrón que
 * `etiquetado/util/shelf-life.util.ts`: `Intl.DateTimeFormat` para el día
 * natural en Madrid, luego aritmética estable sobre mediodía UTC (no depende
 * del huso horario del servidor ni se ve afectada por el cambio de hora).
 */

const TIMEZONE = "Europe/Madrid";

export type ChecklistFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL";

export const CHECKLIST_FREQUENCIES: ChecklistFrequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
];

/** Frecuencias válidas para `ChecklistTemplateItem.itemFrequency` (además hereda null). */
export type ChecklistItemFrequency =
  | ChecklistFrequency
  | "AFTER_EACH_USE"
  | "AS_NEEDED";

interface MadridDate {
  y: number;
  m: number; // 1-12
  d: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Día natural (año/mes/día) de un instante en Europe/Madrid. */
export function madridCalendarDay(date: Date): MadridDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Instante "mediodía UTC" de un día natural: estable frente a DST, no depende del huso del servidor. */
function noonUtc(md: MadridDate): Date {
  return new Date(Date.UTC(md.y, md.m - 1, md.d, 12, 0, 0, 0));
}

/** Semana y año ISO-8601 (lunes=inicio, semana que contiene el primer jueves del año) del día natural dado. */
function isoWeekOf(md: MadridDate): { isoYear: number; isoWeek: number } {
  // Se opera sobre el día natural como fecha UTC "plana" (sin hora): el
  // cálculo ISO solo necesita año/mes/día, no el instante real.
  const d = new Date(Date.UTC(md.y, md.m - 1, md.d));
  const dayNum = d.getUTCDay() || 7; // 1=lunes..7=domingo
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // jueves de la semana ISO de `md`
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { isoYear, isoWeek };
}

/** Lunes (mediodía UTC) de la semana ISO `isoWeek` del año ISO `isoYear`. */
function isoWeekMonday(isoYear: number, isoWeek: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12, 0, 0));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Dow - 1) * 86_400_000);
  return new Date(week1Monday.getTime() + (isoWeek - 1) * 7 * 86_400_000);
}

/**
 * Clave del periodo al que pertenece `date` según `frequency`:
 * '2026-09-21' (DAILY) | '2026-W38' (WEEKLY, ISO) | '2026-09' (MONTHLY) |
 * '2026-Q3' (QUARTERLY) | '2026' (ANNUAL).
 */
export function computePeriodKey(
  date: Date,
  frequency: ChecklistFrequency,
): string {
  const md = madridCalendarDay(date);
  switch (frequency) {
    case "DAILY":
      return `${md.y}-${pad(md.m)}-${pad(md.d)}`;
    case "WEEKLY": {
      const { isoYear, isoWeek } = isoWeekOf(md);
      return `${isoYear}-W${pad(isoWeek)}`;
    }
    case "MONTHLY":
      return `${md.y}-${pad(md.m)}`;
    case "QUARTERLY":
      return `${md.y}-Q${Math.ceil(md.m / 3)}`;
    case "ANNUAL":
      return `${md.y}`;
    default:
      throw new Error(`Frecuencia de checklist desconocida: ${frequency}`);
  }
}

/** Instante de inicio (mediodía UTC del primer día) del periodo identificado por `periodKey`. */
export function periodStartFromKey(
  periodKey: string,
  frequency: ChecklistFrequency,
): Date {
  switch (frequency) {
    case "DAILY": {
      const [y, m, d] = periodKey.split("-").map(Number);
      return noonUtc({ y, m, d });
    }
    case "WEEKLY": {
      const [yStr, wStr] = periodKey.split("-W");
      return isoWeekMonday(Number(yStr), Number(wStr));
    }
    case "MONTHLY": {
      const [y, m] = periodKey.split("-").map(Number);
      return noonUtc({ y, m, d: 1 });
    }
    case "QUARTERLY": {
      const [yStr, qStr] = periodKey.split("-Q");
      const q = Number(qStr);
      return noonUtc({ y: Number(yStr), m: (q - 1) * 3 + 1, d: 1 });
    }
    case "ANNUAL":
      return noonUtc({ y: Number(periodKey), m: 1, d: 1 });
    default:
      throw new Error(`Frecuencia de checklist desconocida: ${frequency}`);
  }
}

/** Instante en que termina el periodo (= inicio del siguiente periodo). */
export function periodEndFromKey(
  periodKey: string,
  frequency: ChecklistFrequency,
): Date {
  const start = periodStartFromKey(periodKey, frequency);
  switch (frequency) {
    case "DAILY":
      return new Date(start.getTime() + 86_400_000);
    case "WEEKLY":
      return new Date(start.getTime() + 7 * 86_400_000);
    case "MONTHLY": {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + 1; // 1-12
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      return noonUtc({ y: nextY, m: nextM, d: 1 });
    }
    case "QUARTERLY": {
      const y = start.getUTCFullYear();
      const m = start.getUTCMonth() + 1; // 1,4,7,10
      const nextM = m + 3 > 12 ? m + 3 - 12 : m + 3;
      const nextY = m + 3 > 12 ? y + 1 : y;
      return noonUtc({ y: nextY, m: nextM, d: 1 });
    }
    case "ANNUAL":
      return noonUtc({ y: start.getUTCFullYear() + 1, m: 1, d: 1 });
    default:
      throw new Error(`Frecuencia de checklist desconocida: ${frequency}`);
  }
}

/** True si el periodo `periodKey` ya terminó respecto a `now` (candidato a cerrar OPEN → INCOMPLETE). */
export function isPeriodElapsed(
  periodKey: string,
  frequency: ChecklistFrequency,
  now: Date,
): boolean {
  return periodEndFromKey(periodKey, frequency).getTime() <= now.getTime();
}

/**
 * True si `now` es el día en que corresponde generar la hoja de una plantilla
 * WEEKLY (según `weekday`, 0=domingo..6=sábado, estilo `Date#getDay`) o
 * MONTHLY (según `dayOfMonth`, 1-31 — si el mes es más corto, se genera el
 * último día del mes). DAILY siempre genera; QUARTERLY/ANNUAL generan el
 * primer día del periodo.
 */
export function isGenerationDay(
  now: Date,
  frequency: ChecklistFrequency,
  weekday?: number | null,
  dayOfMonth?: number | null,
): boolean {
  const md = madridCalendarDay(now);
  switch (frequency) {
    case "DAILY":
      return true;
    case "WEEKLY": {
      if (weekday === undefined || weekday === null) {
        return true;
      }
      const jsDow = noonUtc(md).getUTCDay(); // 0=domingo..6=sábado
      return jsDow === weekday;
    }
    case "MONTHLY": {
      if (dayOfMonth === undefined || dayOfMonth === null) {
        return md.d === 1;
      }
      const lastDayOfMonth = new Date(
        Date.UTC(md.y, md.m, 0, 12, 0, 0, 0),
      ).getUTCDate();
      const target = Math.min(dayOfMonth, lastDayOfMonth);
      return md.d === target;
    }
    case "QUARTERLY":
      return md.d === 1 && [1, 4, 7, 10].includes(md.m);
    case "ANNUAL":
      return md.d === 1 && md.m === 1;
    default:
      return false;
  }
}
