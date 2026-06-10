import { Test, TestingModule } from "@nestjs/testing";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../../common/services/prisma.service";
import {
  OrderStatus,
  Urgency,
  PriceTier,
  PreferredStatus,
  TemplateFormat,
  OrderRequirementDto,
} from "./dto/orders.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("OrdersService", () => {
  let service: OrdersService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      product: {
        findMany: jest.fn(),
      },
      stock: {
        findUnique: jest.fn(),
      },
      recipe: {
        findMany: jest.fn(),
      },
      supplier: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      automatedOrder: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      orderItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateOrderRequirements", () => {
    it("should calculate order requirements for products", async () => {
      const tenantId = "tenant-123";
      const dto = {
        tenantId,
        historicalPeriod: 7,
        lookaheadDays: 7,
      };

      const mockProducts = [
        {
          id: "product-1",
          name: "Tomatoes",
          minimumStock: 50,
          primarySupplierId: "supplier-1",
          conservationZone: "REFRIGERATED",
          category: "PERISHABLE",
          unit: "kg",
          costPerUnit: 2.5,
          packageSize: 10,
        },
        {
          id: "product-2",
          name: "Flour",
          minimumStock: 100,
          primarySupplierId: "supplier-2",
          conservationZone: "DRY_GOODS",
          category: "DRY_GOODS",
          unit: "kg",
          costPerUnit: 1.2,
          packageSize: 25,
        },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(
        mockProducts.map((p) => ({ ...p, stocks: [{ quantity: 20 }] })),
      );
      mockPrismaService.recipe.findMany.mockResolvedValue([
        {
          ingredients: [{ productId: "product-1", quantity: 10 }],
        },
      ]);
      mockPrismaService.supplier.findUnique.mockResolvedValue({
        id: "supplier-1",
        name: "Fresh Foods Co",
      });

      const result = await service.calculateOrderRequirements(dto);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          stocks: {
            where: {
              quantity: { gt: 0 },
            },
            take: 1,
          },
        },
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array when no products found", async () => {
      const dto = {
        tenantId: "tenant-123",
        historicalPeriod: 7,
        lookaheadDays: 7,
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.calculateOrderRequirements(dto);

      expect(result).toEqual([]);
    });
  });

  describe("classifyBySupplier", () => {
    it("should classify requirements by supplier", async () => {
      const requirements: OrderRequirementDto[] = [
        {
          id: "req-1",
          productId: "product-1",
          productName: "Tomatoes",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.HIGH,
          suggestedQuantity: 100,
          currentStock: 10,
          minimumStock: 20,
          projectedConsumption: 30,
          requiredQuantity: 40,
          conservationZone: "REFRIGERATED",
          category: "VEGETABLES",
          unit: "kg",
          estimatedCost: 100,
          lastOrderDate: new Date(),
          averageDailyConsumption: 5,
        },
        {
          id: "req-2",
          productId: "product-2",
          productName: "Onions",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.LOW,
          suggestedQuantity: 50,
          currentStock: 15,
          minimumStock: 25,
          projectedConsumption: 20,
          requiredQuantity: 30,
          conservationZone: "REFRIGERATED",
          category: "VEGETABLES",
          unit: "kg",
          estimatedCost: 60,
          lastOrderDate: new Date(),
          averageDailyConsumption: 4,
        },
        {
          id: "req-3",
          productId: "product-3",
          productName: "Flour",
          supplierId: "supplier-2",
          supplierName: "Supplier B",
          urgency: Urgency.MEDIUM,
          suggestedQuantity: 25,
          currentStock: 20,
          minimumStock: 30,
          projectedConsumption: 25,
          requiredQuantity: 35,
          conservationZone: "DRY_GOODS",
          category: "GRAINS",
          unit: "kg",
          estimatedCost: 40,
          lastOrderDate: new Date(),
          averageDailyConsumption: 3,
        },
      ];

      const result = await service.classifyBySupplier(requirements);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has("supplier-1")).toBe(true);
      expect(result.has("supplier-2")).toBe(true);
    });

    it("should sort items by urgency within each supplier", async () => {
      const requirements: OrderRequirementDto[] = [
        {
          id: "req-1",
          productId: "product-1",
          productName: "Product 1",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.LOW,
          suggestedQuantity: 10,
          currentStock: 5,
          minimumStock: 10,
          projectedConsumption: 15,
          requiredQuantity: 20,
          conservationZone: "DRY_GOODS",
          category: "CATEGORY_A",
          unit: "kg",
          estimatedCost: 30,
          lastOrderDate: new Date(),
          averageDailyConsumption: 2,
        },
        {
          id: "req-2",
          productId: "product-2",
          productName: "Product 2",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.CRITICAL,
          suggestedQuantity: 20,
          currentStock: 2,
          minimumStock: 15,
          projectedConsumption: 25,
          requiredQuantity: 30,
          conservationZone: "FROZEN",
          category: "CATEGORY_B",
          unit: "kg",
          estimatedCost: 50,
          lastOrderDate: new Date(),
          averageDailyConsumption: 4,
        },
        {
          id: "req-3",
          productId: "product-3",
          productName: "Product 3",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.MEDIUM,
          suggestedQuantity: 15,
          currentStock: 8,
          minimumStock: 12,
          projectedConsumption: 18,
          requiredQuantity: 22,
          conservationZone: "REFRIGERATED",
          category: "CATEGORY_C",
          unit: "kg",
          estimatedCost: 40,
          lastOrderDate: new Date(),
          averageDailyConsumption: 3,
        },
      ];

      const result = await service.classifyBySupplier(requirements);
      const supplier1Items = result.get("supplier-1");

      expect(supplier1Items[0].urgency).toBe(Urgency.CRITICAL);
      expect(supplier1Items[1].urgency).toBe(Urgency.MEDIUM);
      expect(supplier1Items[2].urgency).toBe(Urgency.LOW);
    });
  });

  describe("classifyByZone", () => {
    it("should classify requirements by conservation zone", async () => {
      const requirements: OrderRequirementDto[] = [
        {
          id: "req-1",
          productId: "product-1",
          productName: "Product 1",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.HIGH,
          suggestedQuantity: 10,
          currentStock: 5,
          minimumStock: 10,
          projectedConsumption: 15,
          requiredQuantity: 20,
          conservationZone: "FROZEN",
          category: "CATEGORY_A",
          unit: "kg",
          estimatedCost: 30,
          lastOrderDate: new Date(),
          averageDailyConsumption: 2,
        },
        {
          id: "req-2",
          productId: "product-2",
          productName: "Product 2",
          supplierId: "supplier-2",
          supplierName: "Supplier B",
          urgency: Urgency.MEDIUM,
          suggestedQuantity: 15,
          currentStock: 8,
          minimumStock: 12,
          projectedConsumption: 18,
          requiredQuantity: 22,
          conservationZone: "REFRIGERATED",
          category: "CATEGORY_B",
          unit: "kg",
          estimatedCost: 40,
          lastOrderDate: new Date(),
          averageDailyConsumption: 3,
        },
        {
          id: "req-3",
          productId: "product-3",
          productName: "Product 3",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.LOW,
          suggestedQuantity: 20,
          currentStock: 10,
          minimumStock: 15,
          projectedConsumption: 20,
          requiredQuantity: 25,
          conservationZone: "FROZEN",
          category: "CATEGORY_C",
          unit: "kg",
          estimatedCost: 50,
          lastOrderDate: new Date(),
          averageDailyConsumption: 4,
        },
      ];

      const result = await service.classifyByZone(requirements);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.has("FROZEN")).toBe(true);
      expect(result.has("REFRIGERATED")).toBe(true);
    });

    it("should sort zones by priority", async () => {
      const requirements: OrderRequirementDto[] = [
        {
          id: "req-1",
          productId: "product-1",
          productName: "Product 1",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.LOW,
          suggestedQuantity: 10,
          currentStock: 5,
          minimumStock: 10,
          projectedConsumption: 15,
          requiredQuantity: 20,
          conservationZone: "DRY_GOODS",
          category: "CATEGORY_A",
          unit: "kg",
          estimatedCost: 30,
          lastOrderDate: new Date(),
          averageDailyConsumption: 2,
        },
        {
          id: "req-2",
          productId: "product-2",
          productName: "Product 2",
          supplierId: "supplier-2",
          supplierName: "Supplier B",
          urgency: Urgency.HIGH,
          suggestedQuantity: 15,
          currentStock: 3,
          minimumStock: 12,
          projectedConsumption: 18,
          requiredQuantity: 22,
          conservationZone: "FROZEN",
          category: "CATEGORY_B",
          unit: "kg",
          estimatedCost: 40,
          lastOrderDate: new Date(),
          averageDailyConsumption: 3,
        },
        {
          id: "req-3",
          productId: "product-3",
          productName: "Product 3",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.MEDIUM,
          suggestedQuantity: 20,
          currentStock: 8,
          minimumStock: 15,
          projectedConsumption: 20,
          requiredQuantity: 25,
          conservationZone: "REFRIGERATED",
          category: "CATEGORY_C",
          unit: "kg",
          estimatedCost: 50,
          lastOrderDate: new Date(),
          averageDailyConsumption: 4,
        },
      ];

      const result = await service.classifyByZone(requirements);
      const zones = Array.from(result.keys());

      expect(zones[0]).toBe("FROZEN");
      expect(zones[1]).toBe("REFRIGERATED");
      expect(zones[2]).toBe("DRY_GOODS");
    });
  });

  describe("classifyByCategory", () => {
    it("should classify requirements by category", async () => {
      const requirements: OrderRequirementDto[] = [
        {
          id: "req-1",
          productId: "product-1",
          productName: "Product 1",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.HIGH,
          suggestedQuantity: 10,
          currentStock: 5,
          minimumStock: 10,
          projectedConsumption: 15,
          requiredQuantity: 20,
          conservationZone: "FROZEN",
          category: "PERISHABLE",
          unit: "kg",
          estimatedCost: 30,
          lastOrderDate: new Date(),
          averageDailyConsumption: 2,
        },
        {
          id: "req-2",
          productId: "product-2",
          productName: "Product 2",
          supplierId: "supplier-2",
          supplierName: "Supplier B",
          urgency: Urgency.MEDIUM,
          suggestedQuantity: 15,
          currentStock: 8,
          minimumStock: 12,
          projectedConsumption: 18,
          requiredQuantity: 22,
          conservationZone: "REFRIGERATED",
          category: "DRY_GOODS",
          unit: "kg",
          estimatedCost: 40,
          lastOrderDate: new Date(),
          averageDailyConsumption: 3,
        },
        {
          id: "req-3",
          productId: "product-3",
          productName: "Product 3",
          supplierId: "supplier-1",
          supplierName: "Supplier A",
          urgency: Urgency.LOW,
          suggestedQuantity: 20,
          currentStock: 10,
          minimumStock: 15,
          projectedConsumption: 20,
          requiredQuantity: 25,
          conservationZone: "DRY_GOODS",
          category: "PERISHABLE",
          unit: "kg",
          estimatedCost: 50,
          lastOrderDate: new Date(),
          averageDailyConsumption: 4,
        },
      ];

      const result = await service.classifyByCategory(requirements);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get("PERISHABLE").length).toBe(2);
      expect(result.get("DRY_GOODS").length).toBe(1);
    });
  });

  describe("getSupplierClassification", () => {
    it("should return supplier classification", async () => {
      const tenantId = "tenant-123";
      const supplierId = "supplier-1";

      const mockSupplier = {
        id: supplierId,
        name: "Fresh Foods Co",
        products: [
          { category: "PERISHABLE", conservationZone: "REFRIGERATED" },
          { category: "DAIRY", conservationZone: "REFRIGERATED" },
        ],
        averageDeliveryTime: 2,
        reliabilityScore: 95,
        priceTier: PriceTier.MEDIUM,
        preferredStatus: PreferredStatus.PREFERRED,
        email: "contact@freshfoods.com",
        phone: "+1234567890",
        website: "https://freshfoods.com",
        orderMethods: ["EMAIL", "PHONE"],
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue(mockSupplier);

      const result = await service.getSupplierClassification(
        tenantId,
        supplierId,
      );

      expect(result.supplierId).toBe(supplierId);
      expect(result.supplierName).toBe("Fresh Foods Co");
      expect(result.categories).toContain("PERISHABLE");
      expect(result.categories).toContain("DAIRY");
      expect(result.conservationZones).toContain("REFRIGERATED");
      expect(result.reliabilityScore).toBe(95);
      expect(result.priceTier).toBe(PriceTier.MEDIUM);
      expect(result.preferredStatus).toBe(PreferredStatus.PREFERRED);
    });

    it("should throw NotFoundException if supplier not found", async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.getSupplierClassification("tenant-123", "invalid-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createAutomatedOrder", () => {
    it("should create automated order successfully", async () => {
      const dto = {
        tenantId: "tenant-123",
        supplierId: "supplier-1",
        urgency: Urgency.HIGH,
        items: [
          {
            productId: "product-1",
            requestedQuantity: 100,
            unitPrice: 2.5,
          },
        ],
      };

      const mockOrder = {
        id: "order-1",
        tenantId: "tenant-123",
        supplierId: "supplier-1",
        orderNumber: "ORD-123456-abc123",
        status: OrderStatus.DRAFT,
        urgency: Urgency.HIGH,
        supplier: { name: "Fresh Foods Co" },
        items: [
          {
            id: "item-1",
            orderId: "order-1",
            productId: "product-1",
            requestedQuantity: 100,
            unitPrice: 2.5,
            totalCost: 250,
            product: { name: "Tomatoes", unit: "kg" },
          },
        ],
        createdAt: new Date(),
        createdBy: "user-1",
      };

      mockPrismaService.automatedOrder.create.mockResolvedValue(mockOrder);

      const result = await service.createAutomatedOrder(dto);

      expect(result.tenantId).toBe("tenant-123");
      expect(result.supplierId).toBe("supplier-1");
      expect(result.status).toBe(OrderStatus.DRAFT);
      expect(result.urgency).toBe(Urgency.HIGH);
      expect(result.items.length).toBe(1);
    });
  });

  describe("getAutomatedOrder", () => {
    it("should return order by id", async () => {
      const tenantId = "tenant-123";
      const orderId = "order-1";

      const mockOrder = {
        id: orderId,
        tenantId,
        supplierId: "supplier-1",
        orderNumber: "ORD-123456-abc123",
        status: OrderStatus.DRAFT,
        urgency: Urgency.MEDIUM,
        supplier: { name: "Fresh Foods Co" },
        items: [],
        createdAt: new Date(),
      };

      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getAutomatedOrder(tenantId, orderId);

      expect(result.id).toBe(orderId);
      expect(result.tenantId).toBe(tenantId);
    });

    it("should throw NotFoundException if order not found", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getAutomatedOrder("tenant-123", "invalid-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateOrderItem", () => {
    it("should update order item successfully", async () => {
      const tenantId = "tenant-123";
      const orderId = "order-1";
      const itemId = "item-1";
      const dto = {
        adjustedQuantity: 150,
        notes: "Adjusted for seasonal demand",
      };

      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: orderId,
        tenantId,
      });

      mockPrismaService.orderItem.findUnique.mockResolvedValue({
        id: itemId,
        orderId,
        productId: "product-1",
        requestedQuantity: 100,
        unitPrice: 2.5,
        totalCost: 250,
        product: { name: "Tomatoes", unit: "kg" },
      });

      mockPrismaService.orderItem.update.mockResolvedValue({
        id: itemId,
        orderId,
        productId: "product-1",
        requestedQuantity: 100,
        adjustedQuantity: 150,
        unitPrice: 2.5,
        totalCost: 375,
        notes: "Adjusted for seasonal demand",
        product: { name: "Tomatoes", unit: "kg" },
      });

      const result = await service.updateOrderItem(
        tenantId,
        orderId,
        itemId,
        dto,
      );

      expect(result.adjustedQuantity).toBe(150);
      expect(result.notes).toBe("Adjusted for seasonal demand");
    });

    it("should throw NotFoundException if order not found", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.updateOrderItem("tenant-123", "invalid-id", "item-1", {
          adjustedQuantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if item not found", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: "order-1",
        tenantId: "tenant-123",
      });

      mockPrismaService.orderItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderItem("tenant-123", "order-1", "invalid-item", {
          adjustedQuantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("approveOrder", () => {
    it("should approve order successfully", async () => {
      const tenantId = "tenant-123";
      const orderId = "order-1";
      const dto = {
        approvedBy: "user-1",
      };

      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: orderId,
        tenantId,
        status: OrderStatus.DRAFT,
      });

      mockPrismaService.automatedOrder.update.mockResolvedValue({
        id: orderId,
        tenantId,
        supplierId: "supplier-1",
        orderNumber: "ORD-123456",
        status: OrderStatus.APPROVED,
        approvedBy: "user-1",
        approvedAt: new Date(),
        supplier: { name: "Fresh Foods Co" },
        items: [],
      });

      const result = await service.approveOrder(tenantId, orderId, dto);

      expect(result.status).toBe(OrderStatus.APPROVED);
    });

    it("should throw NotFoundException if order not found", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.approveOrder("tenant-123", "invalid-id", {
          approvedBy: "user-1",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if order status invalid", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: "order-1",
        status: OrderStatus.SENT,
      });

      await expect(
        service.approveOrder("tenant-123", "order-1", { approvedBy: "user-1" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("sendOrder", () => {
    it("should send order successfully", async () => {
      const tenantId = "tenant-123";
      const orderId = "order-1";
      const dto = {
        sentBy: "user-1",
        deliveryMethod: "EMAIL",
      };

      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: orderId,
        tenantId,
        status: OrderStatus.APPROVED,
      });

      mockPrismaService.automatedOrder.update.mockResolvedValue({
        id: orderId,
        tenantId,
        supplierId: "supplier-1",
        orderNumber: "ORD-123456",
        status: OrderStatus.SENT,
        sentAt: new Date(),
        supplier: { name: "Fresh Foods Co" },
        items: [],
      });

      const result = await service.sendOrder(tenantId, orderId, dto);

      expect(result.status).toBe(OrderStatus.SENT);
    });

    it("should throw NotFoundException if order not found", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.sendOrder("tenant-123", "invalid-id", { sentBy: "user-1" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if order not approved", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: "order-1",
        status: OrderStatus.DRAFT,
      });

      await expect(
        service.sendOrder("tenant-123", "order-1", { sentBy: "user-1" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getOrdersHistory", () => {
    it("should return orders history", async () => {
      const tenantId = "tenant-123";

      const mockOrders = [
        {
          id: "order-1",
          tenantId,
          supplierId: "supplier-1",
          orderNumber: "ORD-001",
          status: OrderStatus.SENT,
          supplier: { name: "Supplier A" },
          items: [],
          createdAt: new Date(),
        },
        {
          id: "order-2",
          tenantId,
          supplierId: "supplier-2",
          orderNumber: "ORD-002",
          status: OrderStatus.APPROVED,
          supplier: { name: "Supplier B" },
          items: [],
          createdAt: new Date(),
        },
      ];

      mockPrismaService.automatedOrder.findMany.mockResolvedValue(mockOrders);

      const result = await service.getOrdersHistory(tenantId);

      expect(result.length).toBe(2);
      expect(mockPrismaService.automatedOrder.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          supplier: true,
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });
  });

  describe("edge cases", () => {
    const edgeTenantId = "tenant-edge-123";

    it("should handle order with very large quantities", async () => {
      const mockProduct = {
        id: "prod-1",
        name: "Product 1",
        currentStock: 1000000,
      };
      mockPrismaService.product.findMany.mockResolvedValue([
        { ...mockProduct, stocks: [{ quantity: 20 }] },
      ]);
      mockPrismaService.recipe.findMany.mockResolvedValue([]);

      const requirements = await service.calculateOrderRequirements({
        tenantId: edgeTenantId,
        historicalPeriod: 7,
        lookaheadDays: 7,
      });

      expect(requirements).toBeDefined();
    });

    it("should handle classification with empty products", async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.classifyByCategory([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("should handle update of non-existent order item", async () => {
      mockPrismaService.automatedOrder.findFirst.mockResolvedValue({
        id: "order-1",
      });
      mockPrismaService.orderItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderItem(edgeTenantId, "order-1", "order-item-1", {
          quantity: 10,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle order with missing supplier information", async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Product 1",
          supplierId: null,
        },
      ]);

      const result = await service.classifyBySupplier([]);

      expect(result).toBeDefined();
    });

    it("should get orders by supplier", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "ORD-001",
        supplierId: "supplier-1",
        supplierName: "Supplier 1",
        createdAt: new Date(),
        items: [],
      };

      mockPrismaService.automatedOrder.findMany.mockResolvedValue([mockOrder]);

      const result = await service.getOrdersBySupplier(
        "tenant-1",
        "supplier-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].supplierId).toBe("supplier-1");
    });

    it("should get orders by zone", async () => {
      const mockOrder = {
        id: "order-1",
        orderNumber: "ORD-001",
        supplierId: "supplier-1",
        supplierName: "Supplier 1",
        createdAt: new Date(),
        items: [
          {
            product: {
              conservationZone: "REFRIGERATED",
            },
          },
        ],
      };

      mockPrismaService.automatedOrder.findMany.mockResolvedValue([mockOrder]);

      const result = await service.getOrdersByZone("tenant-1", "REFRIGERATED");

      expect(result).toHaveLength(1);
    });

    it("should generate purchase template", async () => {
      const mockOrder = {
        id: "order-1",
        tenantId: "tenant-1",
        supplierId: "supplier-1",
        orderNumber: "ORD-001",
        status: OrderStatus.DRAFT,
        urgency: Urgency.HIGH,
        scheduledDelivery: new Date(),
        createdAt: new Date(),
        createdBy: "user-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            productName: "Product 1",
            requestedQuantity: 10,
            unit: "kg",
            unitPrice: 5,
            totalCost: 50,
            notes: "Notes",
            alternativeProducts: [],
            product: {
              name: "Product 1",
              unit: "kg",
            },
          },
        ],
        supplier: {
          name: "Supplier 1",
          email: "test@test.com",
          phone: "123-456",
          website: "test.com",
        },
      };

      mockPrismaService.automatedOrder.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.supplier.findUnique.mockResolvedValue(
        mockOrder.supplier,
      );

      const result = await service.generatePurchaseTemplate(
        "tenant-1",
        "order-1",
        {
          format: TemplateFormat.PDF,
        },
      );

      expect(result.id).toBe("template-order-1");
      expect(result.supplierName).toBe("Supplier 1");
      expect(result.orderItems).toHaveLength(1);
      expect(result.total).toBeDefined();
      expect(result.format).toBe(TemplateFormat.PDF);
    });
  });
});
