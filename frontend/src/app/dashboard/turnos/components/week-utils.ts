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

/** 450 -> "7,5 h". */
export const formatHours = (minutes: number) =>
  `${(Math.round((minutes / 60) * 10) / 10).toString().replace('.', ',')} h`;
