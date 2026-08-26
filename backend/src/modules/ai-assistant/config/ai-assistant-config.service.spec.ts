import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../common/services/prisma.service";
import { AiAssistantConfigService } from "./ai-assistant-config.service";

/**
 * Mock realista de la tabla Configuration: un Map por (tenantId,key) que
 * soporta upsert (con tenantId_key) y findMany por clave. Así el roundtrip
 * cifrado decrypt(encrypt(x)) === x se ejercita de verdad.
 */
function makePrismaMock() {
  const store = new Map<
    string,
    { tenantId: string; key: string; value: string }
  >();
  const pk = (tenantId: string, key: string) => `${tenantId}:${key}`;
  return {
    store,
    configuration: {
      upsert: jest.fn(async (args: any) => {
        const { tenantId, key } = args.where.tenantId_key;
        const value = args.update?.value ?? args.create?.value;
        store.set(pk(tenantId, key), { tenantId, key, value });
        return store.get(pk(tenantId, key));
      }),
      findMany: jest.fn(async (args: any) => {
        const keys: string[] = args.where.key?.in ?? [];
        const tenantId = args.where.tenantId;
        return [...store.values()].filter(
          (r) => r.tenantId === tenantId && keys.includes(r.key),
        );
      }),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
}

describe("AiAssistantConfigService", () => {
  let service: AiAssistantConfigService;
  let prisma: ReturnType<typeof makePrismaMock>;
  const ORIGINAL_KEY = process.env.CONFIG_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CONFIG_ENCRYPTION_KEY =
      "test-secret-key-for-ai-assistant-config-spec";
  });
  afterAll(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.CONFIG_ENCRYPTION_KEY;
    } else {
      process.env.CONFIG_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistantConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AiAssistantConfigService);
  });

  describe("getPublicConfig", () => {
    it("devuelve provider/model null y hasApiKey=false cuando no hay nada guardado", async () => {
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({ provider: null, model: null, hasApiKey: false });
    });

    it("refleja proveedor/modelo y la presencia de key tras guardar", async () => {
      await service.saveConfig(
        "t1",
        { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-abc" },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({
        provider: "openai",
        model: "gpt-4o-mini",
        hasApiKey: true,
      });
    });
  });

  describe("saveConfig", () => {
    it("nunca expone la API key en claro en getPublicConfig", async () => {
      await service.saveConfig(
        "t1",
        {
          provider: "gemini",
          model: "gemini-2.0-flash",
          apiKey: "AQ.super-secreta",
        },
        "u1",
      );
      const cfg: any = await service.getPublicConfig("t1");
      expect(JSON.stringify(cfg)).not.toContain("AQ.super-secreta");
      expect(cfg.hasApiKey).toBe(true);
    });

    it("cifra la API key (no se guarda en claro)", async () => {
      await service.saveConfig(
        "t1",
        { provider: "openai", model: "gpt-4o", apiKey: "sk-super-secreta" },
        "u1",
      );
      const row = prisma.store.get("t1:assistant.api_key");
      expect(row?.value).not.toContain("sk-super-secreta");
      expect(row?.value.split(":").length).toBe(3); // iv:tag:cipher
    });

    it("conserva la key existente si se omite (permite cambiar modelo sin retipear)", async () => {
      await service.saveConfig(
        "t1",
        {
          provider: "anthropic",
          model: "claude-3-5-haiku-latest",
          apiKey: "sk-ant-xyz",
        },
        "u1",
      );
      await service.saveConfig(
        "t1",
        { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg.model).toBe("claude-3-5-sonnet-latest");
      expect(cfg.hasApiKey).toBe(true);
    });
  });

  describe("resolveForRequest", () => {
    it("devuelve null si falta proveedor/modelo/key", async () => {
      const r = await service.resolveForRequest("t1");
      expect(r).toBeNull();
    });

    it("devuelve la config descifrada cuando está completa", async () => {
      await service.saveConfig(
        "t1",
        { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-real-key" },
        "u1",
      );
      const r = await service.resolveForRequest("t1");
      expect(r).toEqual({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-real-key",
      });
    });

    it("aísla tenants: t2 no ve la config de t1", async () => {
      await service.saveConfig(
        "t1",
        { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-t1" },
        "u1",
      );
      const r = await service.resolveForRequest("t2");
      expect(r).toBeNull();
    });
  });
});
