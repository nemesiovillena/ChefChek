import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DashboardLayoutService } from "./dashboard-layout.service";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";

describe("DashboardLayoutService", () => {
  let service: DashboardLayoutService;
  let prisma: any;
  let roleAccess: any;
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
    roleAccess = {
      getSectionMapForUserRole: jest.fn().mockResolvedValue({ recipes: false }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardLayoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoleAccessService, useValue: roleAccess },
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
          widgets: [
            { id: "sala-notificaciones", cols: 2, rows: 2 },
            { id: "card-retirada", cols: 1, rows: 1 },
            { id: "sicted", cols: 1, rows: 1 },
          ],
        }),
      });
      await expect(service.getForUser(tenantId, "sala")).resolves.toEqual({
        title: "Sala",
        widgets: [
          { id: "sala-notificaciones", cols: 2, rows: 2 },
          { id: "sicted", cols: 1, rows: 1 },
        ],
      });
    });

    it("formato antiguo (solo ids): cards de 1×1", async () => {
      prisma.configuration.findUnique.mockResolvedValue({
        value: JSON.stringify({ title: "Sala", widgets: ["sicted"] }),
      });
      await expect(service.getForUser(tenantId, "sala")).resolves.toEqual({
        title: "Sala",
        widgets: [{ id: "sicted", cols: 1, rows: 1 }],
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
        widgets: [
          { id: "sicted", cols: 3, rows: 1 },
          { id: "sala-notificaciones", cols: 2, rows: 2 },
          { id: "sicted", cols: 1, rows: 1 },
        ],
      });
      expect(layout).toEqual({
        title: "Sala",
        widgets: [
          { id: "sicted", cols: 3, rows: 1 },
          { id: "sala-notificaciones", cols: 2, rows: 2 },
        ],
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
          widgets: [{ id: "inventada", cols: 1, rows: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.configuration.upsert).not.toHaveBeenCalled();
    });

    it("rechaza tamaños fuera de 1-3 de ancho y 1-2 de alto", async () => {
      for (const bad of [
        { id: "sicted", cols: 4, rows: 1 },
        { id: "sicted", cols: 1, rows: 3 },
        { id: "sicted", cols: 0, rows: 1 },
        { id: "sicted", cols: 1.5, rows: 1 },
      ]) {
        await expect(
          service.update(tenantId, "sala", "admin", {
            title: "Sala",
            widgets: [bad],
          }),
        ).rejects.toThrow(BadRequestException);
      }
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
        layout: {
          title: "Sala",
          widgets: [{ id: "sicted", cols: 1, rows: 1 }],
        },
      },
    ]);
  });

  describe("getDeviceSections", () => {
    it("usa rol, puesto y permisos del dispositivo", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "sala", role: "USER" });
      await expect(
        service.getDeviceSections(tenantId, "sala"),
      ).resolves.toEqual({ recipes: false });
      expect(roleAccess.getSectionMapForUserRole).toHaveBeenCalledWith(
        tenantId,
        "USER",
        "sala",
      );
    });

    it("rol sin restricciones (null) → todo visible", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "x", role: "ADMIN" });
      roleAccess.getSectionMapForUserRole.mockResolvedValue(null);
      await expect(service.getDeviceSections(tenantId, "x")).resolves.toEqual(
        {},
      );
    });

    it("solo cuentas compartidas", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getDeviceSections(tenantId, "ana")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it("reset borra la fila del dispositivo", async () => {
    await service.reset(tenantId, "sala");
    expect(prisma.configuration.deleteMany).toHaveBeenCalledWith({
      where: { tenantId, key: "dashboardLayout.sala" },
    });
  });
});
