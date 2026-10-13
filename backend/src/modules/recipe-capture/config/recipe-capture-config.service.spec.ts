import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../../common/services/prisma.service";
import { RecipeCaptureConfigService } from "./recipe-capture-config.service";

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

describe("RecipeCaptureConfigService", () => {
  let service: RecipeCaptureConfigService;
  let prisma: ReturnType<typeof makePrismaMock>;
  const ORIGINAL_KEY = process.env.CONFIG_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CONFIG_ENCRYPTION_KEY =
      "test-secret-key-for-recipe-capture-config-spec";
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
        RecipeCaptureConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(RecipeCaptureConfigService);
  });

  describe("getPublicConfig", () => {
    it("devuelve provider/model null y hasApiKey=false cuando no hay nada guardado", async () => {
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({
        provider: null,
        model: null,
        hasApiKey: false,
        isReady: false,
      });
    });

    it("refleja proveedor/modelo y la presencia de key tras guardar", async () => {
      await service.saveConfig(
        "t1",
        {
          provider: "opencode",
          model: "deepseek-v4-flash-vision-exp",
          apiKey: "sk-oc",
        },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({
        provider: "opencode",
        model: "deepseek-v4-flash-vision-exp",
        hasApiKey: true,
        isReady: true,
      });
    });
  });

  describe("saveConfig", () => {
    it("nunca expone la API key en claro en getPublicConfig", async () => {
      await service.saveConfig(
        "t1",
        {
          provider: "gemini",
          model: "gemini-flash-latest",
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
      const row = prisma.store.get("t1:recipe_capture.api_key");
      expect(row?.value).not.toContain("sk-super-secreta");
      expect(row?.value.split(":").length).toBe(3); // iv:tag:cipher
    });

    it("conserva la key existente si se omite (permite cambiar modelo sin retipear)", async () => {
      await service.saveConfig(
        "t1",
        {
          provider: "anthropic",
          model: "claude-haiku-4-5-20251001",
          apiKey: "sk-ant-xyz",
        },
        "u1",
      );
      await service.saveConfig(
        "t1",
        { provider: "anthropic", model: "claude-sonnet-4-5" },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg.model).toBe("claude-sonnet-4-5");
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
