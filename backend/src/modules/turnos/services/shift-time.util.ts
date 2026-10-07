/** Utilidades de horario de un turno ("HH:MM" a "HH:MM"). */

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * Intervalo del turno en minutos desde la medianoche del día en que empieza.
 * Si la hora de fin no es posterior a la de inicio, el turno termina al día
 * siguiente (22:00-02:00 -> [1320, 1560)).
 */
export function shiftInterval(
  startTime: string,
  endTime: string,
): [number, number] {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);
  if (end <= start) {
    end += 24 * 60;
  }
  return [start, end];
}

/** Minutos de trabajo planificados: duración menos la pausa. */
export function shiftWorkMinutes(shift: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}): number {
  const [start, end] = shiftInterval(shift.startTime, shift.endTime);
  return Math.max(0, end - start - shift.breakMinutes);
}

/** ¿Se pisan dos turnos del mismo día? Tocarse en el borde no es pisarse. */
export function shiftsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  const [aStart, aEnd] = shiftInterval(a.startTime, a.endTime);
  const [bStart, bEnd] = shiftInterval(b.startTime, b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/** Lunes de la semana de una fecha (UTC), o null si la fecha no es un lunes válido. */
export function isMonday(date: Date): boolean {
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
