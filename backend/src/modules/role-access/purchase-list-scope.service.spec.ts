import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseListScopeService } from "./purchase-list-scope.service";
import { RoleAccessService } from "./role-access.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("PurchaseListScopeService", () => {
  let service: PurchaseListScopeService;
  let prisma: any;
  let roleAccess: any;

  const tenantId = "tenant-1";
  const pedro = { id: "pedro", role: "USER" };

  /** Pedro: sin Compras completo, solo con el permiso por persona. */
  function pedidosOnly() {
    roleAccess.getSectionMapForUserRole.mockResolvedValue({
      compras: false,
      "compras-pedidos": true,
    });
  }

  function assigned(listIds: string[]) {
    prisma.configuration.findUnique.mockResolvedValue({
      value: JSON.stringify(listIds),
    });
  }

  beforeEach(async () => {
    prisma = {
      configuration: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "pedro" }) },
      purchaseList: { findMany: jest.fn().mockResolvedValue([]) },
      purchaseOrder: { findFirst: jest.fn() },
      purchaseSchedule: { findFirst: jest.fn() },
    };
    roleAccess = { getSectionMapForUserRole: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseListScopeService,
        { provide: PrismaService, useValue: prisma },
        { provide: RoleAccessService, useValue: roleAccess },
      ],
    }).compile();

    service = moduleRef.get(PurchaseListScopeService);
  });

  describe("resolve", () => {
    it("gerencia no tiene límite", async () => {
      expect(
        await service.resolve(tenantId, { id: "a", role: "ADMIN" }),
      ).toBeNull();
      expect(roleAccess.getSectionMapForUserRole).not.toHaveBeenCalled();
    });

    it("quien ve Compras entero no tiene límite", async () => {
      roleAccess.getSectionMapForUserRole.mockResolvedValue({ compras: true });
      expect(await service.resolve(tenantId, pedro)).toBeNull();
    });

    it("sin listas asignadas no ve nada", async () => {
      pedidosOnly();
      expect(await service.resolve(tenantId, pedro)).toEqual({
        listIds: [],
        supplierIds: [],
      });
      expect(prisma.purchaseList.findMany).not.toHaveBeenCalled();
    });

    it("sus proveedores salen de sus listas (sin repetir) e ignora listas borradas", async () => {
      pedidosOnly();
      assigned(["l1", "l2", "borrada"]);
      prisma.purchaseList.findMany.mockResolvedValue([
        { id: "l1", supplierId: "s1" },
        { id: "l2", supplierId: "s1" },
      ]);
      expect(await service.resolve(tenantId, pedro)).toEqual({
        listIds: ["l1", "l2"],
        supplierIds: ["s1"],
      });
    });

    it("un valor guardado corrupto cuenta como sin listas", async () => {
      pedidosOnly();
      prisma.configuration.findUnique.mockResolvedValue({ value: "{roto" });
      expect(await service.resolve(tenantId, pedro)).toEqual({
        listIds: [],
        supplierIds: [],
      });
    });
  });

  describe("setAssignedListIds", () => {
    it("guarda las listas sin repetir", async () => {
      prisma.purchaseList.findMany.mockResolvedValue([
        { id: "l1" },
        { id: "l2" },
      ]);
      const result = await service.setAssignedListIds(
        tenantId,
        "pedro",
        "admin",
        ["l1", "l2", "l1"],
      );
      expect(result).toEqual(["l1", "l2"]);
      expect(prisma.configuration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_key: { tenantId, key: "userPurchaseLists.pedro" },
          },
          update: { value: '["l1","l2"]', updatedBy: "admin" },
        }),
      );
    });

    it("rechaza listas de otro restaurante o inexistentes", async () => {
      prisma.purchaseList.findMany.mockResolvedValue([{ id: "l1" }]);
      await expect(
        service.setAssignedListIds(tenantId, "pedro", "admin", ["l1", "ajena"]),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.configuration.upsert).not.toHaveBeenCalled();
    });

    it("rechaza personas de otro restaurante", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.setAssignedListIds(tenantId, "otro", "admin", []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("comprobaciones", () => {
    const scope = { listIds: ["l1"], supplierIds: ["s1"] };

    it("sin límite deja pasar todo", async () => {
      expect(() => service.assertList(null, "lx")).not.toThrow();
      await expect(
        service.assertOrder(tenantId, null, "o1"),
      ).resolves.toBeUndefined();
      expect(prisma.purchaseOrder.findFirst).not.toHaveBeenCalled();
    });

    it("lista ajena = no encontrada", () => {
      expect(() => service.assertList(scope, "l1")).not.toThrow();
      expect(() => service.assertList(scope, "l2")).toThrow(NotFoundException);
    });

    it("pedido de otro proveedor = no encontrado", async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ supplierId: "s2" });
      await expect(service.assertOrder(tenantId, scope, "o2")).rejects.toThrow(
        NotFoundException,
      );
      prisma.purchaseOrder.findFirst.mockResolvedValue({ supplierId: "s1" });
      await expect(
        service.assertOrder(tenantId, scope, "o1"),
      ).resolves.toBeUndefined();
    });

    it("programación de otra lista = no encontrada", async () => {
      prisma.purchaseSchedule.findFirst.mockResolvedValue({ listId: "l2" });
      await expect(
        service.assertSchedule(tenantId, scope, "p2"),
      ).rejects.toThrow(NotFoundException);
    });

    it("acciones de gerencia prohibidas con límite", () => {
      expect(() => service.assertUnrestricted(scope, "no")).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertUnrestricted(null, "no")).not.toThrow();
    });
  });
});
