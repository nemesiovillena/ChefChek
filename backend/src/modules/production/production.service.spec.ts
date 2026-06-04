import { Test, TestingModule } from "@nestjs/testing";
import { ProductionService } from "./production.service";
import { PrismaService } from "../../common/services/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import {
  CreateWorkBatchDto,
  CreateProductionOrderDto,
  CreateMiseEnPlaceItemDto,
  CreateMiseEnPlaceSheetDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  UpdateAlertDto,
  GenerateProductionReportDto,
} from "./dto/production.dto";

describe("ProductionService", () => {
  let service: ProductionService;
  let mockPrismaService: any;

  const tenantId = "test-tenant-id";
  const userId = "test-user-id";
  const batchId = "test-batch-id";
  const orderId = "test-order-id";

  beforeEach(async () => {
    mockPrismaService = {
      workBatch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      productionOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      miseEnPlaceSheet: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      miseEnPlaceItem: {
        create: jest.fn(),
        update: jest.fn(),
      },
      taskAssignment: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      staffMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        fields: { maxTasks: 5 },
      },
      progressTracking: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      milestone: {
        create: jest.fn(),
      },
      productionAlert: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      product: {
        update: jest.fn(),
      },
      productionReport: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createWorkBatch", () => {
    const createWorkBatchDto: CreateWorkBatchDto = {
      name: "Test Batch",
      description: "Test Description",
      scheduledDate: new Date("2024-12-31"),
      scheduledTime: "10:00",
      priority: "HIGH" as any,
      responsible: ["user1", "user2"],
      kitchenZone: "HOT_KITCHEN" as any,
    };

    it("should create a work batch successfully", async () => {
      const mockBatch = {
        id: batchId,
        tenantId,
        batchNumber: createWorkBatchDto.name,
        batchType: "PREPARATION",
        status: "PENDING",
        scheduledFor: expect.any(Date),
        createdBy: userId,
      };

      mockPrismaService.workBatch.create.mockResolvedValue(mockBatch);

      const result = await service.createWorkBatch(
        tenantId,
        userId,
        createWorkBatchDto,
      );

      expect(result).toEqual({
        success: true,
        data: mockBatch,
      });
      expect(mockPrismaService.workBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          batchNumber: createWorkBatchDto.name,
          batchType: "PREPARATION",
          status: "PENDING",
          createdBy: userId,
        }),
      });
    });
  });

  describe("getWorkBatches", () => {
    it("should return all work batches for a tenant", async () => {
      const mockBatches = [
        { id: "batch1", tenantId, productionOrders: [] },
        { id: "batch2", tenantId, productionOrders: [] },
      ];

      mockPrismaService.workBatch.findMany.mockResolvedValue(mockBatches);

      const result = await service.getWorkBatches(tenantId);

      expect(result).toEqual(mockBatches);
      expect(mockPrismaService.workBatch.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { scheduledDate: "desc" },
        include: {
          productionOrders: true,
        },
      });
    });

    it("should return empty array when no batches exist", async () => {
      mockPrismaService.workBatch.findMany.mockResolvedValue([]);

      const result = await service.getWorkBatches(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe("getWorkBatchById", () => {
    it("should return a work batch by id", async () => {
      const mockBatch = {
        id: batchId,
        tenantId,
        productionOrders: [],
      };

      mockPrismaService.workBatch.findFirst.mockResolvedValue(mockBatch);

      const result = await service.getWorkBatchById(tenantId, batchId);

      expect(result).toEqual(mockBatch);
      expect(mockPrismaService.workBatch.findFirst).toHaveBeenCalledWith({
        where: { id: batchId, tenantId },
        include: {
          productionOrders: {
            include: {
              miseEnPlaceItems: true,
            },
          },
        },
      });
    });

    it("should throw NotFoundException when batch not found", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(service.getWorkBatchById(tenantId, batchId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("startWorkBatch", () => {
    it("should start a work batch successfully", async () => {
      const existingBatch = { id: batchId, tenantId };
      const updatedBatch = {
        ...existingBatch,
        status: "IN_PROGRESS",
        startedAt: expect.any(Date),
      };

      mockPrismaService.workBatch.findFirst.mockResolvedValue(existingBatch);
      mockPrismaService.workBatch.update.mockResolvedValue(updatedBatch);
      mockPrismaService.productionOrder.findMany.mockResolvedValue([]);
      mockPrismaService.progressTracking.create.mockResolvedValue({});
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        estimatedTime: 60,
      });

      const result = await service.startWorkBatch(tenantId, batchId, userId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("IN_PROGRESS");
      expect(mockPrismaService.workBatch.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: "IN_PROGRESS",
          startedAt: expect.any(Date),
        },
      });
    });

    it("should throw NotFoundException when batch not found", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.startWorkBatch(tenantId, batchId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("completeWorkBatch", () => {
    it("should complete a work batch successfully", async () => {
      const existingBatch = { id: batchId, tenantId };
      const updatedBatch = {
        ...existingBatch,
        status: "COMPLETED",
        completedAt: expect.any(Date),
      };

      mockPrismaService.workBatch.findFirst.mockResolvedValue(existingBatch);
      mockPrismaService.workBatch.update.mockResolvedValue(updatedBatch);
      mockPrismaService.workBatch.findUnique.mockResolvedValue({
        tenantId,
        productionOrders: [],
      });

      const result = await service.completeWorkBatch(tenantId, batchId, userId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("COMPLETED");
      expect(mockPrismaService.workBatch.update).toHaveBeenCalledWith({
        where: { id: batchId },
        data: {
          status: "COMPLETED",
          completedAt: expect.any(Date),
        },
      });
    });

    it("should throw NotFoundException when batch not found", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.completeWorkBatch(tenantId, batchId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createProductionOrder", () => {
    const createProductionOrderDto: CreateProductionOrderDto = {
      batchId,
      recipeId: "recipe1",
      recipeName: "Test Recipe",
      quantity: 10,
      unit: "kg",
      estimatedTime: 60,
      ingredients: [
        {
          productId: "prod1",
          productName: "Ingredient 1",
          quantity: 5,
          unit: "kg",
          isAvailable: true,
        },
      ],
    };

    it("should create a production order successfully", async () => {
      const mockOrder = {
        id: orderId,
        tenantId,
        orderNumber: expect.stringContaining("PO-"),
        orderType: "PREPARATION",
        status: "PENDING",
      };

      mockPrismaService.product.update.mockResolvedValue({});
      mockPrismaService.productionOrder.create.mockResolvedValue(mockOrder);

      const result = await service.createProductionOrder(
        tenantId,
        createProductionOrderDto,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrder);
    });

    it("should throw BadRequestException when ingredient is not available", async () => {
      const dtoWithUnavailableIngredient: CreateProductionOrderDto = {
        ...createProductionOrderDto,
        ingredients: [
          {
            productId: "prod1",
            productName: "Ingredient 1",
            quantity: 5,
            unit: "kg",
            isAvailable: false,
          },
        ],
      };

      await expect(
        service.createProductionOrder(tenantId, dtoWithUnavailableIngredient),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getProductionOrdersByBatch", () => {
    it("should return all production orders for a batch", async () => {
      const mockOrders = [
        { id: "order1", batchId, miseEnPlaceItems: [] },
        { id: "order2", batchId, miseEnPlaceItems: [] },
      ];

      mockPrismaService.productionOrder.findMany.mockResolvedValue(mockOrders);

      const result = await service.getProductionOrdersByBatch(
        tenantId,
        batchId,
      );

      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.productionOrder.findMany).toHaveBeenCalledWith({
        where: { batchId, batch: { tenantId } },
        orderBy: { createdAt: "asc" },
        include: {
          miseEnPlaceItems: true,
        },
      });
    });
  });

  describe("startProductionOrder", () => {
    it("should start a production order successfully", async () => {
      const existingOrder = { id: orderId };
      const updatedOrder = { ...existingOrder, status: "IN_PROGRESS" };

      mockPrismaService.productionOrder.findFirst.mockResolvedValue(
        existingOrder,
      );
      mockPrismaService.productionOrder.update.mockResolvedValue(updatedOrder);
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        createdAt: new Date(),
        estimatedTime: 60,
      });
      mockPrismaService.progressTracking.findUnique.mockResolvedValue(null);
      mockPrismaService.progressTracking.update.mockResolvedValue({});

      const result = await service.startProductionOrder(tenantId, orderId);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("IN_PROGRESS");
    });

    it("should throw NotFoundException when order not found", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.startProductionOrder(tenantId, orderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("completeProductionOrder", () => {
    it("should complete a production order successfully", async () => {
      const existingOrder = { id: orderId, ingredients: [] };
      const updatedOrder = {
        ...existingOrder,
        status: "COMPLETED",
        actualTime: 50,
      };

      mockPrismaService.productionOrder.findFirst.mockResolvedValue(
        existingOrder,
      );
      mockPrismaService.productionOrder.update.mockResolvedValue(updatedOrder);
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        createdAt: new Date(),
        estimatedTime: 60,
        ingredients: [],
      });
      mockPrismaService.progressTracking.update.mockResolvedValue({});
      mockPrismaService.product.update.mockResolvedValue({});

      const result = await service.completeProductionOrder(
        tenantId,
        orderId,
        50,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.actualTime).toBe(50);
    });

    it("should throw NotFoundException when order not found", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.completeProductionOrder(tenantId, orderId, 50),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createMiseEnPlaceSheet", () => {
    const createMiseEnPlaceSheetDto: CreateMiseEnPlaceSheetDto = {
      batchId,
      orderId,
      zone: "HOT_KITCHEN" as any,
      checklists: [
        {
          item: "Knife Set",
          description: "Sharpened knives",
          category: "TOOLS" as any,
        },
      ],
    };

    it("should create a mise en place sheet successfully", async () => {
      const mockSheet = {
        id: "sheet1",
        tenantId,
        batchId,
        orderId,
        zone: createMiseEnPlaceSheetDto.zone,
        checklists: createMiseEnPlaceSheetDto.checklists.map((item) => ({
          ...item,
          checked: false,
        })),
      };

      mockPrismaService.miseEnPlaceSheet.create.mockResolvedValue(mockSheet);

      const result = await service.createMiseEnPlaceSheet(
        tenantId,
        createMiseEnPlaceSheetDto,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSheet);
    });
  });

  describe("addMiseEnPlaceItem", () => {
    const createMiseEnPlaceItemDto: CreateMiseEnPlaceItemDto = {
      orderId,
      description: "Chopped vegetables",
      quantity: 5,
      unit: "kg",
      notes: "Cut into small cubes",
    };

    it("should add a mise en place item successfully", async () => {
      const mockItem = {
        id: "item1",
        tenantId,
        ...createMiseEnPlaceItemDto,
        status: "PENDING",
      };

      mockPrismaService.miseEnPlaceItem.create.mockResolvedValue(mockItem);

      const result = await service.addMiseEnPlaceItem(
        tenantId,
        createMiseEnPlaceItemDto,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockItem);
    });
  });

  describe("updateMiseEnPlaceItem", () => {
    it("should update mise en place item status to READY", async () => {
      const mockItem = {
        id: "item1",
        status: "READY",
        completedAt: expect.any(Date),
      };

      mockPrismaService.miseEnPlaceItem.update.mockResolvedValue(mockItem);

      const result = await service.updateMiseEnPlaceItem(
        tenantId,
        "item1",
        "READY",
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("READY");
    });

    it("should update mise en place item status to VERIFIED with userId", async () => {
      const mockItem = {
        id: "item1",
        status: "VERIFIED",
        completedAt: expect.any(Date),
        verifiedBy: userId,
      };

      mockPrismaService.miseEnPlaceItem.update.mockResolvedValue(mockItem);

      const result = await service.updateMiseEnPlaceItem(
        tenantId,
        "item1",
        "VERIFIED",
        userId,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("VERIFIED");
      expect(result.data.verifiedBy).toBe(userId);
    });
  });

  describe("createTaskAssignment", () => {
    const createTaskAssignmentDto: CreateTaskAssignmentDto = {
      batchId,
      orderId,
      taskId: "task1",
      assignedTo: "staff1",
      taskType: "PREPARATION" as any,
      estimatedTime: 30,
      dependencies: [],
    };

    it("should create a task assignment successfully", async () => {
      const mockStaff = {
        id: "staff1",
        availability: true,
        currentTasks: 2,
        maxTasks: 5,
      };
      const mockAssignment = {
        id: "assignment1",
        ...createTaskAssignmentDto,
        status: "ASSIGNED",
        assignedAt: expect.any(Date),
      };

      mockPrismaService.staffMember.findUnique.mockResolvedValue(mockStaff);
      mockPrismaService.taskAssignment.create.mockResolvedValue(mockAssignment);
      mockPrismaService.staffMember.update.mockResolvedValue({});

      const result = await service.createTaskAssignment(
        tenantId,
        createTaskAssignmentDto,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAssignment);
    });

    it("should throw BadRequestException when staff not available", async () => {
      mockPrismaService.staffMember.findUnique.mockResolvedValue(null);

      await expect(
        service.createTaskAssignment(tenantId, createTaskAssignmentDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when staff at max capacity", async () => {
      const mockStaff = {
        id: "staff1",
        availability: true,
        currentTasks: 5,
        maxTasks: 5,
      };

      mockPrismaService.staffMember.findUnique.mockResolvedValue(mockStaff);

      await expect(
        service.createTaskAssignment(tenantId, createTaskAssignmentDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateTaskAssignment", () => {
    const updateTaskAssignmentDto: UpdateTaskAssignmentDto = {
      status: "COMPLETED" as any,
      actualTime: 45,
    };

    it("should update task assignment successfully", async () => {
      const mockAssignment = {
        id: "assignment1",
        assignedTo: "staff1",
        status: "COMPLETED",
        actualTime: 45,
        completedAt: expect.any(Date),
      };

      mockPrismaService.taskAssignment.update.mockResolvedValue(mockAssignment);
      mockPrismaService.staffMember.update.mockResolvedValue({});

      const result = await service.updateTaskAssignment(
        tenantId,
        "assignment1",
        updateTaskAssignmentDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("COMPLETED");
    });
  });

  describe("getActiveAlerts", () => {
    it("should return all active alerts for a tenant", async () => {
      const mockAlerts = [
        { id: "alert1", type: "DELAY", resolvedAt: null },
        { id: "alert2", type: "QUALITY", resolvedAt: null },
      ];

      mockPrismaService.productionAlert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getActiveAlerts(tenantId);

      expect(result).toEqual(mockAlerts);
    });
  });

  describe("resolveAlert", () => {
    const updateAlertDto: UpdateAlertDto = {
      resolvedBy: userId,
      resolution: "Issue fixed",
    };

    it("should resolve an alert successfully", async () => {
      const mockAlert = {
        id: "alert1",
        resolvedAt: expect.any(Date),
        resolvedBy: userId,
        resolution: "Issue fixed",
      };

      mockPrismaService.productionAlert.findFirst.mockResolvedValue({
        id: "alert1",
      });
      mockPrismaService.productionAlert.update.mockResolvedValue(mockAlert);

      const result = await service.resolveAlert(
        tenantId,
        "alert1",
        updateAlertDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.resolvedBy).toBe(userId);
    });

    it("should throw NotFoundException when alert not found", async () => {
      mockPrismaService.productionAlert.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveAlert(tenantId, "alert1", updateAlertDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateProductionReport", () => {
    const generateReportDto: GenerateProductionReportDto = {
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    };

    it("should generate a production report successfully", async () => {
      mockPrismaService.workBatch.findMany.mockResolvedValue([]);
      mockPrismaService.productionOrder.findMany.mockResolvedValue([
        { status: "COMPLETED", actualTime: 50, estimatedTime: 60 },
      ]);
      mockPrismaService.taskAssignment.findMany.mockResolvedValue([]);
      mockPrismaService.productionAlert.findMany.mockResolvedValue([]);

      const result = await service.generateProductionReport(
        tenantId,
        generateReportDto,
      );

      expect(result.success).toBe(true);
      expect(result.data.period).toEqual({
        startDate: generateReportDto.startDate,
        endDate: generateReportDto.endDate,
      });
      expect(result.data.kpis).toBeDefined();
      expect(result.data.generatedAt).toBeDefined();
    });
  });
});
