/**
 * Festivos y fechas importantes sugeridos para un año. Son una propuesta: los
 * autonómicos y locales cambian cada año (los fija el DOGV y el ayuntamiento)
 * y el local los corrige en Gestión → Calendario.
 */
export type CalendarDateKind =
  | "nacional"
  | "autonomico"
  | "local"
  | "comercial"
  | "propio";

export const CALENDAR_DATE_KINDS: CalendarDateKind[] = [
  "nacional",
  "autonomico",
  "local",
  "comercial",
  "propio",
];

/** Conjuntos de sugerencias: España entera o España + Comunitat Valenciana + Villena. */
export type CalendarRegion = "nacional" | "villena";

export interface SuggestedDate {
  date: string;
  name: string;
  kind: CalendarDateKind;
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const shift = (date: string, days: number) => {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

/** Domingo de Resurrección (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Primer domingo de mayo: Día de la Madre en España. */
export function mothersDay(year: number): string {
  const first = new Date(Date.UTC(year, 4, 1)).getUTCDay(); // 0 = domingo
  return iso(year, 5, 1 + ((7 - first) % 7));
}

export function suggestedDates(
  year: number,
  region: CalendarRegion,
): SuggestedDate[] {
  const easter = easterSunday(year);
  const list: SuggestedDate[] = [
    { date: iso(year, 1, 1), name: "Año Nuevo", kind: "nacional" },
    { date: iso(year, 1, 6), name: "Reyes", kind: "nacional" },
    { date: shift(easter, -2), name: "Viernes Santo", kind: "nacional" },
    { date: iso(year, 5, 1), name: "Día del Trabajo", kind: "nacional" },
    { date: iso(year, 8, 15), name: "Asunción", kind: "nacional" },
    { date: iso(year, 10, 12), name: "Fiesta Nacional", kind: "nacional" },
    { date: iso(year, 11, 1), name: "Todos los Santos", kind: "nacional" },
    { date: iso(year, 12, 6), name: "Constitución", kind: "nacional" },
    { date: iso(year, 12, 8), name: "Inmaculada", kind: "nacional" },
    { date: iso(year, 12, 25), name: "Navidad", kind: "nacional" },
    { date: iso(year, 1, 5), name: "Víspera de Reyes", kind: "comercial" },
    { date: iso(year, 2, 14), name: "San Valentín", kind: "comercial" },
    { date: iso(year, 3, 19), name: "Día del Padre", kind: "comercial" },
    { date: shift(easter, -3), name: "Jueves Santo", kind: "comercial" },
    { date: easter, name: "Domingo de Resurrección", kind: "comercial" },
    { date: mothersDay(year), name: "Día de la Madre", kind: "comercial" },
    { date: iso(year, 12, 24), name: "Nochebuena", kind: "comercial" },
    { date: iso(year, 12, 31), name: "Nochevieja", kind: "comercial" },
  ];
  if (region === "villena") {
    list.push(
      {
        date: iso(year, 3, 19),
        name: "San José (Comunitat Valenciana, según año)",
        kind: "autonomico",
      },
      {
        date: shift(easter, 1),
        name: "Lunes de Pascua (Comunitat Valenciana)",
        kind: "autonomico",
      },
      {
        date: iso(year, 6, 24),
        name: "San Juan (Comunitat Valenciana, según año)",
        kind: "autonomico",
      },
      {
        date: iso(year, 10, 9),
        name: "Día de la Comunitat Valenciana",
        kind: "autonomico",
      },
    );
    // Moros y Cristianos de Villena, del 5 al 9 de septiembre.
    for (let d = 5; d <= 9; d++) {
      list.push({
        date: iso(year, 9, d),
        name: "Moros y Cristianos de Villena",
        kind: "local",
      });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
