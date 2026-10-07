import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { PunchType, WorkStatus } from './check-in-types';

/**
 * Fichaje sin conexión: cola local de fichajes pendientes y copia de los
 * últimos datos necesarios para poder fichar sin red.
 *
 * Todo vive en localStorage (no en IndexedDB): la cola es diminuta, la
 * escritura es síncrona (el fichaje queda guardado antes de enseñar el "ok")
 * y no hay sincronización en segundo plano que obligue a leerla desde un
 * service worker: se envía al recuperar la red o al abrir la app.
 */

const QUEUE_KEY = 'chefchek.checkin.queue';
const SNAPSHOT_PREFIX = 'chefchek.checkin.snapshot.';
const CHANGE_EVENT = 'chefchek-checkin-queue';

/** Un fichaje pendiente de enviar, tal como lo espera POST /punches/sync. */
export interface QueuedPunch {
  id: string;
  type: PunchType;
  deviceTime: string;
  employeeId?: string;
  locationId?: string;
  encryptedPin?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
}

interface QueueEntry {
  /**
   * Cuenta desde la que se fichó. Un fichaje personal no lleva empleado (lo
   * deduce el servidor de la sesión), así que solo puede enviarlo esa cuenta:
   * si otra persona inicia sesión en el mismo dispositivo, no lo toca.
   */
  ownerUserId: string;
  punch: QueuedPunch;
  /** Para mostrarlo en la lista de pendientes. */
  label?: string;
}

export interface SyncOutcome {
  id: string;
  status: 'ACCEPTED' | 'DUPLICATE' | 'FLAGGED' | 'REJECTED';
  detail?: string;
}

/**
 * true si no hubo respuesta del servidor: sin red, servidor inalcanzable o
 * tiempo de espera agotado. En ese caso no se sabe si la petición llegó; por
 * eso cada fichaje lleva un id propio y reenviarlo nunca lo duplica.
 */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

// ── Cola ────────────────────────────────────────────────────────────────────

function readQueue(): QueueEntry[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: QueueEntry[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Guarda un fichaje para enviarlo después. Lanza si el dispositivo no deja
 * escribir (almacenamiento lleno o bloqueado): en ese caso NO hay que decirle
 * a la persona que ha fichado.
 */
export function enqueuePunch(ownerUserId: string, punch: QueuedPunch, label?: string) {
  writeQueue([...readQueue(), { ownerUserId, punch, label }]);
}

export function pendingPunches(ownerUserId: string | undefined): QueuedPunch[] {
  if (!ownerUserId) return [];
  return readQueue()
    .filter((entry) => entry.ownerUserId === ownerUserId)
    .map((entry) => entry.punch);
}

let syncing: Promise<SyncOutcome[]> | null = null;

/**
 * Envía los fichajes pendientes de esta cuenta. Lo aceptado, duplicado,
 * marcado o rechazado sale de la cola (el servidor ya decidió); si no hay red
 * se queda todo como está. Las llamadas simultáneas comparten el mismo envío.
 */
export function syncPendingPunches(ownerUserId: string | undefined): Promise<SyncOutcome[]> {
  if (!ownerUserId || typeof window === 'undefined') return Promise.resolve([]);
  if (syncing) return syncing;
  const punches = pendingPunches(ownerUserId);
  if (punches.length === 0) return Promise.resolve([]);

  syncing = (async () => {
    try {
      const response = await apiClient.post<SyncOutcome[]>('/v1/check-in/punches/sync', { punches });
      const outcomes = response.data;
      const settled = new Set(outcomes.map((outcome) => outcome.id));
      // Se relee la cola: puede haber entrado un fichaje nuevo mientras tanto.
      writeQueue(readQueue().filter((entry) => !settled.has(entry.punch.id)));
      return outcomes;
    } catch (error) {
      if (isNetworkError(error)) return [];
      throw error;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

// ── Suscripción (useSyncExternalStore) ──────────────────────────────────────

/** Avisa de cambios en la cola y del estado de la red. */
export function subscribeOffline(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export const isOnline = () => navigator.onLine;

// ── Copia local de los datos para fichar sin red ────────────────────────────

export function saveSnapshot<T>(name: string, data: T) {
  try {
    window.localStorage.setItem(SNAPSHOT_PREFIX + name, JSON.stringify(data));
  } catch {
    // Sin espacio: simplemente no habrá copia para la próxima vez sin red.
  }
}

export function loadSnapshot<T>(name: string): T | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_PREFIX + name);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// ── Estado local tras fichar sin red ────────────────────────────────────────
// Mismo criterio que el servidor (punch-state.util.ts): sin red no puede
// preguntársele, y hay que ofrecer el botón correcto para el siguiente fichaje.

export function statusAfterPunch(type: PunchType): WorkStatus {
  if (type === 'IN' || type === 'BREAK_END') return 'IN';
  if (type === 'BREAK_START') return 'ON_BREAK';
  return 'OUT';
}

const NEXT_TYPES: Record<WorkStatus, PunchType[]> = {
  OUT: ['IN'],
  IN: ['OUT', 'BREAK_START'],
  ON_BREAK: ['BREAK_END'],
};

/** Sin pausas no se ofrece empezar una; terminar la que esté abierta, siempre. */
export const allowedAfter = (status: WorkStatus, allowBreaks = true): PunchType[] =>
  allowBreaks ? NEXT_TYPES[status] : NEXT_TYPES[status].filter((type) => type !== 'BREAK_START');

// ── PIN del kiosco sin red ──────────────────────────────────────────────────

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Cifra "<id del fichaje>:<PIN>" con la clave pública del servidor
 * (RSA-OAEP, SHA-256). En el dispositivo solo queda este texto cifrado, que
 * no permite recuperar ni adivinar el PIN y solo vale para ese fichaje.
 */
export async function encryptPinForPunch(publicKeyBase64: string, punchId: string, pin: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'spki',
    base64ToBytes(publicKeyBase64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(`${punchId}:${pin}`),
  );
  let binary = '';
  for (const byte of new Uint8Array(encrypted)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
