import { Test } from "@nestjs/testing";
import { LineStatus, PurchaseOrderStatus } from "@prisma/client";
import { OrderReconciliationService } from "./order-reconciliation.service";
import { PurchaseOrderStatusService } from "./purchase-order-status.service";
import { PrismaService } from "../../../common/services/prisma.service";

describe("OrderReconciliationService", () => {
  let service: OrderReconciliationService;

  const prismaMock = {
    albaran: { findFirst: jest.fn() },
    purchaseOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrderLine: { update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };
  const statusServiceMock = { transition: jest.fn() };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrderReconciliationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PurchaseOrderStatusService, useValue: statusServiceMock },
      ],
    }).compile();
    service = module.get(OrderReconciliationService);
  });

  describe("suggestOrders", () => {
    it("filtra por proveedor, estado ENVIADO/RECIBIDO_PARCIAL y ventana ±7 días", async () => {
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
      await service.suggestOrders(tenantId, "sup-1", new Date("2026-07-15"));

      const args = prismaMock.purchaseOrder.findMany.mock.calls[0][0];
      expect(args.where.supplierId).toBe("sup-1");
      expect(args.where.status.in).toEqual([
        PurchaseOrderStatus.ENVIADO,
        PurchaseOrderStatus.RECIBIDO_PARCIAL,
      ]);
      expect(args.where.sentAt.gte).toEqual(new Date("2026-07-08"));
      expect(args.where.sentAt.lte).toEqual(new Date("2026-07-22"));
    });
  });

  describe("reconcileFromAlbaran", () => {
    it("no-op si el albarán no tiene purchaseOrderId (flujo sin pedido intacto)", async () => {
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: null,
        lines: [],
      });
      await service.reconcileFromAlbaran("a1", tenantId);
      expect(prismaMock.purchaseOrder.findFirst).not.toHaveBeenCalled();
    });

    it("no-op si ninguna línea confirmada coincide con productos del pedido", async () => {
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p-otro",
            quantity: 5,
            unitPrice: 10,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0001",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          { id: "l1", productId: "p1", quantity: 5, receivedQuantity: null },
        ],
      });
      await service.reconcileFromAlbaran("a1", tenantId);
      expect(prismaMock.purchaseOrderLine.update).not.toHaveBeenCalled();
      expect(statusServiceMock.transition).not.toHaveBeenCalled();
    });

    it("recepción completa en un solo albarán → RECIBIDO", async () => {
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 10,
            unitPrice: 12,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0001",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          { id: "l1", productId: "p1", quantity: 10, receivedQuantity: null },
        ],
      });
      prismaMock.purchaseOrderLine.update.mockResolvedValue({});
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        { id: "l1", quantity: 10, receivedQuantity: 10, receivedPrice: 12 },
      ]);
      prismaMock.purchaseOrder.update.mockResolvedValue({});
      statusServiceMock.transition.mockResolvedValue({});

      await service.reconcileFromAlbaran("a1", tenantId);

      expect(prismaMock.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { receivedQuantity: 10, receivedPrice: 12 },
      });
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { receivedTotal: 120 },
      });
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("recepción parcial → RECIBIDO_PARCIAL; segundo albarán acumula hasta RECIBIDO", async () => {
      // Primer albarán: 4 de 10
      prismaMock.albaran.findFirst.mockResolvedValueOnce({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 4,
            unitPrice: 12,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({
        id: "o1",
        orderNumber: "PED-0001",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          { id: "l1", productId: "p1", quantity: 10, receivedQuantity: null },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValueOnce([
        { id: "l1", quantity: 10, receivedQuantity: 4, receivedPrice: 12 },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO_PARCIAL,
        undefined,
      );

      // Segundo albarán: completa con 6 más (acumulando sobre receivedQuantity=4)
      jest.clearAllMocks();
      prismaMock.albaran.findFirst.mockResolvedValueOnce({
        id: "a2",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 6,
            unitPrice: 13,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValueOnce({
        id: "o1",
        orderNumber: "PED-0001",
        status: PurchaseOrderStatus.RECIBIDO_PARCIAL,
        lines: [
          { id: "l1", productId: "p1", quantity: 10, receivedQuantity: 4 },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValueOnce([
        { id: "l1", quantity: 10, receivedQuantity: 10, receivedPrice: 13 },
      ]);

      await service.reconcileFromAlbaran("a2", tenantId);

      expect(prismaMock.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: { receivedQuantity: 10, receivedPrice: 13 },
      });
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("no transiciona si el estado calculado no cambia (recepción ya registrada)", async () => {
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 3,
            unitPrice: 12,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0001",
        status: PurchaseOrderStatus.RECIBIDO_PARCIAL,
        lines: [
          { id: "l1", productId: "p1", quantity: 10, receivedQuantity: 4 },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        { id: "l1", quantity: 10, receivedQuantity: 7, receivedPrice: 12 },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      expect(statusServiceMock.transition).not.toHaveBeenCalled();
    });
  });
});
