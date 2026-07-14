import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PurchaseOrderService } from "./purchase-order.service";
import { PurchaseOrderNumberService } from "./purchase-order-number.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PurchaseOrderService", () => {
  let service: PurchaseOrderService;

  const prismaMock = {
    purchaseOrder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplier: { findFirst: jest.fn() },
    product: { findMany: jest.fn() },
    location: { findFirst: jest.fn() },
  };
  const numberMock = { generateOrderNumber: jest.fn() };

  const tenantId = "t1";
  const supplier = { id: "sup-1", tenantId, name: "Pescados SA" };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PurchaseOrderNumberService, useValue: numberMock },
      ],
    }).compile();
    service = module.get(PurchaseOrderService);
  });

  describe("create", () => {
    it("404 si el proveedor no es del tenant", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      await expect(
        service.create(tenantId, "u1", {
          supplierId: "ajeno",
          lines: [{ productId: "p1", quantity: 2 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("400 si alguna línea referencia un artículo inexistente", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(supplier);
      prismaMock.product.findMany.mockResolvedValue([]);
      await expect(
        service.create(tenantId, "u1", {
          supplierId: supplier.id,
          lines: [{ productId: "no-existe", quantity: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("resuelve expectedPrice desde la oferta del proveedor y calcula el total", async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(supplier);
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          supplierId: "otro-proveedor",
          purchasePrice: 99, // no debe usarse: hay oferta del proveedor
          purchaseFormat: "Caja 5kg",
          referenceUnit: "kg",
          supplierOffers: [{ purchasePrice: 10 }],
        },
        {
          id: "p2",
          supplierId: supplier.id, // proveedor principal → fallback purchasePrice
          purchasePrice: 4,
          purchaseFormat: "",
          referenceUnit: "ud",
          supplierOffers: [],
        },
      ]);
      numberMock.generateOrderNumber.mockResolvedValue("PED-0001");
      prismaMock.purchaseOrder.create.mockResolvedValue({ id: "o1" });

      await service.create(tenantId, "u1", {
        supplierId: supplier.id,
        lines: [
          { productId: "p1", quantity: 3 },
          { productId: "p2", quantity: 5 },
        ],
      });

      const data = prismaMock.purchaseOrder.create.mock.calls[0][0].data;
      expect(data.orderNumber).toBe("PED-0001");
      // 3×10 (oferta) + 5×4 (fallback proveedor principal) = 50
      expect(data.expectedTotal).toBe(50);
      expect(data.lines.create[0].expectedPrice).toBe(10);
      expect(data.lines.create[1].expectedPrice).toBe(4);
      expect(data.events.create.type).toBe("CREATED");
    });
  });

  describe("update", () => {
    it("400 fuera de BORRADOR", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        status: PurchaseOrderStatus.ENVIADO,
        supplierId: supplier.id,
      });
      await expect(
        service.update(tenantId, "o1", { notes: "x" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("reemplaza líneas y recalcula el total en BORRADOR", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        status: PurchaseOrderStatus.BORRADOR,
        supplierId: supplier.id,
      });
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          supplierId: supplier.id,
          purchasePrice: 2,
          purchaseFormat: "",
          referenceUnit: "kg",
          supplierOffers: [],
        },
      ]);
      prismaMock.purchaseOrder.update.mockResolvedValue({ id: "o1" });

      await service.update(tenantId, "o1", {
        lines: [{ productId: "p1", quantity: 10 }],
      });

      const data = prismaMock.purchaseOrder.update.mock.calls[0][0].data;
      expect(data.expectedTotal).toBe(20);
      expect(data.lines.deleteMany).toEqual({});
    });
  });

  describe("remove", () => {
    it.each([
      PurchaseOrderStatus.ENVIADO,
      PurchaseOrderStatus.RECIBIDO_PARCIAL,
      PurchaseOrderStatus.RECIBIDO,
    ])("400 al borrar pedidos en %s (histórico auditable)", async (status) => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        status,
      });
      await expect(service.remove(tenantId, "o1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.purchaseOrder.delete).not.toHaveBeenCalled();
    });

    it("elimina (soft) un BORRADOR", async () => {
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        status: PurchaseOrderStatus.BORRADOR,
      });
      prismaMock.purchaseOrder.delete.mockResolvedValue({});
      await service.remove(tenantId, "o1");
      expect(prismaMock.purchaseOrder.delete).toHaveBeenCalledWith({
        where: { id: "o1" },
      });
    });
  });

  describe("findAll", () => {
    it("pagina y devuelve meta", async () => {
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      prismaMock.purchaseOrder.count.mockResolvedValue(60);
      const result = await service.findAll(tenantId, { page: 2, limit: 25 });
      expect(result.meta).toEqual({
        total: 60,
        page: 2,
        limit: 25,
        totalPages: 3,
      });
      const args = prismaMock.purchaseOrder.findMany.mock.calls[0][0];
      expect(args.skip).toBe(25);
      expect(args.take).toBe(25);
      expect(args.where.tenantId).toBe(tenantId);
    });
  });
});
