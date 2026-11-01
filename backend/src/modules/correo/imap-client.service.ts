import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ImapFlow, ImapFlowOptions } from "imapflow";
import { CorreoConfigService, ImapSecretConfig } from "./correo-config.service";
import {
  ImapOperationTimeoutError,
  isConnectionFailure,
  mapImapError,
} from "./imap-error-mapper";
import { resolvePublicImapHost } from "./imap-host-validator";

/**
 * Abre una conexión IMAP por operación y la cierra siempre. Protecciones:
 * - máx. 2 conexiones simultáneas por tenant y cola de 6 (resto → 503);
 * - tope de 25 s por operación: al vencer se corta el socket;
 * - `on('error')` antes de conectar: un fallo del socket nunca tumba el proceso;
 * - breaker: 3 fallos seguidos de conexión/login → 3 min sin tocar el servidor
 *   (evita que Hostinger bloquee la IP por intentos repetidos).
 */
export const MAX_CONNECTIONS_PER_TENANT = 2;
export const MAX_QUEUED_PER_TENANT = 6;
export const OPERATION_TIMEOUT_MS = 25_000;
export const BREAKER_FAILURES = 3;
export const BREAKER_OPEN_MS = 3 * 60_000;
const LOGOUT_GRACE_MS = 3_000;

const MAILBOX_BUSY = "Buzón ocupado, reinténtalo en unos segundos.";

interface Waiter {
  grant: () => void;
}

@Injectable()
export class ImapClientService {
  private readonly logger = new Logger(ImapClientService.name);
  private readonly slots = new Map<
    string,
    { active: number; queue: Waiter[] }
  >();
  private readonly breaker = new Map<
    string,
    { fails: number; openUntil: number }
  >();

  constructor(private readonly config: CorreoConfigService) {}

  /** Ejecuta `fn` con un cliente ya conectado; los errores salen como HttpException. */
  async withClient<T>(
    tenantId: string,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    this.assertBreakerClosed(tenantId);
    const release = await this.acquire(tenantId);
    try {
      // Mientras esperaba en cola otro intento pudo abrir el breaker: no insistir
      this.assertBreakerClosed(tenantId);
      const cfg = await this.config.getSecret(tenantId);
      return await this.run(tenantId, cfg, fn);
    } finally {
      release();
    }
  }

  /** Tras guardar credenciales nuevas se permite volver a intentar enseguida. */
  resetBreaker(tenantId: string): void {
    this.breaker.delete(tenantId);
  }

  /** Punto de extensión para tests. */
  protected createClient(options: ImapFlowOptions): ImapFlow {
    return new ImapFlow(options);
  }

  /** Punto de extensión para tests. */
  protected resolveHost(host: string): Promise<string> {
    return resolvePublicImapHost(host);
  }

