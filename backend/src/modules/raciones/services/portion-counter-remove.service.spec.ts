import { NotFoundException } from "@nestjs/common";
import { PortionCounterService } from "./portion-counter.service";

/** Borrar un contador suelta sus etiquetas (no las borra) y luego lo elimina. */
describe("PortionCounterService.remove", () => {
  const makeService = (counter: unknown) => {
    const prisma: any = {
      portionCounter: {
        findFirst: jest.fn().mockResolvedValue(counter),
        delete: jest.fn().mockReturnValue("delete-op"),
      },
      foodLabel: { updateMany: jest.fn().mockReturnValue("detach-op") },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new PortionCounterService(prisma, {} as any, {} as any);
    return { service, prisma };
  };

  it("suelta las etiquetas del contador y lo borra en una transacción", async () => {
    const { service, prisma } = makeService({ id: "c1", tenantId: "t1" });

    await expect(service.remove("t1", "c1")).resolves.toEqual({
      removed: true,
    });

    expect(prisma.portionCounter.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", tenantId: "t1" },
    });
    expect(prisma.foodLabel.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", portionCounterId: "c1" },
      data: {
        portionCounterId: null,
        portionsRemaining: null,
        portionsExpiryAckAt: null,
      },
    });
    expect(prisma.portionCounter.delete).toHaveBeenCalledWith({
      where: { id: "c1" },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      "detach-op",
      "delete-op",
    ]);
  });

  it("no toca nada si el contador no es de este local", async () => {
    const { service, prisma } = makeService(null);

    await expect(service.remove("t1", "c1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
