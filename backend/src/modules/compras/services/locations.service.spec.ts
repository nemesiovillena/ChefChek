import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { LocationsService } from "./locations.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("LocationsService", () => {
  let service: LocationsService;

  const prismaMock = {
    location: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const tenantId = "tenant-1";
  const defaultLocation = {
    id: "loc-default",
    tenantId,
    name: "Principal",
    isDefault: true,
    isActive: true,
  };
  const secondaryLocation = {
    id: "loc-2",
    tenantId,
    name: "Barra",
    isDefault: false,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(LocationsService);
  });

  describe("findAll", () => {
    it("lista los locales del tenant con el default primero", async () => {
      prismaMock.location.findMany.mockResolvedValue([
        defaultLocation,
        secondaryLocation,
      ]);
      const result = await service.findAll(tenantId);
      expect(prismaMock.location.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("create", () => {
    it("crea un local no-default sin tocar el default actual", async () => {
      prismaMock.location.create.mockResolvedValue(secondaryLocation);
      await service.create(tenantId, { name: "Barra" });
      expect(prismaMock.location.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.location.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          name: "Barra",
          address: undefined,
          isDefault: false,
          isActive: true,
        },
      });
    });

    it("al crear como default desmarca el default anterior", async () => {
      prismaMock.location.create.mockResolvedValue({
        ...secondaryLocation,
        isDefault: true,
      });
      await service.create(tenantId, { name: "Nuevo", isDefault: true });
      expect(prismaMock.location.updateMany).toHaveBeenCalledWith({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe("update", () => {
    it("lanza NotFound si el local no es del tenant", async () => {
      prismaMock.location.findFirst.mockResolvedValue(null);
      await expect(
        service.update(tenantId, "ajeno", { name: "X" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("no permite quitar isDefault directamente", async () => {
      prismaMock.location.findFirst.mockResolvedValue(defaultLocation);
      await expect(
        service.update(tenantId, defaultLocation.id, { isDefault: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it("no permite desactivar el local por defecto", async () => {
      prismaMock.location.findFirst.mockResolvedValue(defaultLocation);
      await expect(
        service.update(tenantId, defaultLocation.id, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it("promover otro local a default desmarca el anterior", async () => {
      prismaMock.location.findFirst.mockResolvedValue(secondaryLocation);
      prismaMock.location.update.mockResolvedValue({
        ...secondaryLocation,
        isDefault: true,
      });
      await service.update(tenantId, secondaryLocation.id, {
        isDefault: true,
      });
      expect(prismaMock.location.updateMany).toHaveBeenCalledWith({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
      expect(prismaMock.location.update).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("bloquea eliminar el local por defecto", async () => {
      prismaMock.location.findFirst.mockResolvedValue(defaultLocation);
      await expect(
        service.remove(tenantId, defaultLocation.id),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.location.delete).not.toHaveBeenCalled();
    });

    it("elimina (soft) un local secundario", async () => {
      prismaMock.location.findFirst.mockResolvedValue(secondaryLocation);
      prismaMock.location.delete.mockResolvedValue(secondaryLocation);
      await service.remove(tenantId, secondaryLocation.id);
      expect(prismaMock.location.delete).toHaveBeenCalledWith({
        where: { id: secondaryLocation.id },
      });
    });
  });
});