  private async run<T>(
    tenantId: string,
    cfg: ImapSecretConfig,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    // Un host no permitido es error de configuración: no cuenta para el breaker
    const address = await this.resolveHost(cfg.host);

    const client = this.createClient({
      host: address,
      port: cfg.port,
      secure: true,
      servername: cfg.host, // SNI y verificación del certificado contra el nombre
      tls: { servername: cfg.host, minVersion: "TLSv1.2" },
      auth: { user: cfg.user, pass: cfg.pass },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 60_000,
    });
    client.on("error", (e: any) => {
      this.logger.warn(`IMAP ${tenantId} (socket): ${e?.code ?? e?.message}`);
    });

    let connected = false;
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ImapOperationTimeoutError()),
        OPERATION_TIMEOUT_MS,
      );
    });
    const work = (async () => {
      await client.connect();
      connected = true;
      return fn(client);
    })();
    // Si gana el tope, `work` puede rechazar más tarde: que no quede sin capturar
    work.catch(() => undefined);

    try {
      const result = await Promise.race([work, deadline]);
      this.recordSuccess(tenantId);
      await this.logoutQuietly(client);
      return result;
    } catch (err) {
      this.closeQuietly(client);
      // Un tope vencido con la sesión ya abierta es lentitud, no un fallo de conexión
      const timedOutAfterLogin =
        connected && err instanceof ImapOperationTimeoutError;
      if (isConnectionFailure(err) && !timedOutAfterLogin) {
        this.recordFailure(tenantId);
      } else if (connected) {
        this.recordSuccess(tenantId);
      }
      throw mapImapError(err, this.logger, tenantId);
    } finally {
      clearTimeout(timer);
    }
  }

  private async logoutQuietly(client: ImapFlow): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, LOGOUT_GRACE_MS);
    });
    try {
      await Promise.race([client.logout().catch(() => undefined), grace]);
    } finally {
      clearTimeout(timer);
      this.closeQuietly(client);
    }
  }

  private closeQuietly(client: ImapFlow): void {
    try {
      client.close();
    } catch {
      /* ya cerrado */
    }
  }

  // ── Semáforo por tenant ───────────────────────────────────────────────

  private acquire(tenantId: string): Promise<() => void> {
    let slot = this.slots.get(tenantId);
    if (!slot) {
      slot = { active: 0, queue: [] };
      this.slots.set(tenantId, slot);
    }
    if (slot.active < MAX_CONNECTIONS_PER_TENANT) {
      slot.active++;
      return Promise.resolve(this.releaser(tenantId));
    }
    if (slot.queue.length >= MAX_QUEUED_PER_TENANT) {
      return Promise.reject(new ServiceUnavailableException(MAILBOX_BUSY));
    }
    const queue = slot.queue;
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        grant: () => {
          clearTimeout(timer);
          resolve(this.releaser(tenantId));
        },
      };
      const timer = setTimeout(() => {
        const idx = queue.indexOf(waiter);
        if (idx >= 0) {
          queue.splice(idx, 1);
        }
        reject(new ServiceUnavailableException(MAILBOX_BUSY));
      }, OPERATION_TIMEOUT_MS);
      queue.push(waiter);
    });
  }

  /** Libera una vez: pasa el hueco al siguiente en cola o lo devuelve. */
  private releaser(tenantId: string): () => void {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      const slot = this.slots.get(tenantId);
      if (!slot) {
        return;
      }
      const next = slot.queue.shift();
      if (next) {
        next.grant(); // el hueco pasa directamente: `active` no cambia
        return;
      }
      slot.active--;
      if (slot.active <= 0) {
        this.slots.delete(tenantId);
      }
    };
  }

  // ── Circuit breaker por tenant ────────────────────────────────────────

  /** 503 si el breaker está abierto (también antes de enviar por SMTP). */
  assertBreakerClosed(tenantId: string): void {
    const b = this.breaker.get(tenantId);
    if (b && b.openUntil > Date.now()) {
      throw new ServiceUnavailableException(
        "Demasiados fallos al conectar con el buzón. Espera unos minutos antes de reintentar.",
      );
    }
  }

  /** Un login fallido por SMTP también cuenta: es el mismo buzón y la misma IP. */
  reportExternalFailure(tenantId: string): void {
    this.recordFailure(tenantId);
  }

  private recordFailure(tenantId: string): void {
    const now = Date.now();
    const b = this.breaker.get(tenantId) ?? { fails: 0, openUntil: 0 };
    b.fails++;
    if (b.fails >= BREAKER_FAILURES) {
      b.fails = 0;
      b.openUntil = now + BREAKER_OPEN_MS;
      this.logger.warn(
        `IMAP ${tenantId}: ${BREAKER_FAILURES} fallos seguidos, pausa de ${BREAKER_OPEN_MS / 60_000} min`,
      );
    }
    this.breaker.set(tenantId, b);
  }

  private recordSuccess(tenantId: string): void {
    this.breaker.delete(tenantId);
  }
}
