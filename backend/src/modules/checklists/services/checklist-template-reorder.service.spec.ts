import { BadRequestException } from "@nestjs/common";
import { ChecklistTemplateService } from "./checklist-template.service";

describe("ChecklistTemplateService.reorder", () => {
  let update: jest.Mock;
  let findMany: jest.Mock;
  let service: ChecklistTemplateService;

  beforeEach(() => {
    update = jest.fn((args) => args);
    findMany = jest
      .fn()
      .mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const prisma = {
      checklistTemplate: { findMany, update },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
    service = new ChecklistTemplateService(prisma as any);
  });

  it("guarda sortOrder = posición en la lista recibida", async () => {
    await service.reorder("t1", "sicted", ["c", "a", "b"]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          usedByModules: { has: "sicted" },
          archivedAt: null,
        },
      }),
    );
    expect(
      update.mock.calls.map(([arg]) => [arg.where.id, arg.data.sortOrder]),
    ).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it.each([
    ["falta una plantilla activa", ["a", "b"]],
    ["incluye una ajena o archivada", ["a", "b", "x"]],
    ["repite una plantilla", ["a", "a", "b"]],
  ])("rechaza la lista si %s", async (_caso, ids) => {
    await expect(service.reorder("t1", "sicted", ids)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
  });
});
