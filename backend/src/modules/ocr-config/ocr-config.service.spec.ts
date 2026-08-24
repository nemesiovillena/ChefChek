import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../common/services/prisma.service";
import { OcrConfigService } from "./ocr-config.service";

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

describe("OcrConfigService", () => {
  let service: OcrConfigService;
  let prisma: ReturnType<typeof makePrismaMock>;
  const ORIGINAL_KEY = process.env.CONFIG_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CONFIG_ENCRYPTION_KEY = "test-secret-key-for-ocr-config-spec";
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
        OcrConfigService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OcrConfigService);
  });

  describe("getPublicConfig", () => {
    it("devuelve model='regex' y hasApiKey=false cuando no hay nada guardado", async () => {
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({ model: "regex", hasApiKey: false });
    });

    it("refleja el modelo y la presencia de key tras guardar", async () => {
      await service.saveConfig(
        "t1",
        { model: "openrouter-gemini-flash", apiKey: "sk-or-v1-abc" },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg).toEqual({
        model: "openrouter-gemini-flash",
        hasApiKey: true,
      });
    });
  });

  describe("saveConfig", () => {
    it("cifra la API key (no se guarda en claro)", async () => {
      await service.saveConfig(
        "t1",
        { model: "gpt-4o", apiKey: "sk-super-secreta" },
        "u1",
      );
      const row = prisma.store.get("t1:ocr.api_key");
      expect(row?.value).not.toContain("sk-super-secreta");
      expect(row?.value.split(":").length).toBe(3); // iv:tag:cipher
    });

    it("conserva la key existente si se omite (permite cambiar modelo sin retipear)", async () => {
      await service.saveConfig(
        "t1",
        { model: "gpt-4o", apiKey: "sk-xyz" },
        "u1",
      );
      await service.saveConfig(
        "t1",
        { model: "claude-haiku-4-5-20251001" },
        "u1",
      );
      const cfg = await service.getPublicConfig("t1");
      expect(cfg.model).toBe("claude-haiku-4-5-20251001");
      expect(cfg.hasApiKey).toBe(true);
    });
  });

  describe("resolveForUpload", () => {
    it("prioriza lo que envía el cliente sobre lo guardado (backward compat)", async () => {
      await service.saveConfig(
        "t1",
        { model: "gpt-4o", apiKey: "sk-stored" },
        "u1",
      );
      const r = await service.resolveForUpload("t1", {
        aiModel: "openrouter-gemini-flash",
        aiApiKey: "sk-or-request",
      });
      expect(r).toEqual({
        aiModel: "openrouter-gemini-flash",
        aiApiKey: "sk-or-request",
      });
    });

    it("cae a la config guardada cuando el cliente no envía nada (multi-device)", async () => {
      await service.saveConfig(
        "t1",
        { model: "openrouter-gemini-flash", apiKey: "sk-or-stored" },
        "u1",
      );
      const r = await service.resolveForUpload("t1", {});
      expect(r).toEqual({
        aiModel: "openrouter-gemini-flash",
        aiApiKey: "sk-or-stored",
      });
    });

    it("cae a la config guardada aunque el cliente envíe model='regex' (móvil sin localStorage)", async () => {
      await service.saveConfig(
        "t1",
        { model: "openrouter-gemini-flash", apiKey: "sk-or-stored" },
        "u1",
      );
      // El front envía aiModel=undefined cuando getOcrModel()==='regex'
      const r = await service.resolveForUpload("t1", { aiModel: undefined });
      expect(r.aiModel).toBe("openrouter-gemini-flash");
      expect(r.aiApiKey).toBe("sk-or-stored");
    });

    it("devuelve regex (undefined) si no hay modelo guardado ni en la petición", async () => {
      const r = await service.resolveForUpload("t1", {});
      expect(r).toEqual({ aiModel: undefined, aiApiKey: undefined });
    });

    it("devuelve regex si hay modelo guardado pero no hay key", async () => {
      await service.saveConfig("t1", { model: "gpt-4o" }, "u1"); // sin apiKey
      const r = await service.resolveForUpload("t1", {});
      expect(r).toEqual({ aiModel: undefined, aiApiKey: undefined });
    });

    it("respeta que el tenant haya elegido 'regex' explícitamente", async () => {
      await service.saveConfig("t1", { model: "regex", apiKey: "sk-x" }, "u1");
      const r = await service.resolveForUpload("t1", {});
      expect(r).toEqual({ aiModel: undefined, aiApiKey: undefined });
    });
  });
});
