import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../common/services/prisma.service";
import {
  BUILTIN_CONSERVATION_DEFAULTS,
  ConservationDefaultsService,
} from "./conservation-defaults.service";

function makePrismaMock() {
  const store = new Map<
    string,
    { tenantId: string; key: string; value: string }
  >();
  const pk = (tenantId: string, key: string) => `${tenantId}:${key}`;
  return {
    store,
    configuration: {
      findUnique: jest.fn(async (args: any) => {
        const { tenantId, key } = args.where.tenantId_key;
        return store.get(pk(tenantId, key)) ?? null;
      }),
      upsert: jest.fn(async (args: any) => {
        const { tenantId, key } = args.where.tenantId_key;
        const value = args.update?.value ?? args.create?.value;
        store.set(pk(tenantId, key), { tenantId, key, value });
        return store.get(pk(tenantId, key));
      }),
    },
  };
}

describe("ConservationDefaultsService", () => {
  let service: ConservationDefaultsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConservationDefaultsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ConservationDefaultsService);
  });

  it("devuelve los defaults built-in cuando el tenant no ha guardado nada", async () => {
    const defaults = await service.getDefaults("t1");
    expect(defaults).toEqual(BUILTIN_CONSERVATION_DEFAULTS);
  });

  it("guarda y refleja overrides parciales sin perder el resto", async () => {
    await service.setDefaults("t1", { refrigeratedShelfLifeDays: 5 }, "u1");
    const defaults = await service.getDefaults("t1");
    expect(defaults.refrigerated).toEqual({
      tempMin: 2,
      tempMax: 5,
      shelfLifeDays: 5,
    });
    expect(defaults.frozen).toEqual(BUILTIN_CONSERVATION_DEFAULTS.frozen);
  });

  it("acumula ediciones sucesivas (segunda llamada parte de lo ya guardado)", async () => {
    await service.setDefaults("t1", { frozenTempMin: -20 }, "u1");
    await service.setDefaults("t1", { frozenTempMax: -12 }, "u1");
    const defaults = await service.getDefaults("t1");
    expect(defaults.frozen).toEqual({
      tempMin: -20,
      tempMax: -12,
      shelfLifeDays: 90,
    });
  });

  it("rechaza temperatura mínima mayor que la máxima", async () => {
    await expect(
      service.setDefaults(
        "t1",
        { refrigeratedTempMin: 10, refrigeratedTempMax: 5 },
        "u1",
      ),
    ).rejects.toThrow(/mínima no puede superar/);
  });

  it("rechaza vida útil no entera o no positiva", async () => {
    await expect(
      service.setDefaults("t1", { refrigeratedShelfLifeDays: 0 }, "u1"),
    ).rejects.toThrow(/Vida útil/);
    await expect(
      service.setDefaults("t1", { frozenShelfLifeDays: 3.5 }, "u1"),
    ).rejects.toThrow(/Vida útil/);
  });

  it("no mezcla los defaults entre tenants distintos", async () => {
    await service.setDefaults("t1", { refrigeratedTempMin: 0 }, "u1");
    const t2Defaults = await service.getDefaults("t2");
    expect(t2Defaults).toEqual(BUILTIN_CONSERVATION_DEFAULTS);
  });
});
