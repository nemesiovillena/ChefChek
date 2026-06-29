import { Test, TestingModule } from "@nestjs/testing";
import { WebSocketService } from "./websocket.service";
import { WebSocketGateway } from "./websocket.gateway";

describe("WebSocketService", () => {
  let service: WebSocketService;
  let gateway: {
    broadcastToTenant: jest.Mock;
    broadcastToKitchen: jest.Mock;
    broadcastToDashboard: jest.Mock;
    sendToUser: jest.Mock;
  };

  beforeEach(async () => {
    gateway = {
      broadcastToTenant: jest.fn(),
      broadcastToKitchen: jest.fn(),
      broadcastToDashboard: jest.fn(),
      sendToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketService,
        { provide: WebSocketGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("Order Events", () => {
    const mockOrder = {
      id: "o1",
      orderNumber: "ORD-123",
      supplierName: "Proveedor",
      tenantId: "t1",
    } as any;

    it("should broadcast orderCreated to kitchen and tenant notification", () => {
      service.broadcastOrderCreated(mockOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "orderCreated",
        mockOrder,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "INFO",
          title: "Nueva orden creada",
          tenantId: "t1",
        }),
      );
    });

    it("should broadcast orderUpdated to kitchen and dashboard", () => {
      service.broadcastOrderUpdated(mockOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "orderUpdated",
        mockOrder,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "orderUpdated",
        mockOrder,
      );
    });

    it("should broadcast orderApproved to kitchen and tenant notification", () => {
      service.broadcastOrderApproved(mockOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "orderApproved",
        mockOrder,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "SUCCESS",
          title: "Orden aprobada",
        }),
      );
    });

    it("should broadcast orderRejected to kitchen and tenant notification", () => {
      service.broadcastOrderRejected(mockOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "orderRejected",
        mockOrder,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "WARNING",
          title: "Orden rechazada",
        }),
      );
    });
  });

  describe("Production Events", () => {
    const mockProdOrder = { id: "p1", tenantId: "t1" } as any;
    const mockTask = { id: "tk1", tenantId: "t1" } as any;
    const mockAlert = {
      id: "al1",
      severity: "CRITICAL",
      message: "Error",
      tenantId: "t1",
    } as any;

    it("should broadcast productionOrderCreated to kitchen and dashboard", () => {
      service.broadcastProductionOrderCreated(mockProdOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "productionOrderCreated",
        mockProdOrder,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "productionOrderCreated",
        mockProdOrder,
      );
    });

    it("should broadcast productionOrderUpdated to kitchen and dashboard", () => {
      service.broadcastProductionOrderUpdated(mockProdOrder);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "productionOrderUpdated",
        mockProdOrder,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "productionOrderUpdated",
        mockProdOrder,
      );
    });

    it("should broadcast productionTaskCompleted to kitchen and dashboard", () => {
      service.broadcastProductionTaskCompleted(mockTask);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "productionTaskCompleted",
        mockTask,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "productionTaskCompleted",
        mockTask,
      );
    });

    it("should broadcast productionAlert to kitchen, dashboard and notify on CRITICAL severity", () => {
      service.broadcastProductionAlert(mockAlert);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "productionAlert",
        mockAlert,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "productionAlert",
        mockAlert,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "ERROR",
          title: "Alerta de producción crítica",
        }),
      );
    });
  });

  describe("Stock Events", () => {
    const mockStockAlert = {
      id: "s1",
      productId: "p1",
      productName: "Harina",
      currentQuantity: 2,
      minimumStock: 10,
      tenantId: "t1",
    } as any;

    it("should broadcastStockLow to dashboard and tenant notification", () => {
      service.broadcastStockLow(mockStockAlert);
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "stockLow",
        mockStockAlert,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "WARNING",
          title: "Stock bajo",
        }),
      );
    });

    it("should broadcastStockCritical to kitchen, dashboard and tenant notification", () => {
      service.broadcastStockCritical(mockStockAlert);
      expect(gateway.broadcastToKitchen).toHaveBeenCalledWith(
        "t1",
        "stockCritical",
        mockStockAlert,
      );
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "stockCritical",
        mockStockAlert,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "ERROR",
          title: "Stock crítico",
        }),
      );
    });

    it("should broadcastStockUpdated to dashboard", () => {
      const mockStockUpdate = { productId: "p1", tenantId: "t1" } as any;
      service.broadcastStockUpdated(mockStockUpdate);
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "stockUpdated",
        mockStockUpdate,
      );
    });
  });

  describe("Other events", () => {
    it("should broadcastQRScan to dashboard", () => {
      const mockScan = { tenantId: "t1" } as any;
      service.broadcastQRScan(mockScan);
      expect(gateway.broadcastToDashboard).toHaveBeenCalledWith(
        "t1",
        "qrScan",
        mockScan,
      );
    });

    it("should broadcastMenuUpdated to tenant", () => {
      const mockMenu = { tenantId: "t1" } as any;
      service.broadcastMenuUpdated(mockMenu);
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "menuUpdated",
        mockMenu,
      );
    });

    it("should broadcastMenuPublished to tenant and send notification", () => {
      const mockMenu = { id: "m1", name: "Menu Dia", tenantId: "t1" } as any;
      service.broadcastMenuPublished(mockMenu);
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "menuPublished",
        mockMenu,
      );
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        expect.objectContaining({
          type: "SUCCESS",
          title: "Menú publicado",
        }),
      );
    });

    it("should broadcast general notification", () => {
      const mockNotif = { tenantId: "t1" } as any;
      service.broadcastNotification(mockNotif);
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "notification",
        mockNotif,
      );
    });

    it("should send notification to specific user", () => {
      const mockNotif = { tenantId: "t1" } as any;
      service.sendNotificationToUser("u1", mockNotif);
      expect(gateway.sendToUser).toHaveBeenCalledWith(
        "u1",
        "notification",
        mockNotif,
      );
    });

    it("should broadcastError to tenant", () => {
      const mockError = { message: "Error" };
      service.broadcastError("t1", mockError);
      expect(gateway.broadcastToTenant).toHaveBeenCalledWith(
        "t1",
        "error",
        mockError,
      );
    });
  });
});
