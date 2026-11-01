import { EventEmitter } from "events";
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  BREAKER_FAILURES,
  ImapClientService,
  MAX_CONNECTIONS_PER_TENANT,
  MAX_QUEUED_PER_TENANT,
  OPERATION_TIMEOUT_MS,
} from "./imap-client.service";
import { isPrivateAddress, resolvePublicImapHost } from "./imap-host-validator";

class FakeImapClient extends EventEmitter {
  connect = jest.fn().mockResolvedValue(undefined);
  logout = jest.fn().mockResolvedValue(undefined);
  close = jest.fn();
}

class TestableImapClientService extends ImapClientService {
  clients: FakeImapClient[] = [];
  nextConnectError: any = null;
  protected createClient(): any {
    const c = new FakeImapClient();
    if (this.nextConnectError) {
      c.connect.mockRejectedValue(this.nextConnectError);
    }
    this.clients.push(c);
    return c;
  }
  protected resolveHost(): Promise<string> {
    return Promise.resolve("203.0.113.10");
  }
}

const tenantId = "tenant-1";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Deja correr las promesas pendientes (connect, acquire…). */
const flush = () => new Promise((r) => setImmediate(r));

describe("ImapClientService", () => {
  let service: TestableImapClientService;
  let config: any;

  beforeEach(() => {
    config = {
      getSecret: jest.fn().mockResolvedValue({
        host: "imap.hostinger.com",
        port: 993,
        user: "restaurante@warynessy.com",
        pass: "secreta",
      }),
    };
    service = new TestableImapClientService(config);
    (service as any).logger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
  });

  afterEach(() => jest.useRealTimers());

  it("como mucho 2 conexiones a la vez: la tercera espera a que termine una", async () => {
    const gates = [deferred(), deferred(), deferred()];
    let started = 0;
    const runs = gates.map((g) =>
      service.withClient(tenantId, async () => {
        started++;
        await g.promise;
        return "ok";
      }),
    );
    await flush();
    expect(started).toBe(MAX_CONNECTIONS_PER_TENANT);

    gates[0].resolve();
    await runs[0];
    await flush();
    expect(started).toBe(3);

    gates[1].resolve();
    gates[2].resolve();
    await expect(Promise.all(runs)).resolves.toEqual(["ok", "ok", "ok"]);
  });

  it("con la cola llena responde 503 sin conectar", async () => {
    const gate = deferred();
    const pending = Array.from(
      { length: MAX_CONNECTIONS_PER_TENANT + MAX_QUEUED_PER_TENANT },
      () => service.withClient(tenantId, () => gate.promise),
    );
    await flush();
    await expect(
      service.withClient(tenantId, async () => "x"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    gate.resolve();
    await Promise.all(pending);
  });

  it("una operación que no termina se corta a los 25 s y cierra el socket", async () => {
    jest.useFakeTimers();
    const run = service.withClient(
      tenantId,
      () => new Promise(() => undefined),
    );
    const assertion = expect(run).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(OPERATION_TIMEOUT_MS + 10);
    await assertion;
    expect(service.clients[0].close).toHaveBeenCalled();
    expect(service.clients[0].logout).not.toHaveBeenCalled();
  });

  it("un 'error' del socket no lanza (hay listener antes de conectar)", async () => {
    await service.withClient(tenantId, async () => {
      const client = service.clients[0];
      expect(client.listenerCount("error")).toBeGreaterThan(0);
      expect(() =>
        client.emit(
          "error",
          Object.assign(new Error("reset"), { code: "ECONNRESET" }),
        ),
      ).not.toThrow();
      return true;
    });
  });

  it("3 fallos seguidos de login abren el breaker: luego 503 sin conectar", async () => {
    service.nextConnectError = Object.assign(new Error("auth"), {
      authenticationFailed: true,
    });
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      await expect(
        service.withClient(tenantId, async () => 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    const before = service.clients.length;
    await expect(
      service.withClient(tenantId, async () => 1),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(service.clients.length).toBe(before);

    service.resetBreaker(tenantId);
    service.nextConnectError = null;
    await expect(service.withClient(tenantId, async () => 1)).resolves.toBe(1);
  });

  it("un error de negocio (409) no cuenta como fallo de conexión", async () => {
    for (let i = 0; i < BREAKER_FAILURES + 1; i++) {
      await expect(
        service.withClient(tenantId, async () => {
          throw new ConflictException("cambió");
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    }
    await expect(service.withClient(tenantId, async () => 1)).resolves.toBe(1);
  });

  it("las peticiones que esperaban en cola no insisten si el breaker se abre", async () => {
    service.nextConnectError = Object.assign(new Error("auth"), {
      authenticationFailed: true,
    });
    const runs = Array.from({ length: 8 }, () =>
      service.withClient(tenantId, async () => 1).catch((e) => e),
    );
    await Promise.all(runs);
    expect(service.clients.length).toBeLessThanOrEqual(BREAKER_FAILURES + 1);
  });

  it("un tope vencido con la sesión ya abierta no cuenta para el breaker", async () => {
    jest.useFakeTimers();
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      const run = service.withClient(
        tenantId,
        () => new Promise(() => undefined),
      );
      const assertion = expect(run).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(OPERATION_TIMEOUT_MS + 10);
      await assertion;
    }
    jest.useRealTimers();
    await expect(service.withClient(tenantId, async () => 1)).resolves.toBe(1);
  });

  it("la contraseña no aparece en el mensaje de error", async () => {
    service.nextConnectError = Object.assign(new Error("auth"), {
      authenticationFailed: true,
    });
    const err: any = await service
      .withClient(tenantId, async () => 1)
      .catch((e) => e);
    expect(JSON.stringify(err.getResponse())).not.toContain("secreta");
  });
});

describe("imap-host-validator", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.5",
    "192.168.18.160",
    "169.254.1.1",
    "100.68.34.99",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
  ])("%s es interna", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "2a00:1450:4003:80b::200e"])("%s es pública", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );

  it.each(["localhost", "127.0.0.1", "10.0.0.1"])(
    "rechaza el host %s",
    async (host) => {
      await expect(resolvePublicImapHost(host)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});
