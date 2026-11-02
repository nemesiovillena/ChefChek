import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DashboardLayoutService } from "./dashboard-layout.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("DashboardLayoutService", () => {
  let service: DashboardLayoutService;
  let prisma: any;
  const tenantId = "tenant-1";

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "sala" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      configuration: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardLayoutService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DashboardLayoutService);
  });

  describe("getForUser", () => {
    it("cuenta personal: null (dashboard completo)", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getForUser(tenantId, "ana")).resolves.toBeNull();
      expect(prisma.configuration.findUnique).not.toHaveBeenCalled();
    });

    it("dispositivo sin configurar: null", async () => {
      await expect(service.getForUser(tenantId, "sala")).resolves.toBeNull();
    });

    it("dispositivo configurado: descarta cards que ya no existen", async () => {
      prisma.configuration.findUnique.mockResolvedValue({
        value: JSON.stringify({
          title: "Sala",
          widgets: ["sala-notificaciones", "card-retirada", "sicted"],
        }),
      });
      await expect(service.getForUser(tenantId, "sala")).resolves.toEqual({
        title: "Sala",
        widgets: ["sala-notificaciones", "sicted"],
      });
    });

    it("valor corrupto: null en vez de romper el dashboard", async () => {
      prisma.configuration.findUnique.mockResolvedValue({ value: "{no-json" });
      await expect(service.getForUser(tenantId, "sala")).resolves.toBeNull();
    });
  });

  describe("update", () => {
    it("guarda título recortado y cards sin repetir, en orden", async () => {
      const layout = await service.update(tenantId, "sala", "admin", {
        title: "  Sala ",
        widgets: ["sicted", "sala-notificaciones", "sicted"],
      });
      expect(layout).toEqual({
        title: "Sala",
        widgets: ["sicted", "sala-notificaciones"],
      });
      const call = prisma.configuration.upsert.mock.calls[0][0];
      expect(call.where.tenantId_key).toEqual({
        tenantId,
        key: "dashboardLayout.sala",
      });
      expect(JSON.parse(call.create.value)).toEqual(layout);
    });

    it("rechaza cards desconocidas", async () => {
      await expect(
        service.update(tenantId, "sala", "admin", {
          title: "Sala",
          widgets: ["inventada"],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.configuration.upsert).not.toHaveBeenCalled();
    });

    it("rechaza título vacío", async () => {
      await expect(
        service.update(tenantId, "sala", "admin", { title: "  ", widgets: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("solo cuentas compartidas del tenant", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.update(tenantId, "ana", "admin", { title: "X", widgets: [] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ana", tenantId, isSharedAccount: true },
        }),
      );
    });
  });

  it("listSharedDevices: une cada dispositivo con su pantalla", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "cocina", name: "Cocina" },
      { id: "sala", name: "Sala" },
    ]);
    prisma.configuration.findMany.mockResolvedValue([
      {
        key: "dashboardLayout.sala",
        value: JSON.stringify({ title: "Sala", widgets: ["sicted"] }),
      },
    ]);
    await expect(service.listSharedDevices(tenantId)).resolves.toEqual([
      { userId: "cocina", name: "Cocina", layout: null },
      {
        userId: "sala",
        name: "Sala",
        layout: { title: "Sala", widgets: ["sicted"] },
      },
    ]);
  });

  it("reset borra la fila del dispositivo", async () => {
    await service.reset(tenantId, "sala");
    expect(prisma.configuration.deleteMany).toHaveBeenCalledWith({
      where: { tenantId, key: "dashboardLayout.sala" },
    });
  });
});
