import { ChecklistTemplateService } from "./checklist-template.service";
import { CreateChecklistTemplateDto } from "../dto/checklist-template.dto";

function template(name: string): CreateChecklistTemplateDto {
  return {
    name,
    kind: "CLEANING",
    mode: "EXECUTION",
    area: "Sala",
    frequency: "WEEKLY",
    items: [
      { label: "Cafetera" },
      { label: "Armario", itemFrequency: "MONTHLY" },
    ],
  };
}

describe("ChecklistTemplateService.importMany", () => {
  let create: jest.Mock;
  let service: ChecklistTemplateService;

  beforeEach(() => {
    create = jest.fn(async ({ data }) => ({
      id: `id-${data.name}`,
      name: data.name,
    }));
    const prisma = {
      checklistTemplate: {
        findMany: jest.fn().mockResolvedValue([{ name: "Limpieza de Barra" }]),
      },
      $transaction: jest.fn((fn: any) => fn({ checklistTemplate: { create } })),
    };
    service = new ChecklistTemplateService(prisma as any);
  });

  it("omite nombres ya existentes sin distinguir mayúsculas ni tildes", async () => {
    const result = await service.importMany("t1", "sicted", "u1", [
      template("limpieza  de barra"),
      template("Limpieza de almacén"),
    ]);

    expect(result.skipped).toEqual(["limpieza  de barra"]);
    expect(result.created).toEqual([
      { id: "id-Limpieza de almacén", name: "Limpieza de almacén" },
    ]);
  });

  it("no duplica plantillas repetidas dentro del mismo archivo", async () => {
    const result = await service.importMany("t1", "sicted", "u1", [
      template("Aseos"),
      template("ASEOS"),
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.skipped).toEqual(["ASEOS"]);
  });

  it("crea en el tenant y módulo de destino con autor y posiciones propias", async () => {
    await service.importMany("t2", "sicted", "u9", [template("Comedor")]);

    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: "t2",
      usedByModules: ["sicted"],
      createdBy: "u9",
      requiresSupervisor: false,
    });
    expect(data.items.create).toEqual([
      expect.objectContaining({
        tenantId: "t2",
        position: 0,
        label: "Cafetera",
        isRequired: true,
      }),
      expect.objectContaining({
        tenantId: "t2",
        position: 1,
        itemFrequency: "MONTHLY",
      }),
    ]);
  });
});
