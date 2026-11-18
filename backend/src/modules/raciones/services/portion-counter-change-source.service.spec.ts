import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PortionCounterService } from "./portion-counter.service";

/**
 * Cambiar a qué receta/artículo se une un contador: mismo contador (historial,
 * platos, mínimo, categoría), nuevo origen de etiquetas y su nombre.
 */
describe("PortionCounterService.update (cambiar receta o artículo)", () => {
  const makeService = (opts: { recipe?: unknown; product?: unknown } = {}) => {
    const prisma: any = {
      portionCounter: {
        findFirst: jest.fn().mockResolvedValue({ id: "c1", tenantId: "t1" }),
        update: jest.fn().mockResolvedValue({ id: "c1" }),
      },
      recipe: { findFirst: jest.fn().mockResolvedValue(opts.recipe ?? null) },
      product: { findFirst: jest.fn().mockResolvedValue(opts.product ?? null) },
    };
    const ledger: any = { refreshAlerts: jest.fn() };
    const service = new PortionCounterService(prisma, ledger, {} as any);
    return { service, prisma };
  };

  it("une el contador a la receta, quita el artículo y toma su nombre", async () => {
    const { service, prisma } = makeService({
      recipe: { name: "Bacalao Barquero" },
    });

    await service.update("t1", "c1", { recipeId: "r1" });

    expect(prisma.recipe.findFirst).toHaveBeenCalledWith({
      where: { id: "r1", tenantId: "t1" },
      select: { name: true },
    });
    expect(prisma.portionCounter.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Bacalao Barquero", recipeId: "r1", productId: null },
    });
  });

  it("une el contador a un artículo sin tocar la categoría", async () => {
    const { service, prisma } = makeService({
      product: { name: "Lomo alto", category: { name: "Carnes" } },
    });

    await service.update("t1", "c1", { productId: "p1" });

    expect(prisma.portionCounter.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Lomo alto", recipeId: null, productId: "p1" },
    });
  });

  it("rechaza receta y artículo a la vez", async () => {
    const { service, prisma } = makeService();

    await expect(
      service.update("t1", "c1", { recipeId: "r1", productId: "p1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.portionCounter.update).not.toHaveBeenCalled();
  });

  it("no cambia nada si la receta no es de este local", async () => {
    const { service, prisma } = makeService();

    await expect(
      service.update("t1", "c1", { recipeId: "otra" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.portionCounter.update).not.toHaveBeenCalled();
  });

  it("avisa si la receta ya tiene otro contador", async () => {
    const { service, prisma } = makeService({
      recipe: { name: "Bacalao Barquero" },
    });
    prisma.portionCounter.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x",
      }),
    );

    await expect(
      service.update("t1", "c1", { recipeId: "r1" }),
    ).rejects.toThrow(
      new ConflictException("«Bacalao Barquero» ya tiene contador."),
    );
  });

  it("sin receta ni artículo solo guarda lo demás", async () => {
    const { service, prisma } = makeService();

    await service.update("t1", "c1", { minPortions: 4 });

    expect(prisma.recipe.findFirst).not.toHaveBeenCalled();
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(prisma.portionCounter.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { minPortions: 4 },
    });
  });
});
