import { Test, TestingModule } from "@nestjs/testing";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("OrdersController", () => {
  let controller: OrdersController;

  const mockOrdersService = {
    calculateOrderRequirements: jest.fn(),
    createAutomatedOrder: jest.fn(),
    getAutomatedOrder: jest.fn(),
    updateOrderItem: jest.fn(),
    approveOrder: jest.fn(),
    sendOrder: jest.fn(),
    getOrdersHistory: jest.fn(),
    getOrdersBySupplier: jest.fn(),
    getOrdersByZone: jest.fn(),
    generatePurchaseTemplate: jest.fn(),
    classifyBySupplier: jest.fn(),
    classifyByZone: jest.fn(),
    classifyByCategory: jest.fn(),
    getSupplierClassification: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateRequirements", () => {
    it("should calculate order requirements", async () => {
      const dto = {
        tenantId: "tenant-1",
        historicalPeriod: 7,
        lookaheadDays: 7,
      };

      mockOrdersService.calculateOrderRequirements.mockResolvedValue([
        { id: "req-1", productId: "product-1" },
      ]);

      const result = await controller.calculateRequirements(mockReq, dto);

      expect(result).toHaveLength(1);
      expect(mockOrdersService.calculateOrderRequirements).toHaveBeenCalledWith(
        { ...dto, tenantId: "tenant-1" },
      );
    });
  });

  describe("listRequirements", () => {
    it("should list requirements with default values", async () => {
      mockOrdersService.calculateOrderRequirements.mockResolvedValue([]);

      const result = await controller.listRequirements(mockReq);

      expect(mockOrdersService.calculateOrderRequirements).toHaveBeenCalledWith(
        {
          tenantId: "tenant-1",
          historicalPeriod: undefined,
          lookaheadDays: undefined,
        },
      );
    });

    it("should list requirements with query params", async () => {
      mockOrdersService.calculateOrderRequirements.mockResolvedValue([]);

      await controller.listRequirements(mockReq, 14, 10);

      expect(mockOrdersService.calculateOrderRequirements).toHaveBeenCalledWith(
        {
          tenantId: "tenant-1",
          historicalPeriod: 14,
          lookaheadDays: 10,
        },
      );
    });
  });

  describe("generateOrder", () => {
    it("should generate an automated order", async () => {
      const dto = {
        tenantId: "tenant-1",
        supplierId: "supplier-1",
        urgency: "HIGH" as const,
        items: [],
      } as any;

      mockOrdersService.createAutomatedOrder.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-123",
      });

      const result = await controller.generateOrder(mockReq, dto);

      expect(result.id).toBe("order-1");
      expect(mockOrdersService.createAutomatedOrder).toHaveBeenCalledWith({
        ...dto,
        tenantId: "tenant-1",
      });
    });
  });

  describe("getOrder", () => {
    it("should return an order by ID", async () => {
      mockOrdersService.getAutomatedOrder.mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-123",
        status: "DRAFT",
      });

      const result = await controller.getOrder(mockReq, "order-1");

      expect(result.id).toBe("order-1");
      expect(mockOrdersService.getAutomatedOrder).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
      );
    });
  });

  describe("updateOrderItem", () => {
    it("should update an order item", async () => {
      const dto = { adjustedQuantity: 20 };

      mockOrdersService.updateOrderItem.mockResolvedValue({
        id: "item-1",
        adjustedQuantity: 20,
      });

      const result = await controller.updateOrderItem(
        mockReq,
        "order-1",
        "item-1",
        dto,
      );

      expect(result.adjustedQuantity).toBe(20);
      expect(mockOrdersService.updateOrderItem).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        "item-1",
        dto,
      );
    });
  });

  describe("approveOrder", () => {
    it("should approve an order", async () => {
      const dto = { approvedBy: "user-1" };

      mockOrdersService.approveOrder.mockResolvedValue({
        id: "order-1",
        status: "APPROVED",
      });

      const result = await controller.approveOrder(mockReq, "order-1", dto);

      expect(result.status).toBe("APPROVED");
      expect(mockOrdersService.approveOrder).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        dto,
      );
    });
  });

  describe("sendOrder", () => {
    it("should send an order", async () => {
      const dto = { sentBy: "user-1" };

      mockOrdersService.sendOrder.mockResolvedValue({
        id: "order-1",
        status: "SENT",
      });

      const result = await controller.sendOrder(mockReq, "order-1", dto);

      expect(result.status).toBe("SENT");
      expect(mockOrdersService.sendOrder).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        dto,
      );
    });
  });

  describe("getHistory", () => {
    it("should return orders history", async () => {
      mockOrdersService.getOrdersHistory.mockResolvedValue([
        { id: "order-1" },
        { id: "order-2" },
      ]);

      const result = await controller.getHistory(mockReq);

      expect(result).toHaveLength(2);
      expect(mockOrdersService.getOrdersHistory).toHaveBeenCalledWith(
        "tenant-1",
      );
    });
  });

  describe("getBySupplier", () => {
    it("should return orders by supplier", async () => {
      mockOrdersService.getOrdersBySupplier.mockResolvedValue([
        { id: "order-1", supplierId: "supplier-1" },
      ]);

      const result = await controller.getBySupplier(mockReq, "supplier-1");

      expect(result).toHaveLength(1);
      expect(mockOrdersService.getOrdersBySupplier).toHaveBeenCalledWith(
        "tenant-1",
        "supplier-1",
      );
    });
  });

  describe("getByZone", () => {
    it("should return orders by zone", async () => {
      mockOrdersService.getOrdersByZone.mockResolvedValue([]);

      const result = await controller.getByZone(mockReq, "REFRIGERATED");

      expect(mockOrdersService.getOrdersByZone).toHaveBeenCalledWith(
        "tenant-1",
        "REFRIGERATED",
      );
    });
  });

  describe("getOrderStatus", () => {
    it("should return order status summary", async () => {
      mockOrdersService.getAutomatedOrder.mockResolvedValue({
        id: "order-1",
        status: "SENT",
        urgency: "HIGH",
        scheduledDelivery: new Date("2026-06-06"),
        sentAt: new Date("2026-06-04"),
        receivedAt: null,
      });

      const result = await controller.getOrderStatus(mockReq, "order-1");

      expect(result.orderId).toBe("order-1");
      expect(result.status).toBe("SENT");
      expect(result.urgency).toBe("HIGH");
      expect(mockOrdersService.getAutomatedOrder).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
      );
    });
  });

  describe("exportOrder", () => {
    it("should export order as PDF", async () => {
      mockOrdersService.generatePurchaseTemplate.mockResolvedValue({
        id: "template-1",
        format: "PDF",
      });

      const result = await controller.exportOrder(mockReq, "order-1", "PDF");

      expect(result.format).toBe("PDF");
      expect(mockOrdersService.generatePurchaseTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        { format: "PDF", recipientEmail: undefined },
      );
    });

    it("should export order as EXCEL", async () => {
      mockOrdersService.generatePurchaseTemplate.mockResolvedValue({
        id: "template-1",
        format: "EXCEL",
      });

      const result = await controller.exportOrder(mockReq, "order-1", "EXCEL");

      expect(result.format).toBe("EXCEL");
      expect(mockOrdersService.generatePurchaseTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        { format: "EXCEL", recipientEmail: undefined },
      );
    });

    it("should export order with recipient email", async () => {
      const dto = {
        format: "PDF" as const,
        recipientEmail: "test@test.com",
      } as any;

      mockOrdersService.generatePurchaseTemplate.mockResolvedValue({
        id: "template-1",
      });

      await controller.exportOrder(mockReq, "order-1", "PDF", dto);

      expect(mockOrdersService.generatePurchaseTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        { format: "PDF", recipientEmail: "test@test.com" },
      );
    });
  });

  describe("classifyBySupplier", () => {
    it("should classify requirements by supplier", async () => {
      const requirements = [{ id: "req-1", supplierId: "supplier-1" }];
      const classifiedMap = new Map([["supplier-1", requirements]]);

      mockOrdersService.calculateOrderRequirements.mockResolvedValue(
        requirements,
      );
      mockOrdersService.classifyBySupplier.mockResolvedValue(classifiedMap);

      const result = await controller.classifyBySupplier(mockReq);

      expect(result).toBe(classifiedMap);
      expect(mockOrdersService.classifyBySupplier).toHaveBeenCalledWith(
        requirements,
      );
    });

    it("should classify with historical period param", async () => {
      mockOrdersService.calculateOrderRequirements.mockResolvedValue([]);
      mockOrdersService.classifyBySupplier.mockResolvedValue(new Map());

      await controller.classifyBySupplier(mockReq, 14);

      expect(mockOrdersService.calculateOrderRequirements).toHaveBeenCalledWith(
        {
          tenantId: "tenant-1",
          historicalPeriod: 14,
          lookaheadDays: 7,
        },
      );
    });
  });

  describe("classifyByZone", () => {
    it("should classify requirements by zone", async () => {
      const requirements = [{ id: "req-1", conservationZone: "REFRIGERATED" }];
      const classifiedMap = new Map([["REFRIGERATED", requirements]]);

      mockOrdersService.calculateOrderRequirements.mockResolvedValue(
        requirements,
      );
      mockOrdersService.classifyByZone.mockResolvedValue(classifiedMap);

      const result = await controller.classifyByZone(mockReq);

      expect(result).toBe(classifiedMap);
      expect(mockOrdersService.classifyByZone).toHaveBeenCalledWith(
        requirements,
      );
    });
  });

  describe("classifyByCategory", () => {
    it("should classify requirements by category", async () => {
      const requirements = [{ id: "req-1", category: "PRODUCE" }];
      const classifiedMap = new Map([["PRODUCE", requirements]]);

      mockOrdersService.calculateOrderRequirements.mockResolvedValue(
        requirements,
      );
      mockOrdersService.classifyByCategory.mockResolvedValue(classifiedMap);

      const result = await controller.classifyByCategory(mockReq);

      expect(result).toBe(classifiedMap);
      expect(mockOrdersService.classifyByCategory).toHaveBeenCalledWith(
        requirements,
      );
    });
  });

  describe("getSupplierClassification", () => {
    it("should return supplier classification", async () => {
      mockOrdersService.getSupplierClassification.mockResolvedValue({
        supplierId: "supplier-1",
        supplierName: "Supplier 1",
        categories: ["PRODUCE"],
        conservationZones: ["REFRIGERATED"],
        averageDeliveryTime: 3,
        reliabilityScore: 95,
        priceTier: "MEDIUM",
        preferredStatus: "PREFERRED",
        contactInfo: { email: "test@test.com" },
        orderMethods: ["EMAIL"],
      });

      const result = await controller.getSupplierClassification(
        mockReq,
        "supplier-1",
      );

      expect(result.supplierId).toBe("supplier-1");
      expect(mockOrdersService.getSupplierClassification).toHaveBeenCalledWith(
        "tenant-1",
        "supplier-1",
      );
    });
  });

  describe("exportOrderEmail", () => {
    it("should export order via email", async () => {
      const dto = {
        format: "EMAIL" as const,
        recipientEmail: "test@test.com",
      } as any;

      mockOrdersService.generatePurchaseTemplate.mockResolvedValue({
        id: "template-1",
        orderNumber: "ORD-123",
      });

      const result = await controller.exportOrderEmail(mockReq, "order-1", dto);

      expect(result.template).toBeDefined();
      expect(result.message).toBe("Order template sent via email");
      expect(mockOrdersService.generatePurchaseTemplate).toHaveBeenCalledWith(
        "tenant-1",
        "order-1",
        dto,
      );
    });
  });
});
