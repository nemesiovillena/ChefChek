import { BadRequestException } from "@nestjs/common";
import { LABOR_AGREEMENT_PRESETS } from "../constants/labor-agreement-presets";
import { CheckInSettingsService } from "./check-in-settings.service";

function makeService() {
  const rows = new Map<string, any>();
  const prisma: any = {
    checkInSettings: {
      upsert: jest.fn(async ({ where, create }: any) => {
        if (!rows.has(where.tenantId)) {
          rows.set(where.tenantId, {
            agreementKey: "personalizado-et",
            maxDailyHours: 9,
            breaksCountAsWork: false,
            ...create,
          });
        }
        return rows.get(where.tenantId);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.get(where.tenantId);
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            row[key] = value;
          }
        }
        return row;
      }),
    },
  };
  return { service: new CheckInSettingsService(prisma), rows };
}

describe("CheckInSettingsService", () => {
  it("crea la fila del tenant la primera vez que se lee", async () => {
    const { service, rows } = makeService();
    await service.get("t1");
    expect(rows.has("t1")).toBe(true);
  });

  it("elegir convenio copia sus parámetros a los ajustes", async () => {
    const { service } = makeService();
    const result = await service.applyPreset("t1", "hosteleria");
    const preset = LABOR_AGREEMENT_PRESETS.find((p) => p.key === "hosteleria")!;
    expect(result.agreementKey).toBe("hosteleria");
    expect(result.annualHours).toBe(preset.params.annualHours);
    expect(result.vacationDays).toBe(preset.params.vacationDays);
  });

  it("editar los ajustes no altera la plantilla", async () => {
    const { service } = makeService();
    await service.applyPreset("t1", "hosteleria");
    const before = JSON.stringify(LABOR_AGREEMENT_PRESETS);
    const result = await service.update("t1", { maxDailyHours: 10 });
    expect(result.maxDailyHours).toBe(10);
    expect(JSON.stringify(LABOR_AGREEMENT_PRESETS)).toBe(before);
  });

  it("rechaza un convenio desconocido", async () => {
    const { service } = makeService();
    await expect(service.applyPreset("t1", "inventado")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("guarda el interruptor de pausas computables", async () => {
    const { service } = makeService();
    const result = await service.update("t1", { breaksCountAsWork: true });
    expect(result.breaksCountAsWork).toBe(true);
  });

  it("los ajustes de un tenant no afectan a otro", async () => {
    const { service } = makeService();
    await service.update("t1", { breaksCountAsWork: true });
    expect((await service.get("t2")).breaksCountAsWork).toBe(false);
  });
});
