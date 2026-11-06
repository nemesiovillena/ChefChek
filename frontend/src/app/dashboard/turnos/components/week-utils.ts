/** Fechas de calendario "AAAA-MM-DD" para el planificador (sin zonas horarias). */

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Lunes de la semana de una fecha local. */
export function mondayOf(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (copy.getDay() + 6) % 7; // lunes = 0
  copy.setDate(copy.getDate() - weekday);
  return toIso(copy);
}

/** Lunes de la semana de una fecha "AAAA-MM-DD". */
export function mondayOfIso(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return mondayOf(new Date(year, month - 1, day));
}

/** Hoy como "AAAA-MM-DD" (hora local). */
export const todayIso = () => toIso(new Date());

/** Mismo día del mes siguiente o anterior; se queda en el día 1 para no saltar meses cortos. */
export function addMonthsIso(date: string, months: number): string {
  const [year, month] = date.split('-').map(Number);
  return toIso(new Date(year, month - 1 + months, 1));
}

/** Lunes de cada semana que toca el mes de la fecha dada (de 4 a 6). */
export function mondaysOfMonth(date: string): string[] {
  const [year, month] = date.split('-').map(Number);
  const last = toIso(new Date(year, month, 0));
  const mondays: string[] = [];
  for (let monday = mondayOfIso(`${date.slice(0, 7)}-01`); monday <= last; monday = addDaysIso(monday, 7)) {
    mondays.push(monday);
  }
  return mondays;
}

/** "2026-11-02" -> "lunes, 2 de noviembre de 2026". */
export const formatDayLong = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** "2026-11-02" -> "noviembre de 2026". */
export const formatMonth = (date: string) =>
  new Date(`${date.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** "09:30" -> 570. */
export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return toIso(new Date(year, month - 1, day + days));
}

/** "2026-11-02" -> "lun 2". */
export const formatWeekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/** Semana "2 – 8 nov 2026". */
export function formatWeekRange(weekStart: string): string {
  const end = addDaysIso(weekStart, 6);
  const fmt = (date: string, withMonth: boolean) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' } : {}),
      timeZone: 'UTC',
    });
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `${fmt(weekStart, !sameMonth)} – ${fmt(end, true)} ${end.slice(0, 4)}`;
}

/** 384 -> "384 €"; 95.5 -> "95,50 €". */
export const formatEuros = (amount: number) =>
  amount.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });

/** 450 -> "7,5 h". */
export const formatHours = (minutes: number) =>
  `${(Math.round((minutes / 60) * 10) / 10).toString().replace('.', ',')} h`;
