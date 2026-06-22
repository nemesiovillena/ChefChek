import { Test, TestingModule } from "@nestjs/testing";
import { AppccService } from "./appcc.service";
import { PrismaService } from "../../common/services/prisma.service";
import { NotFoundException } from "@nestjs/common";
import {
  ControlType,
  CleaningFrequency,
  PestType,
  AlertSeverity,
} from "./dto/appcc.dto";

describe("AppccService", () => {
  let service: AppccService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      temperatureControl: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      temperatureMeasurement: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      cleaningPlan: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      cleaningTask: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      pestControl: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      goodsReception: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      alert: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      alertNotification: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppccService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AppccService>(AppccService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createTemperatureControl", () => {
    it("should create temperature control successfully", async () => {
      const tenantId = "tenant-123";
      const userId = "user-1";
      const dto = {
        type: ControlType.CAMERA,
        location: "Main Kitchen",
        targetTemperature: 4,
        tolerance: 2,
        unit: "CELSIUS" as any,
        description: "Walk-in refrigerator",
        responsible: "John Doe",
      };

      const mockControl = {
        id: "control-1",
        tenantId,
        ...dto,
        createdBy: userId,
        createdAt: new Date(),
      };

      mockPrismaService.temperatureControl.create.mockResolvedValue(
        mockControl,
      );

      const result = await service.createTemperatureControl(
        tenantId,
        userId,
        dto,
      );

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("CAMERA");
      expect(result.data.location).toBe("Main Kitchen");
      expect(result.data.targetTemperature).toBe(4);
      expect(mockPrismaService.temperatureControl.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          ...dto,
          createdBy: userId,
        },
      });
    });
  });

  describe("recordTemperature", () => {
    it("should record temperature measurement successfully", async () => {
      const tenantId = "tenant-123";
      const controlId = "control-1";
      const userId = "user-1";
      const dto = {
        temperature: 5,
        notes: "Morning check",
      };

      const mockControl = {
        id: controlId,
        tenantId,
        targetTemperature: 4,
        tolerance: 2,
        unit: "CELSIUS",
      };

      const mockMeasurement = {
        id: "measurement-1",
        controlId,
        temperature: 5,
        withinRange: true,
        recordedAt: new Date(),
        recordedBy: userId,
        notes: "Morning check",
      };

      mockPrismaService.temperatureControl.findFirst.mockResolvedValue(
        mockControl,
      );
      mockPrismaService.temperatureMeasurement.create.mockResolvedValue(
        mockMeasurement,
      );

      const result = await service.recordTemperature(
        tenantId,
        controlId,
        dto,
        userId,
      );

      expect(result.success).toBe(true);
      expect(result.data.temperature).toBe(5);
      expect(result.data.withinRange).toBe(true);
    });

    it("should create alert when temperature is out of range", async () => {
      const tenantId = "tenant-123";
      const controlId = "control-1";
      const userId = "user-1";
      const dto = {
        temperature: 10,
        notes: "Temperature too high",
      };

      const mockControl = {
        id: controlId,
        tenantId,
        targetTemperature: 4,
        tolerance: 2,
        unit: "CELSIUS",
      };

      const mockMeasurement = {
        id: "measurement-1",
        controlId,
        temperature: 10,
        withinRange: false,
        recordedAt: new Date(),
        recordedBy: userId,
        notes: "Temperature too high",
      };

      mockPrismaService.temperatureControl.findFirst.mockResolvedValue(
        mockControl,
      );
      mockPrismaService.temperatureMeasurement.create.mockResolvedValue(
        mockMeasurement,
      );
      mockPrismaService.temperatureControl.findUnique.mockResolvedValue(
        mockControl,
      );
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      const result = await service.recordTemperature(
        tenantId,
        controlId,
        dto,
        userId,
      );

      expect(result.success).toBe(true);
      expect(result.data.withinRange).toBe(false);
      expect(mockPrismaService.alert.create).toHaveBeenCalled();
    });

    it("should throw NotFoundException if control not found", async () => {
      mockPrismaService.temperatureControl.findFirst.mockResolvedValue(null);

      await expect(
        service.recordTemperature(
          "tenant-123",
          "invalid-id",
          { temperature: 5 },
          "user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getTemperatureControls", () => {
    it("should return temperature controls for tenant", async () => {
      const tenantId = "tenant-123";

      const mockControls = [
        {
          id: "control-1",
          tenantId,
          type: "CAMERA",
          location: "Main Kitchen",
          targetTemperature: 4,
        },
        {
          id: "control-2",
          tenantId,
          type: "EQUIPMENT",
          location: "Service Area",
          targetTemperature: 60,
        },
      ];

      mockPrismaService.temperatureControl.findMany.mockResolvedValue(
        mockControls,
      );

      const result = await service.getTemperatureControls(tenantId);

      expect(result.length).toBe(2);
      expect(
        mockPrismaService.temperatureControl.findMany,
      ).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getTemperatureMeasurements", () => {
    it("should return temperature measurements for control", async () => {
      const tenantId = "tenant-123";
      const controlId = "control-1";

      const mockMeasurements = [
        {
          id: "measurement-1",
          controlId,
          temperature: 4.5,
          withinRange: true,
          recordedAt: new Date(),
        },
        {
          id: "measurement-2",
          controlId,
          temperature: 5,
          withinRange: true,
          recordedAt: new Date(),
        },
      ];

      mockPrismaService.temperatureControl.findFirst.mockResolvedValue({
        id: controlId,
        tenantId,
      });
      mockPrismaService.temperatureMeasurement.findMany.mockResolvedValue(
        mockMeasurements,
      );

      const result = await service.getTemperatureMeasurements(
        tenantId,
        controlId,
      );

      expect(result.length).toBe(2);
    });

    it("should throw NotFoundException if control not found", async () => {
      mockPrismaService.temperatureControl.findFirst.mockResolvedValue(null);

      await expect(
        service.getTemperatureMeasurements("tenant-123", "invalid-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createCleaningPlan", () => {
    it("should create cleaning plan successfully", async () => {
      const tenantId = "tenant-123";
      const userId = "user-1";
      const dto = {
        name: "Daily Kitchen Cleaning",
        frequency: CleaningFrequency.DAILY,
        description: "Complete kitchen sanitization",
        responsible: ["John", "Jane"],
        durationMinutes: 45,
      };

      const mockPlan = {
        id: "plan-1",
        tenantId,
        ...dto,
        createdBy: userId,
        createdAt: new Date(),
      };

      mockPrismaService.cleaningPlan.create.mockResolvedValue(mockPlan);

      const result = await service.createCleaningPlan(tenantId, userId, dto);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Daily Kitchen Cleaning");
      expect(result.data.frequency).toBe("DAILY");
    });
  });

  describe("addCleaningTask", () => {
    it("should add cleaning task to plan successfully", async () => {
      const tenantId = "tenant-123";
      const planId = "plan-1";
      const dto = {
        area: "Prep Station",
        description: "Sanitize all surfaces",
        products: ["Bleach", "Detergent"],
        estimatedTime: 15,
        responsible: ["John"],
      };

      mockPrismaService.cleaningPlan.findFirst.mockResolvedValue({
        id: planId,
        tenantId,
      });

      const mockTask = {
        id: "task-1",
        planId,
        ...dto,
        completed: false,
        createdAt: new Date(),
      };

      mockPrismaService.cleaningTask.create.mockResolvedValue(mockTask);

      const result = await service.addCleaningTask(tenantId, planId, dto);

      expect(result.success).toBe(true);
      expect(result.data.area).toBe("Prep Station");
      expect(result.data.completed).toBe(false);
    });

    it("should throw NotFoundException if plan not found", async () => {
      mockPrismaService.cleaningPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.addCleaningTask("tenant-123", "invalid-id", {
          area: "Test",
          description: "Test",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("completeCleaningTask", () => {
    it("should complete cleaning task successfully", async () => {
      const tenantId = "tenant-123";
      const taskId = "task-1";
      const userId = "user-1";
      const dto = {
        verifiedBy: "supervisor-1",
        notes: "Task completed successfully",
      };

      mockPrismaService.cleaningTask.findFirst.mockResolvedValue({
        id: taskId,
        plan: { tenantId },
      });

      const mockUpdatedTask = {
        id: taskId,
        completed: true,
        completedAt: new Date(),
        verifiedBy: "supervisor-1",
        notes: "Task completed successfully",
      };

      mockPrismaService.cleaningTask.update.mockResolvedValue(mockUpdatedTask);

      const result = await service.completeCleaningTask(
        tenantId,
        taskId,
        dto,
        userId,
      );

      expect(result.success).toBe(true);
      expect(result.data.completed).toBe(true);
      expect(result.data.verifiedBy).toBe("supervisor-1");
    });

    it("should throw NotFoundException if task not found", async () => {
      mockPrismaService.cleaningTask.findFirst.mockResolvedValue(null);

      await expect(
        service.completeCleaningTask("tenant-123", "invalid-id", {}, "user-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getCleaningPlans", () => {
    it("should return cleaning plans with tasks", async () => {
      const tenantId = "tenant-123";

      const mockPlans = [
        {
          id: "plan-1",
          tenantId,
          name: "Daily Cleaning",
          frequency: "DAILY",
          tasks: [
            { id: "task-1", area: "Kitchen", completed: true },
            { id: "task-2", area: "Storage", completed: false },
          ],
        },
      ];

      mockPrismaService.cleaningPlan.findMany.mockResolvedValue(mockPlans);

      const result = await service.getCleaningPlans(tenantId);

      expect(result.length).toBe(1);
      expect(result[0].tasks.length).toBe(2);
      expect(mockPrismaService.cleaningPlan.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          tasks: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("createPestControl", () => {
    it("should create pest control record successfully", async () => {
      const tenantId = "tenant-123";
      const dto = {
        company: "PestAway Inc",
        type: PestType.INSECTS,
        date: new Date(),
        nextDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        products: ["Insecticide A", "Insecticide B"],
        affectedAreas: ["Kitchen", "Storage"],
        responsible: "John Doe",
        notes: "Quarterly inspection",
      };

      const mockPestControl = {
        id: "pest-1",
        tenantId,
        empresa: dto.company,
        type: dto.type,
        date: dto.date,
        nextDate: dto.nextDate,
        products: dto.products,
        area: dto.affectedAreas[0],
        notes: dto.notes,
        createdBy: "system",
      };

      mockPrismaService.pestControl.create.mockResolvedValue(mockPestControl);

      const result = await service.createPestControl(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.data.empresa).toBe("PestAway Inc");
      expect(result.data.type).toBe("INSECTS");
    });
  });

  describe("getPestControls", () => {
    it("should return pest control records", async () => {
      const tenantId = "tenant-123";

      const mockPestControls = [
        {
          id: "pest-1",
          tenantId,
          empresa: "PestAway Inc",
          type: "INSECTS",
          date: new Date(),
        },
        {
          id: "pest-2",
          tenantId,
          empresa: "RodentControl Ltd",
          type: "RATS",
          date: new Date(),
        },
      ];

      mockPrismaService.pestControl.findMany.mockResolvedValue(
        mockPestControls,
      );

      const result = await service.getPestControls(tenantId);

      expect(result.length).toBe(2);
      expect(mockPrismaService.pestControl.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { date: "desc" },
      });
    });
  });

  describe("createGoodsReception", () => {
    it("should create goods reception record successfully", async () => {
      const tenantId = "tenant-123";
      const dto = {
        supplierId: "supplier-1",
        temperatureOnReception: 4,
        acceptableTemperature: 5,
        lot: "LOT-2024-001",
        expiryDate: new Date(),
        deliveryNote: "DN-12345",
        products: [
          {
            productId: "product-1",
            quantity: 50,
            unit: "kg",
            temperature: 4,
          },
        ],
        signedBy: "John Doe",
        verifiedBy: "Jane Smith",
        observations: "All products in good condition",
      };

      const mockReception = {
        id: "reception-1",
        tenantId,
        proveedorId: dto.supplierId,
        items: dto.products,
        albaran: dto.deliveryNote,
        observaciones: dto.observations,
      };

      mockPrismaService.goodsReception.create.mockResolvedValue(mockReception);

      const result = await service.createGoodsReception(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.data.proveedorId).toBe("supplier-1");
    });

    it("should identify rejected products with temperature issues", async () => {
      const tenantId = "tenant-123";
      const dto = {
        supplierId: "supplier-1",
        temperatureOnReception: 4,
        acceptableTemperature: 5,
        lot: "LOT-2024-001",
        expiryDate: new Date(),
        deliveryNote: "DN-12345",
        products: [
          {
            productId: "product-1",
            quantity: 50,
            unit: "kg",
            temperature: 4,
          },
          {
            productId: "product-2",
            quantity: 30,
            unit: "kg",
            temperature: 10,
          },
        ],
        signedBy: "John Doe",
        verifiedBy: "Jane Smith",
      };

      const mockReception = {
        id: "reception-1",
        tenantId,
        proveedorId: dto.supplierId,
        items: dto.products,
      };

      mockPrismaService.goodsReception.create.mockResolvedValue(mockReception);
      mockPrismaService.goodsReception.findUnique.mockResolvedValue(
        mockReception,
      );
      mockPrismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      const result = await service.createGoodsReception(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.rejectedProducts).toContain("product-2");
    });
  });

  describe("createAlert", () => {
    it("should create alert successfully", async () => {
      const tenantId = "tenant-123";
      const dto = {
        severity: AlertSeverity.HIGH,
        type: "TEMPERATURE" as const,
        title: "Temperature Alert",
        message: "Temperature exceeded threshold",
        entityId: "control-1",
      };

      const mockAlert = {
        id: "alert-1",
        tenantId,
        type: "TEMPERATURE",
        alertType: "TEMPERATURE",
        severity: "HIGH",
        message: "Temperature exceeded threshold",
        isResolved: false,
      };

      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.createAlert(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("TEMPERATURE");
      expect(result.data.severity).toBe("HIGH");
    });

    it("should create notifications for assignees", async () => {
      const tenantId = "tenant-123";
      const dto = {
        severity: AlertSeverity.CRITICAL,
        type: "APPCC" as const,
        title: "Critical Alert",
        message: "Immediate attention required",
        assignees: ["user-1", "user-2"],
      };

      const mockAlert = {
        id: "alert-1",
        tenantId,
        type: "APPCC",
        severity: "CRITICAL",
        message: "Immediate attention required",
      };

      mockPrismaService.alert.create.mockResolvedValue(mockAlert);
      mockPrismaService.alertNotification.create.mockResolvedValue({});

      const result = await service.createAlert(tenantId, dto);

      expect(result.success).toBe(true);
      expect(mockPrismaService.alertNotification.create).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  describe("updateAlert", () => {
    it("should update alert successfully", async () => {
      const tenantId = "tenant-123";
      const alertId = "alert-1";
      const dto = {
        status: "RESOLVED" as const,
        resolution: "Issue fixed",
        resolvedBy: "user-1",
      };

      mockPrismaService.alert.findFirst.mockResolvedValue({
        id: alertId,
        tenantId,
      });

      const mockUpdatedAlert = {
        id: alertId,
        status: "RESOLVED",
        resolution: "Issue fixed",
        resolvedBy: "user-1",
        updatedAt: new Date(),
      };

      mockPrismaService.alert.update.mockResolvedValue(mockUpdatedAlert);

      const result = await service.updateAlert(tenantId, alertId, dto);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("RESOLVED");
    });

    it("should throw NotFoundException if alert not found", async () => {
      mockPrismaService.alert.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAlert("tenant-123", "invalid-id", { status: "RESOLVED" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getAlerts", () => {
    it("should return alerts with filters", async () => {
      const tenantId = "tenant-123";
      const filters = {
        type: "TEMPERATURE",
        severity: "HIGH",
      };

      const mockAlerts = [
        {
          id: "alert-1",
          tenantId,
          type: "TEMPERATURE",
          severity: "HIGH",
          message: "Temperature issue",
        },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getAlerts(tenantId, filters);

      expect(result.length).toBe(1);
      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          type: "TEMPERATURE",
          severity: "HIGH",
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return all alerts without filters", async () => {
      const tenantId = "tenant-123";

      const mockAlerts = [
        { id: "alert-1", tenantId, type: "TEMPERATURE" },
        { id: "alert-2", tenantId, type: "CLEANING" },
      ];

      mockPrismaService.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getAlerts(tenantId);

      expect(result.length).toBe(2);
    });
  });

  describe("generateComplianceReport", () => {
    it("should generate compliance report", async () => {
      const tenantId = "tenant-123";
      const dto = {
        period: "WEEKLY" as const,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        controlTypes: ["TEMPERATURE", "CLEANING"],
      };

      mockPrismaService.temperatureMeasurement.findMany.mockResolvedValue([
        { withinRange: true },
        { withinRange: true },
        { withinRange: false },
      ]);

      mockPrismaService.cleaningTask.findMany.mockResolvedValue([
        { completed: true },
        { completed: true },
      ]);

      mockPrismaService.pestControl.findMany.mockResolvedValue([]);
      mockPrismaService.goodsReception.findMany.mockResolvedValue([]);
      mockPrismaService.alert.findMany.mockResolvedValue([]);

      const result = await service.generateComplianceReport(tenantId, dto);

      expect(result.success).toBe(true);
      expect(result.data.period).toBe("WEEKLY");
      expect(result.data.kpis).toBeDefined();
      expect(result.data.recommendations).toBeDefined();
    });
  });
});
