import { VacationDayType } from "@prisma/client";

const DAY_MS = 86_400_000;

/** "2026-10-05" -> Date a medianoche UTC (así se guardan las fechas sin hora). */
export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Días naturales entre dos fechas, ambas incluidas. */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    days.push(new Date(t));
  }
  return days;
}

export interface DayCountOptions {
  dayType: VacationDayType;
  /** Festivos aplicables a la persona, como "AAAA-MM-DD". */
  holidays: Set<string>;
  halfDay?: boolean;
  /** Si se indica, solo cuentan los días que caen en ese año. */
  year?: number;
}

/**
 * Días que consume una ausencia.
 *  - NATURAL: todos los días del calendario.
 *  - WORKING: de lunes a viernes, sin festivos.
 * Media jornada (solo ausencias de un día) cuenta 0,5.
 */
export function countAbsenceDays(
  start: Date,
  end: Date,
  options: DayCountOptions,
): number {
  let total = 0;
  for (const day of eachDay(start, end)) {
    if (options.year !== undefined && day.getUTCFullYear() !== options.year) {
      continue;
    }
    if (options.dayType === VacationDayType.WORKING) {
      const weekday = day.getUTCDay();
      if (weekday === 0 || weekday === 6) {
        continue;
      }
      if (options.holidays.has(formatDate(day))) {
        continue;
      }
    }
    total += 1;
  }
  return options.halfDay && total === 1 ? 0.5 : total;
}

/**
 * Vacaciones que corresponden en un año. Quien entra a mitad de año tiene la
 * parte proporcional, redondeada al medio día.
 */
export function defaultEntitlement(
  yearlyDays: number,
  year: number,
  hireDate: Date | null,
): number {
  if (!hireDate || hireDate.getUTCFullYear() < year) {
    return yearlyDays;
  }
  if (hireDate.getUTCFullYear() > year) {
    return 0;
  }
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  const hired = Date.UTC(
    hireDate.getUTCFullYear(),
    hireDate.getUTCMonth(),
    hireDate.getUTCDate(),
  );
  const fraction = (yearEnd - hired) / (yearEnd - yearStart);
  return Math.round(yearlyDays * fraction * 2) / 2;
}
