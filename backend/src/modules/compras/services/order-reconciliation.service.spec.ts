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
    product: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as any)),
  };
  const statusServiceMock = { transition: jest.fn() };

  const tenantId = "t1";

  beforeEach(async () => {
    jest.clearAllMocks();
    // Por defecto sin unitsPerFormat registrado → fallback a 1 (sin
    // conversión), para no romper los tests que no cubren formato de compra.
    prismaMock.product.findMany.mockResolvedValue([]);
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
        data: {
          receivedQuantity: 10,
          receivedPrice: 12,
          receivedSourceQuantity: null,
          receivedSourceUnit: null,
        },
      });
      expect(prismaMock.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { receivedTotal: 120, staleAlertSentAt: null },
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
        data: {
          receivedQuantity: 10,
          receivedPrice: 13,
          receivedSourceQuantity: null,
          receivedSourceUnit: null,
        },
      });
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("convierte unidades reales del albarán a formato de compra (1 caja de 10 uds pedida, 10 uds facturadas)", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        { id: "p1", unitsPerFormat: 10 },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 10, // 10 uds facturadas por el proveedor
            unitPrice: 0.5, // precio por ud
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0003",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          { id: "l1", productId: "p1", quantity: 1, receivedQuantity: null }, // 1 caja pedida
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        { id: "l1", quantity: 1, receivedQuantity: 1, receivedPrice: 5 },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      expect(prismaMock.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: "l1" },
        data: {
          receivedQuantity: 1,
          receivedPrice: 5, // 10/10 uds = 1 caja; 0.5€ × 10 = 5€/caja
          receivedSourceQuantity: null,
          receivedSourceUnit: null,
        },
      });
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("pedido en ud + albarán en kg con peso medio aprendido → convierte y marca RECIBIDO", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          unitsPerFormat: 1,
          referenceUnit: "kilo",
          avgUnitWeight: 0.37,
        },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 7.4, // kg servidos
            unit: "kg",
            unitPrice: 5, // €/kg
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0004",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          {
            id: "l1",
            productId: "p1",
            quantity: 20,
            unit: "ud",
            expectedPrice: 1.85,
            receivedQuantity: null,
          },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        {
          id: "l1",
          quantity: 20,
          unit: "ud",
          receivedQuantity: 20,
          receivedPrice: 1.85,
          receivedSourceUnit: "kg",
        },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      const updateArgs = prismaMock.purchaseOrderLine.update.mock.calls[0][0];
      expect(updateArgs.data.receivedQuantity).toBeCloseTo(20); // 7,4 kg ÷ 0,37
      expect(updateArgs.data.receivedPrice).toBeCloseTo(1.85); // 5 €/kg × 0,37
      expect(updateArgs.data.receivedSourceQuantity).toBeCloseTo(7.4);
      expect(updateArgs.data.receivedSourceUnit).toBe("kg");
      expect(prismaMock.product.update).not.toHaveBeenCalled(); // ya había peso: no se toca
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("primera recepción cruzada sin peso → aprende del ratio de precios y cuadra en el mismo run", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          unitsPerFormat: 1,
          referenceUnit: "kilo",
          avgUnitWeight: null,
        },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 7.4,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0005",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          {
            id: "l1",
            productId: "p1",
            quantity: 20,
            unit: "ud",
            expectedPrice: 1.85,
            receivedQuantity: null,
          },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        {
          id: "l1",
          quantity: 20,
          unit: "ud",
          receivedQuantity: 20,
          receivedPrice: 1.85,
          receivedSourceUnit: "kg",
        },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      const productArgs = prismaMock.product.update.mock.calls[0][0];
      expect(productArgs.where.id).toBe("p1");
      expect(productArgs.data.avgUnitWeight).toBeCloseTo(0.37); // 1,85 €/ud ÷ 5 €/kg
      const updateArgs = prismaMock.purchaseOrderLine.update.mock.calls[0][0];
      expect(updateArgs.data.receivedQuantity).toBeCloseTo(20);
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("sin peso y sin precios fiables → comportamiento histórico (kg crudos como uds, sin aprender)", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          unitsPerFormat: 1,
          referenceUnit: "kilo",
          avgUnitWeight: null,
        },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 7.4,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0006",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          {
            id: "l1",
            productId: "p1",
            quantity: 20,
            unit: "ud",
            expectedPrice: null,
            receivedQuantity: null,
          },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        {
          id: "l1",
          quantity: 20,
          unit: "ud",
          receivedQuantity: 7.4,
          receivedPrice: 5,
          receivedSourceUnit: null,
        },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      expect(prismaMock.product.update).not.toHaveBeenCalled();
      const updateArgs = prismaMock.purchaseOrderLine.update.mock.calls[0][0];
      expect(updateArgs.data.receivedQuantity).toBeCloseTo(7.4); // sin puente: número crudo
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO_PARCIAL,
        undefined,
      );
    });

    it("pedido en kilos + albarán en uds (inverso) → convierte con el peso aprendido", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          unitsPerFormat: 1,
          referenceUnit: "kilo",
          avgUnitWeight: 0.37,
        },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 20, // uds servidas
            unit: "ud",
            unitPrice: 1.85,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0007",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          {
            id: "l1",
            productId: "p1",
            quantity: 7.4,
            unit: "kilo",
            expectedPrice: 5,
            receivedQuantity: null,
          },
        ],
      });
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        {
          id: "l1",
          quantity: 7.4,
          unit: "kilo",
          receivedQuantity: 7.4,
          receivedPrice: 5,
          receivedSourceUnit: "ud",
        },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

      const updateArgs = prismaMock.purchaseOrderLine.update.mock.calls[0][0];
      expect(updateArgs.data.receivedQuantity).toBeCloseTo(7.4); // 20 ud × 0,37
      expect(updateArgs.data.receivedPrice).toBeCloseTo(5); // 1,85 €/ud ÷ 0,37 kg/ud
      expect(updateArgs.data.receivedSourceQuantity).toBeCloseTo(20);
      expect(updateArgs.data.receivedSourceUnit).toBe("ud");
      expect(statusServiceMock.transition).toHaveBeenCalledWith(
        tenantId,
        "o1",
        PurchaseOrderStatus.RECIBIDO,
        undefined,
      );
    });

    it("cobertura con tolerancia del 10% en líneas convertidas cruzadas (18,5/20 ud → RECIBIDO)", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "p1",
          unitsPerFormat: 1,
          referenceUnit: "kilo",
          avgUnitWeight: 0.37,
        },
      ]);
      prismaMock.albaran.findFirst.mockResolvedValue({
        id: "a1",
        purchaseOrderId: "o1",
        lines: [
          {
            lineStatus: LineStatus.CONFIRMADO,
            matchedProductId: "p1",
            quantity: 6.85,
            unit: "kg",
            unitPrice: 5,
          },
        ],
      });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({
        id: "o1",
        orderNumber: "PED-0008",
        status: PurchaseOrderStatus.ENVIADO,
        lines: [
          {
            id: "l1",
            productId: "p1",
            quantity: 20,
            unit: "ud",
            expectedPrice: 1.85,
            receivedQuantity: null,
          },
        ],
      });
      // 6,85 kg ÷ 0,37 = 18,51 ud: 7,4% por debajo de 20 → dentro del ±10%
      prismaMock.purchaseOrderLine.findMany.mockResolvedValue([
        {
          id: "l1",
          quantity: 20,
          unit: "ud",
          receivedQuantity: 18.51,
          receivedPrice: 1.85,
          receivedSourceUnit: "kg",
        },
      ]);

      await service.reconcileFromAlbaran("a1", tenantId);

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
