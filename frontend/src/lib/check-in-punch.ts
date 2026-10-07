import type { PunchGeofenceStatus, PunchType, WorkStatus } from './check-in-types';

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
