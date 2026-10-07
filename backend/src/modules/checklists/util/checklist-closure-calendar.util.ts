/**
 * Calendario de cierre del local: qué días naturales (Madrid, 'YYYY-MM-DD')
 * no se trabaja. Único punto de verdad para generación de hojas y cobertura,
 * que deben coincidir siempre en "qué día se espera hoja".
 */

export type CalendarExceptionKind = "CLOSED" | "OPEN";

export interface ClosureCalendar {
  /** 0=domingo..6=sábado. */
  closedWeekdays: number[];
  exceptions: { kind: string; fromDay: string; toDay: string }[];
}

/** Día de la semana (0=domingo..6=sábado) de un día natural 'YYYY-MM-DD'. */
function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * True si el local cierra ese día. Una excepción OPEN manda sobre todo lo
 * demás (un festivo que cae en descanso y se abre); después las CLOSED
 * (vacaciones) y por último el descanso semanal.
 */
export function isClosedDay(
  dayKey: string,
  calendar: ClosureCalendar,
): boolean {
  // 'YYYY-MM-DD' ordena igual como texto que como fecha.
  const covering = calendar.exceptions.filter(
    (e) => e.fromDay <= dayKey && dayKey <= e.toDay,
  );
  if (covering.some((e) => e.kind === "OPEN")) {
    return false;
  }
  if (covering.some((e) => e.kind === "CLOSED")) {
    return true;
  }
  return calendar.closedWeekdays.includes(weekdayOf(dayKey));
}
