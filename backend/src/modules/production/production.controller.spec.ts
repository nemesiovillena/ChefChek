import { Test, TestingModule } from "@nestjs/testing";
import { ProductionController } from "./production.controller";
import { ProductionService } from "./production.service";
import {
  BatchPriority,
  KitchenZone,
  TaskType,
  TaskStatus,
} from "./dto/production.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("ProductionController", () => {
  let controller: ProductionController;

  const mockProductionService = {
    createWorkBatch: jest.fn(),
    getWorkBatches: jest.fn(),
    getWorkBatchById: jest.fn(),
    startWorkBatch: jest.fn(),
    completeWorkBatch: jest.fn(),
    createProductionOrder: jest.fn(),
    getProductionOrdersByBatch: jest.fn(),
    startProductionOrder: jest.fn(),
    completeProductionOrder: jest.fn(),
    createMiseEnPlaceSheet: jest.fn(),
    getMiseEnPlaceSheet: jest.fn(),
    addMiseEnPlaceItem: jest.fn(),
    updateMiseEnPlaceItem: jest.fn(),
    verifyMiseEnPlaceSheet: jest.fn(),
    createTaskAssignment: jest.fn(),
    getTaskAssignments: jest.fn(),
    updateTaskAssignment: jest.fn(),
    getStaffAvailable: jest.fn(),
    getStaffMemberTasks: jest.fn(),
    getProgressTracking: jest.fn(),
    getActiveAlerts: jest.fn(),
    resolveAlert: jest.fn(),
    generateProductionReport: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionController],
      providers: [
        { provide: ProductionService, useValue: mockProductionService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductionController>(ProductionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Work Batches", () => {
    describe("createWorkBatch", () => {
      it("should create a work batch", async () => {
        const dto = {
          name: "Batch 1",
          scheduledDate: new Date("2026-06-05"),
          scheduledTime: "08:00",
          priority: BatchPriority.HIGH,
          responsible: ["user-1"],
          kitchenZone: KitchenZone.HOT_KITCHEN,
        };

        mockProductionService.createWorkBatch.mockResolvedValue({
          success: true,
          data: { id: "batch-1", batchNumber: "Batch 1" },
        });

        const result = await controller.createWorkBatch(mockReq, dto);

        expect(result.success).toBe(true);
        expect(mockProductionService.createWorkBatch).toHaveBeenCalledWith(
          "tenant-1",
          "user-1",
          dto,
        );
      });
    });

    describe("getWorkBatches", () => {
      it("should return all work batches", async () => {
        mockProductionService.getWorkBatches.mockResolvedValue([
          { id: "batch-1" },
          { id: "batch-2" },
        ]);

        const result = await controller.getWorkBatches(mockReq);

        expect(result).toHaveLength(2);
        expect(mockProductionService.getWorkBatches).toHaveBeenCalledWith(
          "tenant-1",
        );
      });
    });

    describe("getWorkBatchById", () => {
      it("should return a work batch by ID", async () => {
        mockProductionService.getWorkBatchById.mockResolvedValue({
          id: "batch-1",
          batchNumber: "Batch 1",
        });

        const result = await controller.getWorkBatchById(mockReq, "batch-1");

        expect(result.id).toBe("batch-1");
        expect(mockProductionService.getWorkBatchById).toHaveBeenCalledWith(
          "tenant-1",
          "batch-1",
        );
      });
    });

    describe("startWorkBatch", () => {
      it("should start a work batch", async () => {
        mockProductionService.startWorkBatch.mockResolvedValue({
          success: true,
          data: { id: "batch-1", status: "IN_PROGRESS" },
        });

        const result = await controller.startWorkBatch(mockReq, "batch-1");

        expect(result.success).toBe(true);
        expect(mockProductionService.startWorkBatch).toHaveBeenCalledWith(
          "tenant-1",
          "batch-1",
          "user-1",
        );
      });
    });

    describe("completeWorkBatch", () => {
      it("should complete a work batch", async () => {
        mockProductionService.completeWorkBatch.mockResolvedValue({
          success: true,
          data: { id: "batch-1", status: "COMPLETED" },
        });

        const result = await controller.completeWorkBatch(mockReq, "batch-1");

        expect(result.success).toBe(true);
        expect(mockProductionService.completeWorkBatch).toHaveBeenCalledWith(
          "tenant-1",
          "batch-1",
          "user-1",
        );
      });
    });
  });

  describe("Production Orders", () => {
    describe("createProductionOrder", () => {
      it("should create a production order", async () => {
        const dto = {
          batchId: "batch-1",
          recipeId: "recipe-1",
          recipeName: "Recipe 1",
          quantity: 10,
          unit: "kg",
          estimatedTime: 60,
          ingredients: [],
        };

        mockProductionService.createProductionOrder.mockResolvedValue({
          success: true,
          data: { id: "order-1" },
        });

        const result = await controller.createProductionOrder(mockReq, dto);

        expect(result.success).toBe(true);
        expect(
          mockProductionService.createProductionOrder,
        ).toHaveBeenCalledWith("tenant-1", dto);
      });
    });

    describe("getProductionOrdersByBatch", () => {
      it("should return production orders by batch ID", async () => {
        mockProductionService.getProductionOrdersByBatch.mockResolvedValue([
          { id: "order-1" },
          { id: "order-2" },
        ]);

        const result = await controller.getProductionOrdersByBatch(
          mockReq,
          "batch-1",
        );

        expect(result).toHaveLength(2);
        expect(
          mockProductionService.getProductionOrdersByBatch,
        ).toHaveBeenCalledWith("tenant-1", "batch-1");
      });
    });

    describe("startProductionOrder", () => {
      it("should start a production order", async () => {
        mockProductionService.startProductionOrder.mockResolvedValue({
          success: true,
          data: { id: "order-1", status: "IN_PROGRESS" },
        });

        const result = await controller.startProductionOrder(
          mockReq,
          "order-1",
        );

        expect(result.success).toBe(true);
        expect(mockProductionService.startProductionOrder).toHaveBeenCalledWith(
          "tenant-1",
          "order-1",
        );
      });
    });

    describe("completeProductionOrder", () => {
      it("should complete a production order with actual time", async () => {
        mockProductionService.completeProductionOrder.mockResolvedValue({
          success: true,
          data: { id: "order-1", status: "COMPLETED", actualTime: 55 },
        });

        const result = await controller.completeProductionOrder(
          mockReq,
          "order-1",
          {
            actualTime: 55,
          },
        );

        expect(result.success).toBe(true);
        expect(
          mockProductionService.completeProductionOrder,
        ).toHaveBeenCalledWith("tenant-1", "order-1", 55);
      });
    });
  });

  describe("Mise en Place", () => {
    describe("createMiseEnPlaceSheet", () => {
      it("should create a mise en place sheet", async () => {
        const dto = {
          batchId: "batch-1",
          orderId: "order-1",
          zone: KitchenZone.HOT_KITCHEN,
          checklists: [],
        } as any;

        mockProductionService.createMiseEnPlaceSheet.mockResolvedValue({
          success: true,
          data: { id: "sheet-1" },
        });

        const result = await controller.createMiseEnPlaceSheet(mockReq, dto);

        expect(result.success).toBe(true);
        expect(
          mockProductionService.createMiseEnPlaceSheet,
        ).toHaveBeenCalledWith("tenant-1", dto);
      });
    });

    describe("getMiseEnPlaceSheet", () => {
      it("should return a mise en place sheet by ID", async () => {
        mockProductionService.getMiseEnPlaceSheet.mockResolvedValue({
          id: "sheet-1",
          zone: "HOT_KITCHEN",
        });

        const result = await controller.getMiseEnPlaceSheet(mockReq, "sheet-1");

        expect(result.id).toBe("sheet-1");
        expect(mockProductionService.getMiseEnPlaceSheet).toHaveBeenCalledWith(
          "tenant-1",
          "sheet-1",
        );
      });
    });

    describe("addMiseEnPlaceItem", () => {
      it("should add a mise en place item", async () => {
        const dto = {
          orderId: "order-1",
          description: "Item 1",
          quantity: 5,
          unit: "kg",
        };

        mockProductionService.addMiseEnPlaceItem.mockResolvedValue({
          success: true,
          data: { id: "item-1" },
        });

        const result = await controller.addMiseEnPlaceItem(mockReq, dto);

        expect(result.success).toBe(true);
        expect(mockProductionService.addMiseEnPlaceItem).toHaveBeenCalledWith(
          "tenant-1",
          dto,
        );
      });
    });

    describe("updateMiseEnPlaceItem", () => {
      it("should update a mise en place item status", async () => {
        mockProductionService.updateMiseEnPlaceItem.mockResolvedValue({
          success: true,
          data: { id: "item-1", status: "READY" },
        });

        const result = await controller.updateMiseEnPlaceItem(
          mockReq,
          "item-1",
          { status: "READY" },
        );

        expect(result.success).toBe(true);
        expect(
          mockProductionService.updateMiseEnPlaceItem,
        ).toHaveBeenCalledWith("tenant-1", "item-1", "READY", "user-1");
      });
    });

    describe("verifyMiseEnPlaceSheet", () => {
      it("should verify a mise en place sheet", async () => {
        mockProductionService.verifyMiseEnPlaceSheet.mockResolvedValue({
          success: true,
          data: { id: "sheet-1", verifiedBy: "user-1" },
        });

        const result = await controller.verifyMiseEnPlaceSheet(
          mockReq,
          "sheet-1",
        );

        expect(result.success).toBe(true);
        expect(
          mockProductionService.verifyMiseEnPlaceSheet,
        ).toHaveBeenCalledWith("tenant-1", "sheet-1", "user-1");
      });
    });
  });

  describe("Task Assignments", () => {
    describe("createTaskAssignment", () => {
      it("should create a task assignment", async () => {
        const dto = {
          batchId: "batch-1",
          orderId: "order-1",
          taskId: "task-1",
          assignedTo: "staff-1",
          taskType: TaskType.PREPARATION,
          estimatedTime: 30,
        } as any;

        mockProductionService.createTaskAssignment.mockResolvedValue({
          success: true,
          data: { id: "assignment-1" },
        });

        const result = await controller.createTaskAssignment(mockReq, dto);

        expect(result.success).toBe(true);
        expect(mockProductionService.createTaskAssignment).toHaveBeenCalledWith(
          "tenant-1",
          dto,
        );
      });
    });

    describe("getTaskAssignments", () => {
      it("should return all task assignments", async () => {
        mockProductionService.getTaskAssignments.mockResolvedValue([
          { id: "assignment-1" },
          { id: "assignment-2" },
        ]);

        const result = await controller.getTaskAssignments(mockReq);

        expect(result).toHaveLength(2);
        expect(mockProductionService.getTaskAssignments).toHaveBeenCalledWith(
          "tenant-1",
        );
      });
    });

    describe("updateTaskAssignment", () => {
      it("should update a task assignment", async () => {
        const dto = { status: TaskStatus.COMPLETED } as any;

        mockProductionService.updateTaskAssignment.mockResolvedValue({
          success: true,
          data: { id: "assignment-1", status: TaskStatus.COMPLETED },
        });

        const result = await controller.updateTaskAssignment(
          mockReq,
          "assignment-1",
          dto,
        );

        expect(result.success).toBe(true);
        expect(mockProductionService.updateTaskAssignment).toHaveBeenCalledWith(
          "tenant-1",
          "assignment-1",
          dto,
        );
      });
    });

    describe("getStaffAvailable", () => {
      it("should return available staff", async () => {
        mockProductionService.getStaffAvailable.mockResolvedValue([
          { id: "staff-1", name: "Staff 1" },
        ]);

        const result = await controller.getStaffAvailable(mockReq);

        expect(result).toHaveLength(1);
        expect(mockProductionService.getStaffAvailable).toHaveBeenCalledWith(
          "tenant-1",
          undefined,
        );
      });

      it("should filter staff by zone", async () => {
        mockProductionService.getStaffAvailable.mockResolvedValue([]);

        await controller.getStaffAvailable(mockReq, "HOT_KITCHEN");

        expect(mockProductionService.getStaffAvailable).toHaveBeenCalledWith(
          "tenant-1",
          "HOT_KITCHEN",
        );
      });
    });

    describe("getStaffMemberTasks", () => {
      it("should return tasks for a staff member", async () => {
        mockProductionService.getStaffMemberTasks.mockResolvedValue([
          { id: "task-1" },
        ]);

        const result = await controller.getStaffMemberTasks(mockReq, "staff-1");

        expect(result).toHaveLength(1);
        expect(mockProductionService.getStaffMemberTasks).toHaveBeenCalledWith(
          "tenant-1",
          "staff-1",
        );
      });
    });
  });

  describe("Progress Tracking", () => {
    describe("getProgressTracking", () => {
      it("should return progress tracking for an order", async () => {
        mockProductionService.getProgressTracking.mockResolvedValue({
          id: "tracking-1",
          overallProgress: 50,
        });

        const result = await controller.getProgressTracking(mockReq, "order-1");

        expect(result.overallProgress).toBe(50);
        expect(mockProductionService.getProgressTracking).toHaveBeenCalledWith(
          "tenant-1",
          "order-1",
        );
      });
    });

    describe("getActiveAlerts", () => {
      it("should return active alerts", async () => {
        mockProductionService.getActiveAlerts.mockResolvedValue([
          { id: "alert-1", type: "DELAY" },
        ]);

        const result = await controller.getActiveAlerts(mockReq);

        expect(result).toHaveLength(1);
        expect(mockProductionService.getActiveAlerts).toHaveBeenCalledWith(
          "tenant-1",
        );
      });
    });

    describe("resolveAlert", () => {
      it("should resolve an alert", async () => {
        const dto = { resolvedBy: "user-1", resolution: "Fixed" };

        mockProductionService.resolveAlert.mockResolvedValue({
          success: true,
          data: { id: "alert-1", resolvedAt: new Date() },
        });

        const result = await controller.resolveAlert(mockReq, "alert-1", dto);

        expect(result.success).toBe(true);
        expect(mockProductionService.resolveAlert).toHaveBeenCalledWith(
          "tenant-1",
          "alert-1",
          dto,
        );
      });
    });
  });

  describe("Reports", () => {
    describe("generateProductionReport", () => {
      it("should generate a production report", async () => {
        const dto = {
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-05"),
        };

        mockProductionService.generateProductionReport.mockResolvedValue({
          success: true,
          data: { kpis: {} },
        });

        const result = await controller.generateProductionReport(mockReq, dto);

        expect(result.success).toBe(true);
        expect(
          mockProductionService.generateProductionReport,
        ).toHaveBeenCalledWith("tenant-1", dto);
      });
    });
  });
});
