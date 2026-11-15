import type { PunchGeofenceStatus, PunchType, WorkStatus, WorkdayPunch } from './check-in-types';

export const PUNCH_LABELS: Record<PunchType, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  BREAK_START: 'Inicio de pausa',
  BREAK_END: 'Fin de pausa',
};

/** Texto del botón: la acción que se va a fichar. */
export const PUNCH_ACTION_LABELS: Record<PunchType, string> = {
  IN: 'Fichar entrada',
  OUT: 'Fichar salida',
  BREAK_START: 'Empezar pausa',
  BREAK_END: 'Terminar pausa',
};

export const STATUS_LABELS: Record<WorkStatus, string> = {
  OUT: 'Fuera',
  IN: 'Trabajando',
  ON_BREAK: 'En pausa',
};

/** Color del círculo de estado: verde trabajando, ámbar en pausa, gris fuera. */
export const STATUS_DOT: Record<WorkStatus, string> = {
  IN: 'bg-green-500',
  ON_BREAK: 'bg-amber-500',
  OUT: 'bg-[var(--outline-variant)]',
};

export const GEOFENCE_LABELS: Record<PunchGeofenceStatus, string | null> = {
  INSIDE: null,
  OFF: null,
  OUTSIDE: 'Fuera de zona',
  UNAVAILABLE: 'Sin ubicación',
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export const formatDayTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Identificador del fichaje, generado en el dispositivo: reenviarlo no duplica. */
export function newPunchId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID solo existe en contexto seguro (https o localhost).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DevicePosition {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

/**
 * Ubicación del dispositivo en este instante, o null si no hay permiso, no
 * hay señal o tarda demasiado. Nunca rechaza: sin ubicación se ficha igual y
 * el servidor lo marca como "sin ubicación".
 */
export function getDevicePosition(timeoutMs = 8000): Promise<DevicePosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

/** 510 -> "8 h 30 min". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

/** Horas semanales pactadas de una ficha: null -> "Sin pactar". */
export const formatWeeklyHours = (hours: number | null, unit = ' h') =>
  hours === null ? 'Sin pactar' : `${hours}${unit}`;

/** Hora de un instante en la zona horaria del centro. */
export const formatTimeIn = (iso: string, timezone: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

/** "2026-10-05" -> "lun, 5 oct". Se trata como fecha de calendario, sin zona. */
export const formatDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const INCIDENCE_LABELS: Record<string, string> = {
  SIN_SALIDA: 'Falta fichar la salida',
  SECUENCIA: 'Fichajes que no encajan',
};

/**
 * Instante de un fichaje que se corrige a mano en la jornada `date`. La
 * jornada incluye lo fichado pasada la medianoche si el turno empezó ese día,
 * así que una salida o pausa con hora anterior al fichaje que la precede es
 * del día siguiente (salida a las 00:30 de un turno que entró a las 20:00).
 * Las entradas nunca se pasan al día siguiente. La hora se interpreta en el
 * horario de este dispositivo.
 */
export function correctedPunchInstant(
  date: string,
  time: string,
  type: PunchType,
  dayPunches: WorkdayPunch[],
  targetId?: string,
): { occurredAt: Date; nextDay: boolean } {
  const sameDay = new Date(`${date}T${time}`);
  if (type === 'IN') return { occurredAt: sameDay, nextDay: false };

  const counted = dayPunches.filter((p) => !p.voided && p.id !== targetId);
  // Al sustituir, manda el fichaje anterior al que se corrige; al añadir,
  // el primero de la jornada (antes de él no hay nada que cerrar).
  const targetIndex = targetId ? dayPunches.findIndex((p) => p.id === targetId) : -1;
  const reference = targetId
    ? dayPunches.slice(0, Math.max(targetIndex, 0)).filter((p) => !p.voided).at(-1)
    : counted[0];
  if (!reference || sameDay >= new Date(reference.occurredAt)) {
    return { occurredAt: sameDay, nextDay: false };
  }
  const nextDay = new Date(sameDay);
  nextDay.setDate(nextDay.getDate() + 1);
  return { occurredAt: nextDay, nextDay: true };
}
