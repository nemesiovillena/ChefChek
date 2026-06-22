import { Test, TestingModule } from "@nestjs/testing";
import { AppccController } from "./appcc.controller";
import { AppccService } from "./appcc.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("AppccController", () => {
  let controller: AppccController;
  let service: AppccService;

  const mockService = {
    createTemperatureControl: jest.fn(),
    recordTemperature: jest.fn(),
    getTemperatureControls: jest.fn(),
    getTemperatureMeasurements: jest.fn(),
    createCleaningPlan: jest.fn(),
    addCleaningTask: jest.fn(),
    completeCleaningTask: jest.fn(),
    getCleaningPlans: jest.fn(),
    createPestControl: jest.fn(),
    getPestControls: jest.fn(),
    createGoodsReception: jest.fn(),
    getGoodsReceptions: jest.fn(),
    createAlert: jest.fn(),
    updateAlert: jest.fn(),
    getAlerts: jest.fn(),
    generateComplianceReport: jest.fn(),
    getComplianceHistory: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-1",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppccController],
      providers: [{ provide: AppccService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppccController>(AppccController);
    service = module.get<AppccService>(AppccService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createTemperatureControl", () => {
    it("should create temperature control and return result", async () => {
      const dto = {
        type: "CAMERA" as const,
        location: "Main Kitchen",
        targetTemperature: 4,
        tolerance: 2,
        unit: "CELSIUS" as const,
      } as any;

      mockService.createTemperatureControl.mockResolvedValue({
        success: true,
        data: { id: "control-1", ...dto },
      });

      const result = await controller.createTemperatureControl(mockReq, dto);

      expect(mockService.createTemperatureControl).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
      expect(result.data.location).toBe("Main Kitchen");
    });
  });

  describe("recordTemperature", () => {
    it("should record temperature measurement", async () => {
      const dto = {
        temperature: 4.5,
        notes: "Within range",
      };

      mockService.recordTemperature.mockResolvedValue({
        success: true,
        data: { id: "measurement-1", temperature: 4.5, withinRange: true },
      });

      const result = await controller.recordTemperature(
        mockReq,
        "control-1",
        dto,
      );

      expect(mockService.recordTemperature).toHaveBeenCalledWith(
        "tenant-1",
        "control-1",
        dto,
        "user-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getTemperatureControls", () => {
    it("should return temperature controls", async () => {
      const controls = [
        { id: "control-1", location: "Kitchen" },
        { id: "control-2", location: "Storage" },
      ];

      mockService.getTemperatureControls.mockResolvedValue(controls);

      const result = await controller.getTemperatureControls(mockReq);

      expect(mockService.getTemperatureControls).toHaveBeenCalledWith(
        "tenant-1",
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("getTemperatureMeasurements", () => {
    it("should return temperature measurements for a control", async () => {
      const measurements = [
        { id: "m-1", temperature: 4.5 },
        { id: "m-2", temperature: 4.8 },
      ];

      mockService.getTemperatureMeasurements.mockResolvedValue(measurements);

      const result = await controller.getTemperatureMeasurements(
        mockReq,
        "control-1",
      );

      expect(mockService.getTemperatureMeasurements).toHaveBeenCalledWith(
        "tenant-1",
        "control-1",
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("createCleaningPlan", () => {
    it("should create cleaning plan and return result", async () => {
      const dto = {
        name: "Daily Kitchen Cleaning",
        frequency: "DAILY" as const,
        description: "Daily cleaning routine",
      } as any;

      mockService.createCleaningPlan.mockResolvedValue({
        success: true,
        data: { id: "plan-1", ...dto },
      });

      const result = await controller.createCleaningPlan(mockReq, dto);

      expect(mockService.createCleaningPlan).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("addCleaningTask", () => {
    it("should add cleaning task to plan", async () => {
      const dto = {
        area: "Kitchen Counter",
        description: "Clean and sanitize counters",
      };

      mockService.addCleaningTask.mockResolvedValue({
        success: true,
        data: { id: "task-1", ...dto },
      });

      const result = await controller.addCleaningTask(mockReq, "plan-1", dto);

      expect(mockService.addCleaningTask).toHaveBeenCalledWith(
        "tenant-1",
        "plan-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("completeCleaningTask", () => {
    it("should complete cleaning task", async () => {
      const dto = {
        verifiedBy: "user-2",
        notes: "Completed successfully",
      };

      mockService.completeCleaningTask.mockResolvedValue({
        success: true,
        data: { id: "task-1", completed: true },
      });

      const result = await controller.completeCleaningTask(
        mockReq,
        "task-1",
        dto,
      );

      expect(mockService.completeCleaningTask).toHaveBeenCalledWith(
        "tenant-1",
        "task-1",
        dto,
        "user-1",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getCleaningPlans", () => {
    it("should return cleaning plans", async () => {
      const plans = [
        { id: "plan-1", name: "Daily Cleaning" },
        { id: "plan-2", name: "Weekly Cleaning" },
      ];

      mockService.getCleaningPlans.mockResolvedValue(plans);

      const result = await controller.getCleaningPlans(mockReq);

      expect(mockService.getCleaningPlans).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("createPestControl", () => {
    it("should create pest control record", async () => {
      const dto = {
        company: "PestControl Inc",
        type: "INSECTS" as const,
        date: new Date("2024-01-15"),
        nextDate: new Date("2024-02-15"),
        products: ["Product A"],
        affectedAreas: ["Kitchen", "Storage"],
        responsible: "John Doe",
      } as any;

      mockService.createPestControl.mockResolvedValue({
        success: true,
        data: { id: "pest-1", ...dto },
      });

      const result = await controller.createPestControl(mockReq, dto);

      expect(mockService.createPestControl).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getPestControls", () => {
    it("should return pest control records", async () => {
      const records = [
        { id: "pest-1", type: "INSECTS" },
        { id: "pest-2", type: "RODENTS" },
      ];

      mockService.getPestControls.mockResolvedValue(records);

      const result = await controller.getPestControls(mockReq);

      expect(mockService.getPestControls).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("createGoodsReception", () => {
    it("should create goods reception record", async () => {
      const dto = {
        supplierId: "supplier-1",
        temperatureOnReception: 4,
        acceptableTemperature: 5,
        lot: "LOT-123",
        expiryDate: new Date("2024-12-31"),
        deliveryNote: "DN-001",
        products: [
          { productId: "prod-1", quantity: 10, unit: "kg", temperature: 4 },
        ],
        signedBy: "John",
        verifiedBy: "Jane",
      };

      mockService.createGoodsReception.mockResolvedValue({
        success: true,
        data: { id: "reception-1" },
        rejectedProducts: [],
      });

      const result = await controller.createGoodsReception(mockReq, dto);

      expect(mockService.createGoodsReception).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getGoodsReceptions", () => {
    it("should return goods reception records", async () => {
      const receptions = [{ id: "reception-1", supplierId: "supplier-1" }];

      mockService.getGoodsReceptions.mockResolvedValue(receptions);

      const result = await controller.getGoodsReceptions(mockReq);

      expect(mockService.getGoodsReceptions).toHaveBeenCalledWith("tenant-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("createAlert", () => {
    it("should create alert and return result", async () => {
      const dto = {
        severity: "HIGH" as const,
        type: "TEMPERATURE" as const,
        title: "Temperature Alert",
        message: "Temperature out of range",
      } as any;

      mockService.createAlert.mockResolvedValue({
        success: true,
        data: { id: "alert-1", ...dto },
      });

      const result = await controller.createAlert(mockReq, dto);

      expect(mockService.createAlert).toHaveBeenCalledWith("tenant-1", dto);
      expect(result.success).toBe(true);
    });
  });

  describe("updateAlert", () => {
    it("should update alert and return result", async () => {
      const dto = {
        status: "RESOLVED" as const,
        resolution: "Fixed the issue",
      };

      mockService.updateAlert.mockResolvedValue({
        success: true,
        data: { id: "alert-1", status: "RESOLVED" },
      });

      const result = await controller.updateAlert(mockReq, "alert-1", dto);

      expect(mockService.updateAlert).toHaveBeenCalledWith(
        "tenant-1",
        "alert-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getAlerts", () => {
    it("should return alerts without filters", async () => {
      const alerts = [
        { id: "alert-1", type: "TEMPERATURE" },
        { id: "alert-2", type: "CLEANING" },
      ];

      mockService.getAlerts.mockResolvedValue(alerts);

      const result = await controller.getAlerts(mockReq);

      expect(mockService.getAlerts).toHaveBeenCalledWith("tenant-1", {
        type: undefined,
        severity: undefined,
        status: undefined,
      });
      expect(result).toHaveLength(2);
    });

    it("should pass filters to service", async () => {
      mockService.getAlerts.mockResolvedValue([]);

      await controller.getAlerts(mockReq, "TEMPERATURE", "HIGH", "OPEN");

      expect(mockService.getAlerts).toHaveBeenCalledWith("tenant-1", {
        type: "TEMPERATURE",
        severity: "HIGH",
        status: "OPEN",
      });
    });
  });

  describe("generateComplianceReport", () => {
    it("should generate compliance report", async () => {
      const dto = {
        period: "MONTHLY" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
      };

      mockService.generateComplianceReport.mockResolvedValue({
        success: true,
        data: {
          period: "MONTHLY",
          kpis: { temperatureCompliance: 95 },
          recommendations: [],
        },
      });

      const result = await controller.generateComplianceReport(mockReq, dto);

      expect(mockService.generateComplianceReport).toHaveBeenCalledWith(
        "tenant-1",
        dto,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("getComplianceHistory", () => {
    it("should return compliance history with default days", async () => {
      const history = [{ id: "report-1", generatedAt: new Date() }];

      mockService.getComplianceHistory.mockResolvedValue(history);

      const result = await controller.getComplianceHistory(mockReq);

      expect(mockService.getComplianceHistory).toHaveBeenCalledWith(
        "tenant-1",
        30,
      );
      expect(result).toHaveLength(1);
    });

    it("should return compliance history with custom days", async () => {
      mockService.getComplianceHistory.mockResolvedValue([]);

      await controller.getComplianceHistory(mockReq, "60");

      expect(mockService.getComplianceHistory).toHaveBeenCalledWith(
        "tenant-1",
        60,
      );
    });
  });
});
