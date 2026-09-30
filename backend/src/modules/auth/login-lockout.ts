import { HttpException, HttpStatus } from "@nestjs/common";

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
  lastFailureAt: number;
}

/**
 * Bloqueo de cuenta por intentos fallidos de login: tras `maxFailures` fallos
 * seguidos la cuenta queda bloqueada `lockMs`; un login correcto pone el
 * contador a cero. Frena el ataque por fuerza bruta a contraseñas cortas
 * (4 caracteres), que el límite global por IP no para porque detrás del
 * proxy todas las peticiones comparten IP.
 *
 * Se guarda en memoria: el backend corre en un único contenedor y un
 * reinicio solo desbloquea antes de tiempo. La clave no distingue si el
 * usuario existe, así que no revela qué emails están dados de alta.
 */
export class LoginLockout {
  private readonly attempts = new Map<string, AttemptRecord>();

  constructor(
    private readonly maxFailures = 5,
    private readonly lockMs = 15 * 60 * 1000,
    private readonly maxEntries = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Lanza 429 si la cuenta está bloqueada. */
  assertNotLocked(key: string): void {
    const record = this.attempts.get(key);
    if (!record?.lockedUntil) {
      return;
    }
    const remainingMs = record.lockedUntil - this.now();
    if (remainingMs <= 0) {
      this.attempts.delete(key);
      return;
    }
    const minutes = Math.ceil(remainingMs / 60_000);
    throw new HttpException(
      `Demasiados intentos fallidos. Cuenta bloqueada ${minutes} min; vuelve a intentarlo después.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  registerFailure(key: string): void {
    const now = this.now();
    const record = this.attempts.get(key) ?? {
      failures: 0,
      lockedUntil: null,
      lastFailureAt: now,
    };
    // Fallos sueltos muy separados en el tiempo no suman para siempre.
    if (now - record.lastFailureAt > this.lockMs) {
      record.failures = 0;
    }
    record.failures += 1;
    record.lastFailureAt = now;
    if (record.failures >= this.maxFailures) {
      record.lockedUntil = now + this.lockMs;
      record.failures = 0;
    }
    this.attempts.set(key, record);
    this.prune(now);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  static key(scope: string, email: string): string {
    return `${scope.trim().toLowerCase()}:${email.trim().toLowerCase()}`;
  }

  /** Evita que un barrido de emails inventados haga crecer el mapa sin fin. */
  private prune(now: number): void {
    if (this.attempts.size <= this.maxEntries) {
      return;
    }
    for (const [key, record] of this.attempts) {
      const stale = record.lockedUntil
        ? record.lockedUntil <= now
        : now - record.lastFailureAt > this.lockMs;
      if (stale) {
        this.attempts.delete(key);
      }
    }
  }
}
