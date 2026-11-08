/** Quién hace la petición: lo que el módulo Notas necesita de `req.user`. */
export interface NoteActor {
  id: string;
  role: string;
  isSharedAccount: boolean;
}

export const NOTE_MANAGER_ROLES = ["ADMIN", "OWNER", "SUPERADMIN"];

export function noteActorFromRequest(req: any): NoteActor {
  return {
    id: req.user?.id,
    role: req.user?.role,
    isSharedAccount: req.user?.isSharedAccount === true,
  };
}

/** Gerencia = rol responsable en una cuenta personal (nunca un dispositivo compartido). */
export function isNoteManager(actor: NoteActor): boolean {
  return !actor.isSharedAccount && NOTE_MANAGER_ROLES.includes(actor.role);
}

/**
 * Instante en que acaba el día de hoy en `timeZone` (00:00 de mañana allí).
 * Las notas con aviso anterior a ese instante «vencen hoy» o están vencidas.
 */
export function endOfTodayIn(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  // 00:00 de mañana como si fuera UTC, luego se corrige con el desfase de la zona.
  const naive = Date.UTC(get("year"), get("month") - 1, get("day") + 1);
  return new Date(naive - zoneOffsetMs(timeZone, new Date(naive)));
}

function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}
