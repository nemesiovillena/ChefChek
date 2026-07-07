import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TrashService } from "./trash.service";
import { PrismaService } from "../../common/services/prisma.service";

/**
 * Tests del servicio de papelera. Cubren la regla de cero-pérdida:
 * tipo fuera de allowlist → 400; restore de inexistente → 404; colisión de
 * único al recuperar → 400; purge con dependencias vivas → 409 (nunca cascada).
 */
describe("TrashService", () => {
  let service: TrashService;

  // Mock del cliente Prisma. $transaction ejecuta el callback con un objeto tx
  // que aporta sus propios $queryRaw/$executeRaw (los del pre-check y el DELETE).
  const txQueryRaw = jest.fn();
  const txExecuteRaw = jest.fn();
  const tx = { $queryRaw: txQueryRaw, $executeRaw: txExecuteRaw };

  const prisma: any = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn((cb: (t: any) => any) => cb(tx)),
    product: { updateMany: jest.fn() },
    recipe: { updateMany: jest.fn() },
    user: { updateMany: jest.fn() },
    sprint: { updateMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrashService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TrashService);
  });

  describe("listTrashed", () => {
    it("rechaza un tipo no permitido (allowlist de seguridad)", async () => {
      await expect(service.listTrashed("accounts", "t1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("devuelve items mapeados con type y deletedAt ISO", async () => {
      const deletedAt = new Date("2026-01-01T00:00:00.000Z");
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { id: "p1", label: "Tomate", secondary: "brand X", deletedAt },
      ]);
      const res = await service.listTrashed("product", "t1");
      expect(res).toEqual([
        {
          id: "p1",
          type: "product",
          label: "Tomate",
          secondary: "brand X",
          deletedAt: deletedAt.toISOString(),
        },
      ]);
      // El SQL crudo se ejecuta una sola vez (lista la papelera).
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("restore", () => {
    it("404 si no hay fila borrada para ese id+tenant", async () => {
      (prisma.product.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      await expect(service.restore("product", "p1", "t1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("400 si recuperar viola una única (P2002)", async () => {
      const err = new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "5.22.0",
      });
      (prisma.product.updateMany as jest.Mock).mockRejectedValue(err);
      await expect(service.restore("product", "p1", "t1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("recupera correctamente (deletedAt → null)", async () => {
      (prisma.product.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      const res = await service.restore("product", "p1", "t1");
      expect(res).toEqual({ id: "p1", restored: true });
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: "p1", tenantId: "t1", deletedAt: { not: null } },
        data: { deletedAt: null },
      });
    });
  });

  describe("purge", () => {
    it("409 si hay dependencias vivas que cascadearían (cero-pérdida)", async () => {
      // product → recipe_ingredients: una referencia viva.
      txQueryRaw.mockResolvedValue([{ n: 2 }]);
      await expect(service.purge("product", "p1", "t1")).rejects.toThrow(
        ConflictException,
      );
      // No se llega a ejecutar el DELETE físico.
      expect(txExecuteRaw).not.toHaveBeenCalled();
    });

    it("204-equivalent: DELETE físico cuando no hay dependencias", async () => {
      txQueryRaw.mockResolvedValue([{ n: 0 }]);
      txExecuteRaw.mockResolvedValue(1);
      const res = await service.purge("product", "p1", "t1");
      expect(res).toEqual({ id: "p1", purged: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    });

    it("404 si la fila no existe (0 filas afectadas)", async () => {
      txQueryRaw.mockResolvedValue([{ n: 0 }]);
      txExecuteRaw.mockResolvedValue(0);
      await expect(service.purge("product", "p1", "t1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("entidades sin dependencias (task) van directas al DELETE", async () => {
      txExecuteRaw.mockResolvedValue(1);
      const res = await service.purge("task", "t1", "tenant");
      expect(res).toEqual({ id: "t1", purged: true });
      // task no tiene dependencias → no hay pre-check de COUNT.
      expect(txQueryRaw).not.toHaveBeenCalled();
    });
  });
});
