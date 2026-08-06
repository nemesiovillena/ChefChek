import { Test, TestingModule } from "@nestjs/testing";
import { ProductionService } from "./production.service";
import { PrismaService } from "../../common/services/prisma.service";
import { WarehousesService } from "../almacenes/almacenes.service";
import { NotificationsService } from "../core/notifications.service";
import { WorkBatchNumberService } from "./services/work-batch-number.service";
import { ProductionOrderNumberService } from "./services/production-order-number.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import {
  CreateWorkBatchDto,
  CreateProductionOrderDto,
  CreateMiseEnPlaceItemDto,
  CreateMiseEnPlaceSheetDto,
  CreateProductionTaskDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  CreateStaffMemberDto,
  UpdateAlertDto,
  GenerateProductionReportDto,
  BatchPriority,
  KitchenZone,
  TaskType,
} from "./dto/production.dto";

describe("ProductionService", () => {
  let service: ProductionService;
  let mockPrismaService: any;
  let mockWarehousesService: any;
  let mockNotificationsService: any;

  const tenantId = "test-tenant-id";
  const otherTenantId = "other-tenant-id";
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
      product: {
        findFirst: jest.fn(),
      },
      productionTask: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      miseEnPlaceSheet: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      miseEnPlaceItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      taskAssignment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      staffMember: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      progressTracking: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      milestone: {
        createMany: jest.fn(),
      },
      productionAlert: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      stock: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      productionReport: {
        create: jest.fn(),
      },
    };

    mockWarehousesService = {
      reserveStock: jest.fn().mockResolvedValue({ success: true }),
    };

    mockNotificationsService = {
      notifyProductionDelay: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WarehousesService, useValue: mockWarehousesService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        WorkBatchNumberService,
        ProductionOrderNumberService,
      ],
    })
      .overrideProvider(WorkBatchNumberService)
      .useValue({
        generateBatchNumber: jest.fn().mockResolvedValue("LOTE-0001"),
      })
      .overrideProvider(ProductionOrderNumberService)
      .useValue({ generateOrderNumber: jest.fn().mockResolvedValue("PO-0001") })
      .compile();

    service = module.get<ProductionService>(ProductionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createWorkBatch", () => {
    const dto: CreateWorkBatchDto = {
      description: "Test Description",
      scheduledDate: new Date("2026-12-31"),
      scheduledTime: "10:00",
      priority: BatchPriority.HIGH,
      responsible: ["user1", "user2"],
      kitchenZone: KitchenZone.HOT_KITCHEN,
    };

    it("should create a work batch with a generated sequential number", async () => {
      const mockBatch = {
        id: batchId,
        tenantId,
        batchNumber: "LOTE-0001",
        status: "PLANNED",
      };
      mockPrismaService.workBatch.create.mockResolvedValue(mockBatch);

      const result = await service.createWorkBatch(tenantId, userId, dto);

      expect(result).toEqual({ success: true, data: mockBatch });
      expect(mockPrismaService.workBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          batchNumber: "LOTE-0001",
          status: "PLANNED",
          priority: dto.priority,
          responsible: dto.responsible,
          kitchenZone: dto.kitchenZone,
          createdBy: userId,
        }),
      });
    });
  });

  describe("getWorkBatches", () => {
    it("should query only non-deleted batches for the tenant, ordered by scheduledFor", async () => {
      mockPrismaService.workBatch.findMany.mockResolvedValue([]);

      await service.getWorkBatches(tenantId);

      expect(mockPrismaService.workBatch.findMany).toHaveBeenCalledWith({
        where: { tenantId, deletedAt: null },
        orderBy: { scheduledFor: "desc" },
        include: { productionOrders: true },
      });
    });
  });

  describe("getWorkBatchById", () => {
    it("should return a work batch by id", async () => {
      const mockBatch = { id: batchId, tenantId, productionOrders: [] };
      mockPrismaService.workBatch.findFirst.mockResolvedValue(mockBatch);

      const result = await service.getWorkBatchById(tenantId, batchId);

      expect(result).toEqual(mockBatch);
    });

    it("should throw NotFoundException when batch not found", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(service.getWorkBatchById(tenantId, batchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should not leak a batch belonging to another tenant", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.getWorkBatchById(otherTenantId, batchId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.workBatch.findFirst).toHaveBeenCalledWith({
        where: { id: batchId, tenantId: otherTenantId, deletedAt: null },
        include: { productionOrders: { include: { miseEnPlaceItems: true } } },
      });
    });
  });

  describe("startWorkBatch / completeWorkBatch", () => {
    it("should start a work batch", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue({ id: batchId });
      mockPrismaService.workBatch.update.mockResolvedValue({
        id: batchId,
        status: "IN_PROGRESS",
      });

      const result = await service.startWorkBatch(tenantId, batchId);

      expect(result.data.status).toBe("IN_PROGRESS");
    });

    it("should throw NotFoundException starting a missing batch", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(service.startWorkBatch(tenantId, batchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should complete a batch and skip the report when it has no orders", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue({ id: batchId });
      mockPrismaService.workBatch.update.mockResolvedValue({
        id: batchId,
        status: "COMPLETED",
      });
      mockPrismaService.workBatch.findUnique.mockResolvedValue({
        tenantId,
        productionOrders: [],
      });

      await service.completeWorkBatch(tenantId, batchId);

      expect(mockPrismaService.productionReport.create).not.toHaveBeenCalled();
    });
  });

  describe("createProductionOrder", () => {
    const dto: CreateProductionOrderDto = {
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

    it("should create a production order and reserve stock via WarehousesService", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue({ id: batchId });
      mockPrismaService.product.findFirst.mockResolvedValue({
        referenceUnit: "kg",
      });
      mockPrismaService.productionOrder.create.mockResolvedValue({
        id: orderId,
        orderNumber: "PO-0001",
      });

      const result = await service.createProductionOrder(tenantId, userId, dto);

      expect(result.success).toBe(true);
      // ingrediente (5) × cantidad del pedido (10) = 50 — debe cuadrar con lo
      // que updateInventory consumirá al completar (regression del bug real
      // encontrado en pruebas manuales: reservedStock quedaba negativo).
      expect(mockWarehousesService.reserveStock).toHaveBeenCalledWith(
        tenantId,
        "prod1",
        50,
      );
      expect(mockPrismaService.productionOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          batchId,
          recipeId: dto.recipeId,
          quantity: dto.quantity,
          estimatedTime: dto.estimatedTime,
          orderNumber: "PO-0001",
          createdBy: userId,
        }),
      });
    });

    it("should throw NotFoundException when the batch does not belong to the tenant", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.createProductionOrder(tenantId, userId, dto),
      ).rejects.toThrow(NotFoundException);
      expect(mockWarehousesService.reserveStock).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when an ingredient is not available", async () => {
      mockPrismaService.workBatch.findFirst.mockResolvedValue({ id: batchId });
      const dtoWithUnavailable: CreateProductionOrderDto = {
        ...dto,
        ingredients: [{ ...dto.ingredients[0], isAvailable: false }],
      };

      await expect(
        service.createProductionOrder(tenantId, userId, dtoWithUnavailable),
      ).rejects.toThrow(BadRequestException);
      expect(mockWarehousesService.reserveStock).not.toHaveBeenCalled();
    });
  });

  describe("getProductionOrdersByBatch", () => {
    it("should filter by batchId and tenantId directly (no relation traversal needed)", async () => {
      mockPrismaService.productionOrder.findMany.mockResolvedValue([]);

      await service.getProductionOrdersByBatch(tenantId, batchId);

      expect(mockPrismaService.productionOrder.findMany).toHaveBeenCalledWith({
        where: { batchId, tenantId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { miseEnPlaceItems: true },
      });
    });
  });

  describe("startProductionOrder", () => {
    it("should start an order and initialize progress tracking + milestones", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
        estimatedTime: 60,
      });
      mockPrismaService.productionOrder.update.mockResolvedValue({
        id: orderId,
        status: "IN_PROGRESS",
      });

      const result = await service.startProductionOrder(tenantId, orderId);

      expect(result.data.status).toBe("IN_PROGRESS");
      expect(mockPrismaService.progressTracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId,
          overallProgress: 0,
          timeRemaining: 60,
          status: "ON_SCHEDULE",
        }),
      });
      expect(mockPrismaService.milestone.createMany).toHaveBeenCalled();
    });

    it("should throw NotFoundException for an order in another tenant", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.startProductionOrder(tenantId, orderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("completeProductionOrder", () => {
    it("should complete an order, update tracking and decrement stock via the Stock model", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.productionOrder.update.mockResolvedValue({
        id: orderId,
        status: "COMPLETED",
        actualTime: 50,
      });
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        id: orderId,
        tenantId,
        createdAt: new Date(),
        estimatedTime: 60,
        quantity: 10,
        items: [{ productId: "prod1", quantity: 5, unit: "kg" }],
      });
      mockPrismaService.stock.findFirst.mockResolvedValue({
        id: "stock1",
        quantity: 100,
        reservedStock: 50,
      });
      mockPrismaService.product.findFirst.mockResolvedValue({
        referenceUnit: "kg",
      });

      const result = await service.completeProductionOrder(
        tenantId,
        orderId,
        50,
      );

      expect(result.data.status).toBe("COMPLETED");
      expect(mockPrismaService.stock.update).toHaveBeenCalledWith({
        where: { id: "stock1" },
        data: {
          quantity: { decrement: 50 },
          reservedStock: { decrement: 50 },
        },
      });
    });

    it("regression: creates a delay alert and notifies when completion is very late (condition used to be inverted and never fired)", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.productionOrder.update.mockResolvedValue({
        id: orderId,
        status: "COMPLETED",
        actualTime: 500,
      });
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        id: orderId,
        tenantId,
        orderNumber: "PO-0001",
        recipeName: "Salmón a la Plancha",
        createdAt: new Date(Date.now() - 500 * 60 * 1000), // hace 500 min
        estimatedTime: 60,
        quantity: 1,
        items: [],
      });
      mockPrismaService.progressTracking.findUnique.mockResolvedValue({
        orderId,
        status: "CRITICAL",
      });
      mockPrismaService.productionAlert.findFirst.mockResolvedValue(null);

      await service.completeProductionOrder(tenantId, orderId, 500);

      expect(mockPrismaService.productionAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          orderId,
          alertType: "DELAY",
        }),
      });
      expect(
        mockNotificationsService.notifyProductionDelay,
      ).toHaveBeenCalledWith(
        tenantId,
        "PO-0001",
        "Salmón a la Plancha",
        "CRITICAL",
      );
    });

    it("does not create a duplicate delay alert when one is already active", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.productionOrder.update.mockResolvedValue({
        id: orderId,
        status: "COMPLETED",
      });
      mockPrismaService.productionOrder.findUnique.mockResolvedValue({
        id: orderId,
        tenantId,
        orderNumber: "PO-0001",
        recipeName: "Salmón a la Plancha",
        createdAt: new Date(Date.now() - 500 * 60 * 1000),
        estimatedTime: 60,
        quantity: 1,
        items: [],
      });
      mockPrismaService.progressTracking.findUnique.mockResolvedValue({
        orderId,
        status: "CRITICAL",
      });
      mockPrismaService.productionAlert.findFirst.mockResolvedValue({
        id: "existing-alert",
      });

      await service.completeProductionOrder(tenantId, orderId, 500);

      expect(mockPrismaService.productionAlert.create).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.notifyProductionDelay,
      ).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when order not found for tenant", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.completeProductionOrder(tenantId, orderId, 50),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createMiseEnPlaceSheet", () => {
    const dto: CreateMiseEnPlaceSheetDto = {
      batchId,
      orderId,
      zone: KitchenZone.HOT_KITCHEN,
      checklists: [
        {
          item: "Knife Set",
          description: "Sharpened knives",
          category: "TOOLS" as any,
        },
      ],
    };

    it("should create a sheet when the order belongs to the tenant", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.miseEnPlaceSheet.create.mockResolvedValue({
        id: "sheet1",
      });

      const result = await service.createMiseEnPlaceSheet(tenantId, dto);

      expect(result.success).toBe(true);
    });

    it("should throw NotFoundException when the order is not the tenant's", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.createMiseEnPlaceSheet(tenantId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("addMiseEnPlaceItem", () => {
    const dto: CreateMiseEnPlaceItemDto = {
      orderId,
      description: "Chopped vegetables",
      quantity: 5,
      unit: "kg",
    };

    it("should add an item when the order belongs to the tenant", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.miseEnPlaceItem.create.mockResolvedValue({
        id: "item1",
      });

      const result = await service.addMiseEnPlaceItem(tenantId, dto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.miseEnPlaceItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId, orderId, status: "PENDING" }),
      });
    });
  });

  describe("getMiseEnPlaceSheetByOrder / getMiseEnPlaceSheet", () => {
    it("regression: items are looked up by orderId, not the sheetId relation (items are created without a sheetId)", async () => {
      mockPrismaService.miseEnPlaceSheet.findFirst.mockResolvedValue({
        id: "sheet1",
        orderId,
        zone: "HOT_KITCHEN",
      });
      mockPrismaService.miseEnPlaceItem.findMany.mockResolvedValue([
        { id: "item1", orderId },
      ]);

      const result = await service.getMiseEnPlaceSheetByOrder(
        tenantId,
        orderId,
      );

      expect(mockPrismaService.miseEnPlaceItem.findMany).toHaveBeenCalledWith({
        where: { orderId, tenantId },
        orderBy: { createdAt: "asc" },
      });
      expect(result.items).toEqual([{ id: "item1", orderId }]);
    });

    it("returns null when the order has no sheet yet (not a 404)", async () => {
      mockPrismaService.miseEnPlaceSheet.findFirst.mockResolvedValue(null);

      const result = await service.getMiseEnPlaceSheetByOrder(
        tenantId,
        orderId,
      );

      expect(result).toBeNull();
      expect(mockPrismaService.miseEnPlaceItem.findMany).not.toHaveBeenCalled();
    });

    it("getMiseEnPlaceSheet (by sheetId) also resolves items via orderId", async () => {
      mockPrismaService.miseEnPlaceSheet.findFirst.mockResolvedValue({
        id: "sheet1",
        orderId,
      });
      mockPrismaService.miseEnPlaceItem.findMany.mockResolvedValue([
        { id: "item1", orderId },
      ]);

      const result = await service.getMiseEnPlaceSheet(tenantId, "sheet1");

      expect(result.items).toEqual([{ id: "item1", orderId }]);
    });

    it("getMiseEnPlaceSheet throws NotFoundException when the sheet doesn't exist", async () => {
      mockPrismaService.miseEnPlaceSheet.findFirst.mockResolvedValue(null);

      await expect(
        service.getMiseEnPlaceSheet(tenantId, "sheet1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateMiseEnPlaceItem", () => {
    it("should update status scoped to the tenant", async () => {
      mockPrismaService.miseEnPlaceItem.findFirst.mockResolvedValue({
        id: "item1",
      });
      mockPrismaService.miseEnPlaceItem.update.mockResolvedValue({
        id: "item1",
        status: "READY",
      });

      const result = await service.updateMiseEnPlaceItem(
        tenantId,
        "item1",
        "READY",
      );

      expect(result.data.status).toBe("READY");
      expect(mockPrismaService.miseEnPlaceItem.findFirst).toHaveBeenCalledWith({
        where: { id: "item1", tenantId },
      });
    });

    it("regression (IDOR fix): should throw NotFoundException for an item belonging to another tenant", async () => {
      mockPrismaService.miseEnPlaceItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMiseEnPlaceItem(otherTenantId, "item1", "READY"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.miseEnPlaceItem.update).not.toHaveBeenCalled();
    });
  });

  describe("createProductionTask", () => {
    const dto: CreateProductionTaskDto = {
      orderId,
      title: "Cortar verduras",
      taskType: TaskType.PREPARATION,
      estimatedTime: 30,
    };

    it("should create a task when the order belongs to the tenant", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue({
        id: orderId,
      });
      mockPrismaService.productionTask.create.mockResolvedValue({
        id: "task1",
      });

      const result = await service.createProductionTask(tenantId, dto);

      expect(result.success).toBe(true);
    });

    it("should throw NotFoundException when the order is not the tenant's", async () => {
      mockPrismaService.productionOrder.findFirst.mockResolvedValue(null);

      await expect(service.createProductionTask(tenantId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getProductionTasksByOrder", () => {
    it("should scope by orderId and tenantId", async () => {
      mockPrismaService.productionTask.findMany.mockResolvedValue([]);

      await service.getProductionTasksByOrder(tenantId, orderId);

      expect(mockPrismaService.productionTask.findMany).toHaveBeenCalledWith({
        where: { orderId, tenantId },
        orderBy: { createdAt: "asc" },
        include: { assignments: true },
      });
    });
  });

  describe("createTaskAssignment", () => {
    const dto: CreateTaskAssignmentDto = {
      orderId,
      taskId: "task1",
      assignedTo: "staff1",
    };

    it("should create a task assignment when staff has capacity", async () => {
      mockPrismaService.productionTask.findFirst.mockResolvedValue({
        id: "task1",
      });
      mockPrismaService.staffMember.findFirst.mockResolvedValue({
        id: "staff1",
        isActive: true,
        assignedTasks: 2,
        maxTasks: 5,
      });
      mockPrismaService.taskAssignment.create.mockResolvedValue({
        id: "assignment1",
      });

      const result = await service.createTaskAssignment(tenantId, dto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.staffMember.update).toHaveBeenCalledWith({
        where: { id: "staff1" },
        data: { assignedTasks: { increment: 1 } },
      });
    });

    it("should throw NotFoundException when the task is not the tenant's", async () => {
      mockPrismaService.productionTask.findFirst.mockResolvedValue(null);

      await expect(service.createTaskAssignment(tenantId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException when staff not found or inactive", async () => {
      mockPrismaService.productionTask.findFirst.mockResolvedValue({
        id: "task1",
      });
      mockPrismaService.staffMember.findFirst.mockResolvedValue(null);

      await expect(service.createTaskAssignment(tenantId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when staff at max capacity", async () => {
      mockPrismaService.productionTask.findFirst.mockResolvedValue({
        id: "task1",
      });
      mockPrismaService.staffMember.findFirst.mockResolvedValue({
        id: "staff1",
        isActive: true,
        assignedTasks: 5,
        maxTasks: 5,
      });

      await expect(service.createTaskAssignment(tenantId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getTaskAssignments", () => {
    it("filters by orderId when provided", async () => {
      mockPrismaService.taskAssignment.findMany.mockResolvedValue([]);

      await service.getTaskAssignments(tenantId, orderId);

      expect(mockPrismaService.taskAssignment.findMany).toHaveBeenCalledWith({
        where: { tenantId, orderId },
        orderBy: { assignedAt: "desc" },
      });
    });

    it("omits the orderId filter when not provided", async () => {
      mockPrismaService.taskAssignment.findMany.mockResolvedValue([]);

      await service.getTaskAssignments(tenantId);

      expect(mockPrismaService.taskAssignment.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { assignedAt: "desc" },
      });
    });
  });

  describe("updateTaskAssignment", () => {
    const dto: UpdateTaskAssignmentDto = {
      status: "COMPLETED" as any,
      actualTime: 45,
    };

    it("should complete an assignment and decrement staff tasks", async () => {
      mockPrismaService.taskAssignment.findFirst.mockResolvedValue({
        id: "assignment1",
      });
      mockPrismaService.taskAssignment.update.mockResolvedValue({
        id: "assignment1",
        status: "COMPLETED",
        staffMemberId: "staff1",
        taskId: "task1",
      });

      const result = await service.updateTaskAssignment(
        tenantId,
        "assignment1",
        dto,
      );

      expect(result.data.status).toBe("COMPLETED");
      expect(mockPrismaService.staffMember.update).toHaveBeenCalledWith({
        where: { id: "staff1" },
        data: { assignedTasks: { decrement: 1 } },
      });
    });

    it("should throw NotFoundException for an assignment in another tenant", async () => {
      mockPrismaService.taskAssignment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTaskAssignment(otherTenantId, "assignment1", dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createStaffMember / updateStaffMember", () => {
    it("should create a staff member with defaults", async () => {
      const dto: CreateStaffMemberDto = {
        name: "Lucía Fernández",
        role: "COCINERA",
      };
      mockPrismaService.staffMember.create.mockResolvedValue({
        id: "staff1",
        ...dto,
      });

      const result = await service.createStaffMember(tenantId, dto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.staffMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: dto.name,
          availableHours: 40,
          maxTasks: 10,
        }),
      });
    });

    it("should throw NotFoundException updating a staff member from another tenant", async () => {
      mockPrismaService.staffMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStaffMember(otherTenantId, "staff1", { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getStaffMembers", () => {
    it("should list all staff for the tenant, active and inactive", async () => {
      mockPrismaService.staffMember.findMany.mockResolvedValue([]);

      await service.getStaffMembers(tenantId);

      expect(mockPrismaService.staffMember.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("getActiveAlerts / resolveAlert", () => {
    it("should return only unresolved alerts for the tenant", async () => {
      mockPrismaService.productionAlert.findMany.mockResolvedValue([]);

      await service.getActiveAlerts(tenantId);

      expect(mockPrismaService.productionAlert.findMany).toHaveBeenCalledWith({
        where: { tenantId, isResolved: false },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should resolve an alert, setting isResolved and resolution", async () => {
      const dto: UpdateAlertDto = {
        resolvedBy: userId,
        resolution: "Issue fixed",
      };
      mockPrismaService.productionAlert.findFirst.mockResolvedValue({
        id: "alert1",
      });
      mockPrismaService.productionAlert.update.mockResolvedValue({
        id: "alert1",
        isResolved: true,
        resolvedBy: userId,
      });

      const result = await service.resolveAlert(tenantId, "alert1", dto);

      expect(result.data.isResolved).toBe(true);
      expect(mockPrismaService.productionAlert.update).toHaveBeenCalledWith({
        where: { id: "alert1" },
        data: expect.objectContaining({ isResolved: true, resolvedBy: userId }),
      });
    });

    it("should throw NotFoundException when alert not found for tenant", async () => {
      mockPrismaService.productionAlert.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveAlert(tenantId, "alert1", { resolvedBy: userId }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateProductionReport", () => {
    const dto: GenerateProductionReportDto = {
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    };

    it("should generate a report with KPIs computed from collected data", async () => {
      mockPrismaService.workBatch.findMany.mockResolvedValue([]);
      mockPrismaService.productionOrder.findMany.mockResolvedValue([
        { status: "COMPLETED", actualTime: 50, estimatedTime: 60 },
      ]);
      mockPrismaService.taskAssignment.findMany.mockResolvedValue([]);
      mockPrismaService.productionAlert.findMany.mockResolvedValue([]);

      const result = await service.generateProductionReport(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.data.kpis.completionRate).toBe(100);
    });

    it("should not divide by zero when there are no orders with times", async () => {
      mockPrismaService.workBatch.findMany.mockResolvedValue([]);
      mockPrismaService.productionOrder.findMany.mockResolvedValue([]);
      mockPrismaService.taskAssignment.findMany.mockResolvedValue([]);
      mockPrismaService.productionAlert.findMany.mockResolvedValue([]);

      const result = await service.generateProductionReport(tenantId, dto);

      expect(Number.isFinite(result.data.kpis.efficiency)).toBe(true);
      expect(Number.isFinite(result.data.kpis.completionRate)).toBe(true);
    });
  });
});
