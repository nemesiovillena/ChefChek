import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PurchaseListService } from "./purchase-list.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("PurchaseListService", () => {
  let service: PurchaseListService;

  const prismaMock = {
    purchaseList: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    supplier: { findFirst: jest.fn() },
    stock: { findMany: jest.fn() },
  };
  const orderServiceMock = { create: jest.fn() };

  const tenantId = "t1";
  const list = {
    id: "l1",
    tenantId,
    name: "Semanal pescado",
    supplierId: "sup-1",
    locationId: "loc-1",
    items: [
      { productId: "p1", defaultQuantity: 2 },
      { productId: "p2", defaultQuantity: 6 },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PurchaseListService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PurchaseOrderService, useValue: orderServiceMock },
      ],
    }).compile();
    service = module.get(PurchaseListService);
  });

  describe("suggestQuantity (mín/máx de stock)", () => {
    const base = { minimum: 0, maximum: null, reorder: 0, hasRows: true };

    it("sin filas de stock → cantidad por defecto del checklist", () => {
      expect(PurchaseListService.suggestQuantity(undefined, 3)).toBe(3);
    });

    it("stock bajo mínimo → repone hasta el máximo", () => {
      // qty 2 < min 5 → sugerir max(20) - qty(2) = 18
      expect(
        PurchaseListService.suggestQuantity(
          { ...base, quantity: 2, minimum: 5, maximum: 20 },
          3,
        ),
      ).toBe(18);
    });

    it("reorderLevel tiene prioridad sobre minimumStock como umbral", () => {
      // qty 6 >= min 5 pero < reorder 8 → repone hasta max 20 → 14
      expect(
        PurchaseListService.suggestQuantity(
          { ...base, quantity: 6, minimum: 5, maximum: 20, reorder: 8 },
          3,
        ),
      ).toBe(14);
    });

    it("stock suficiente → cantidad por defecto", () => {
      expect(
        PurchaseListService.suggestQuantity(
          { ...base, quantity: 10, minimum: 5, maximum: 20 },
          3,
        ),
      ).toBe(3);
    });

    it("sin máximo definido → repone hasta el umbral", () => {
      // qty 1 < min 5, sin max → 5 - 1 = 4
      expect(
        PurchaseListService.suggestQuantity(
          { ...base, quantity: 1, minimum: 5 },
          3,
        ),
      ).toBe(4);
    });
  });

  describe("generateOrder", () => {
    it("404 si la lista no es del tenant", async () => {
      prismaMock.purchaseList.findFirst.mockResolvedValue(null);
      await expect(
        service.generateOrder(tenantId, "ajena", "u1", {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("selección explícita del checklist se usa tal cual", async () => {
      prismaMock.purchaseList.findFirst.mockResolvedValue(list);
      orderServiceMock.create.mockResolvedValue({ id: "o1" });

      await service.generateOrder(tenantId, list.id, "u1", {
        items: [{ productId: "p1", quantity: 7 }],
      });

      expect(prismaMock.stock.findMany).not.toHaveBeenCalled();
      expect(orderServiceMock.create).toHaveBeenCalledWith(
        tenantId,
        "u1",
        expect.objectContaining({
          supplierId: "sup-1",
          locationId: "loc-1",
          lines: [{ productId: "p1", quantity: 7 }],
        }),
        list.id,
      );
    });

    it("sin selección → toda la lista con cantidades sugeridas por stock", async () => {
      prismaMock.purchaseList.findFirst.mockResolvedValue(list);
      // p1 bajo mínimo (repone 18); p2 sin filas de stock (default 6)
      prismaMock.stock.findMany.mockResolvedValue([
        {
          productId: "p1",
          quantity: 2,
          minimumStock: 5,
          maximumStock: 20,
          reorderLevel: 0,
        },
      ]);
      orderServiceMock.create.mockResolvedValue({ id: "o1" });

      await service.generateOrder(tenantId, list.id, "u1", {});

      const dto = orderServiceMock.create.mock.calls[0][2];
      expect(dto.lines).toEqual([
        { productId: "p1", quantity: 18 },
        { productId: "p2", quantity: 6 },
      ]);
    });

    it("agrega stock de varios almacenes por producto", async () => {
      prismaMock.purchaseList.findFirst.mockResolvedValue({
        ...list,
        items: [{ productId: "p1", defaultQuantity: 2 }],
      });
      // Dos almacenes: qty 2+2=4 < min 3+3=6 → max 10+10=20 - 4 = 16
      prismaMock.stock.findMany.mockResolvedValue([
        {
          productId: "p1",
          quantity: 2,
          minimumStock: 3,
          maximumStock: 10,
          reorderLevel: 0,
        },
        {
          productId: "p1",
          quantity: 2,
          minimumStock: 3,
          maximumStock: 10,
          reorderLevel: 0,
        },
      ]);
      orderServiceMock.create.mockResolvedValue({ id: "o1" });

      await service.generateOrder(tenantId, list.id, "u1", {});

      const dto = orderServiceMock.create.mock.calls[0][2];
      expect(dto.lines).toEqual([{ productId: "p1", quantity: 16 }]);
    });
  });
});
