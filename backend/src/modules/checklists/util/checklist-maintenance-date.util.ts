/**
 * Aritmética de fechas para el calendario de mantenimiento (fase 4): sumar
 * `periodicityMonths` a una fecha, con clamp al último día del mes destino
 * cuando el día de origen no existe ahí (31 ene + 1 mes → 28/29 feb, no 3
 * mar). Todo en UTC — `nextDueAt` es una fecha de calendario (revisión
 * pendiente), no un instante sensible a huso horario como sí lo son los
 * periodos de hojas de fase 2.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );
}

/** ¿`dueAt` cae dentro de los próximos `days` días desde `now` (inclusive, sin haber vencido ya)? */
export function isDueWithin(dueAt: Date, now: Date, days: number): boolean {
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs < 0) {
    return false;
  }
  return diffMs <= days * 24 * 60 * 60 * 1000;
}

export function isOverdue(dueAt: Date, now: Date): boolean {
  return dueAt.getTime() < now.getTime();
}
