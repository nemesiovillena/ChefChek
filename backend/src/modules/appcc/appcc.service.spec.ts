import { Test, TestingModule } from "@nestjs/testing";
import { AppccService } from "./appcc.service";
import { PrismaService } from "../../common/services/prisma.service";
import { NotFoundException } from "@nestjs/common";

describe("AppccService", () => {
  let service: AppccService;
  let prismaService: any;

  const mockPrismaService = {
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
      update: jest.fn(),
    },
    cleaningTask: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    pestControl: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    goodsReception: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    alert: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppccService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AppccService>(AppccService);
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create temperature control", async () => {
    const dto = { location: "Kitchen", targetTemperature: 4, tolerance: 2 };
    prismaService.temperatureControl.create.mockResolvedValue({
      id: "c-1",
      ...dto,
    });

    const result = await service.createTemperatureControl(
      "t-1",
      "u-1",
      dto as any,
    );
    expect(result.success).toBe(true);
    expect(result.data.location).toBe("Kitchen");
  });

  it("should record temperature", async () => {
    prismaService.temperatureControl.findFirst.mockResolvedValue({
      id: "c-1",
      tenantId: "t-1",
      targetTemperature: 4,
      tolerance: 2,
    });
    prismaService.temperatureControl.findUnique.mockResolvedValue({
      id: "c-1",
      tenantId: "t-1",
      targetTemperature: 4,
      tolerance: 2,
    });
    prismaService.temperatureMeasurement.create.mockResolvedValue({
      id: "m-1",
      temperature: 5,
    });

    const result = await service.recordTemperature(
      "t-1",
      "c-1",
      { temperature: 5 },
      "u-1",
    );
    expect(result.success).toBe(true);
  });

  it("should throw NotFoundException on record temp if control missing", async () => {
    prismaService.temperatureControl.findFirst.mockResolvedValue(null);
    await expect(
      service.recordTemperature("t-1", "missing", { temperature: 5 }, "u-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should get temperature controls", async () => {
    prismaService.temperatureControl.findMany.mockResolvedValue([
      { id: "c-1" },
    ]);
    const result = await service.getTemperatureControls("t-1");
    expect(result).toHaveLength(1);
  });

  it("should create cleaning plan", async () => {
    const dto = { name: "Daily", frequency: "DAILY" };
    prismaService.cleaningPlan.create.mockResolvedValue({ id: "p-1", ...dto });

    const result = await service.createCleaningPlan("t-1", "u-1", dto as any);
    expect(result.success).toBe(true);
  });

  it("should add cleaning task", async () => {
    prismaService.cleaningPlan.findFirst.mockResolvedValue({ id: "p-1" });
    prismaService.cleaningTask.create.mockResolvedValue({ id: "tk-1" });

    const result = await service.addCleaningTask("t-1", "p-1", {
      area: "Counter",
      description: "Clean",
    });
    expect(result.success).toBe(true);
  });

  it("should complete cleaning task", async () => {
    prismaService.cleaningTask.findFirst.mockResolvedValue({
      id: "tk-1",
      cleaningPlan: { tenantId: "t-1" },
    });
    prismaService.cleaningTask.update.mockResolvedValue({
      id: "tk-1",
      completed: true,
    });

    const result = await service.completeCleaningTask(
      "t-1",
      "tk-1",
      { notes: "done" },
      "u-1",
    );
    expect(result.success).toBe(true);
  });

  it("should create pest control record", async () => {
    const dto = {
      company: "PestCo",
      type: "INSECTS",
      date: new Date(),
      nextDate: new Date(),
      products: [],
      affectedAreas: [],
      responsible: "Chef",
    };
    prismaService.pestControl.create.mockResolvedValue({ id: "pc-1" });

    const result = await service.createPestControl("t-1", dto as any);
    expect(result.success).toBe(true);
  });

  it("should create goods reception", async () => {
    const dto = {
      supplierId: "s-1",
      temperatureOnReception: 4,
      acceptableTemperature: 5,
      lot: "L1",
      expiryDate: new Date(),
      deliveryNote: "N1",
      products: [],
      signedBy: "Me",
      verifiedBy: "You",
    };
    prismaService.goodsReception.create.mockResolvedValue({ id: "gr-1" });

    const result = await service.createGoodsReception("t-1", dto);
    expect(result.success).toBe(true);
  });

  describe("checkCleaningPlanReminders (private method)", () => {
    it("should create alert if cleaning plan is due today and has pending tasks", async () => {
      const tenantId = "tenant-1";
      const plan = {
        id: "plan-1",
        tenantId,
        frequency: "DAILY",
        lastExecutionAt: new Date(new Date().setDate(new Date().getDate() - 1)), // ayer
        createdAt: new Date(),
        tasks: [{ id: "task-1", completed: false }],
      };

      prismaService.cleaningPlan.findMany.mockResolvedValue([plan]);
      prismaService.alert.create.mockResolvedValue({ id: "alert-1" });

      await (service as any).checkCleaningPlanReminders(tenantId);

      expect(prismaService.cleaningPlan.findMany).toHaveBeenCalled();
      expect(prismaService.alert.create).toHaveBeenCalled();
    });

    it("should use createdAt when lastExecutionAt is null", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const plan = {
        id: "plan-2",
        tenantId: "t-1",
        frequency: "DAILY",
        lastExecutionAt: null,
        createdAt: yesterday,
        tasks: [{ id: "task-2", completed: false }],
      };

      prismaService.cleaningPlan.findMany.mockResolvedValue([plan]);
      prismaService.alert.create.mockResolvedValue({ id: "alert-2" });

      await (service as any).checkCleaningPlanReminders("t-1");

      expect(prismaService.alert.create).toHaveBeenCalled();
    });

    it("should not create alert when plan has no pending tasks", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const plan = {
        id: "plan-3",
        tenantId: "t-1",
        frequency: "DAILY",
        lastExecutionAt: yesterday,
        createdAt: new Date(),
        tasks: [], // no pending tasks
      };

      prismaService.cleaningPlan.findMany.mockResolvedValue([plan]);

      await (service as any).checkCleaningPlanReminders("t-1");

      expect(prismaService.alert.create).not.toHaveBeenCalled();
    });
  });

  describe("getTemperatureMeasurements", () => {
    it("should return measurements when control exists", async () => {
      prismaService.temperatureControl.findFirst.mockResolvedValue({
        id: "c-1",
      });
      prismaService.temperatureMeasurement.findMany.mockResolvedValue([
        { id: "m-1", temperature: 4 },
      ]);

      const result = await service.getTemperatureMeasurements("t-1", "c-1");

      expect(result).toHaveLength(1);
    });

    it("should throw NotFoundException when control not found", async () => {
      prismaService.temperatureControl.findFirst.mockResolvedValue(null);

      await expect(
        service.getTemperatureMeasurements("t-1", "missing"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it("should not create alert when temperature is within range", async () => {
    prismaService.temperatureControl.findFirst.mockResolvedValue({
      id: "c-1",
      tenantId: "t-1",
      targetTemperature: 4,
      tolerance: 2,
    });
    prismaService.temperatureMeasurement.create.mockResolvedValue({
      id: "m-1",
      temperature: 4,
      withinRange: true,
    });

    const result = await service.recordTemperature(
      "t-1",
      "c-1",
      { temperature: 4 },
      "u-1",
    );

    expect(result.success).toBe(true);
    expect(prismaService.alert.create).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException when adding task to missing plan", async () => {
    prismaService.cleaningPlan.findFirst.mockResolvedValue(null);

    await expect(
      service.addCleaningTask("t-1", "missing", {
        area: "Counter",
        description: "Clean",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw NotFoundException when completing missing task", async () => {
    prismaService.cleaningTask.findFirst.mockResolvedValue(null);

    await expect(
      service.completeCleaningTask("t-1", "missing", { notes: "done" }, "u-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should get cleaning plans", async () => {
    prismaService.cleaningPlan.findMany.mockResolvedValue([
      { id: "p-1", tasks: [] },
    ]);

    const result = await service.getCleaningPlans("t-1");

    expect(result).toHaveLength(1);
  });

  it("should get pest controls", async () => {
    prismaService.pestControl.findMany.mockResolvedValue([{ id: "pc-1" }]);

    const result = await service.getPestControls("t-1");

    expect(result).toHaveLength(1);
  });

  it("should get goods receptions", async () => {
    prismaService.goodsReception.findMany.mockResolvedValue([{ id: "gr-1" }]);

    const result = await service.getGoodsReceptions("t-1");

    expect(result).toHaveLength(1);
  });

  it("should flag rejected products and create alert in createGoodsReception", async () => {
    const reception = { id: "gr-1", tenantId: "t-1" };
    prismaService.goodsReception.create.mockResolvedValue(reception);
    prismaService.goodsReception.findUnique.mockResolvedValue(reception);
    prismaService.alert.create.mockResolvedValue({ id: "a-1" });

    const dto = {
      supplierId: "s-1",
      temperatureOnReception: 15,
      acceptableTemperature: 4,
      products: [{ productId: "p-out", temperature: 20 }], // fuera de rango (4±2)
      deliveryNote: "N1",
      expiryDate: new Date(),
      lot: "L1",
      signedBy: "Me",
      verifiedBy: "You",
    };

    const result = await service.createGoodsReception("t-1", dto as any);

    expect(result.rejectedProducts).toContain("p-out");
    expect(prismaService.alert.create).toHaveBeenCalled();
  });

  describe("createAlert", () => {
    it("should create alert without assignees", async () => {
      prismaService.alert.create.mockResolvedValue({ id: "a-1" });

      const result = await service.createAlert("t-1", {
        message: "Test",
        severity: "HIGH",
      } as any);

      expect(result.success).toBe(true);
    });

    it("should create alert with assignees", async () => {
      prismaService.alert.create.mockResolvedValue({ id: "a-1" });

      const result = await service.createAlert("t-1", {
        message: "Test",
        severity: "HIGH",
        assignees: ["u-1", "u-2"],
      } as any);

      expect(result.success).toBe(true);
    });
  });

  describe("updateAlert", () => {
    it("should update alert successfully", async () => {
      prismaService.alert.findFirst.mockResolvedValue({ id: "a-1" });
      prismaService.alert.update.mockResolvedValue({
        id: "a-1",
        isResolved: true,
      });

      const result = await service.updateAlert("t-1", "a-1", {
        isResolved: true,
      } as any);

      expect(result.success).toBe(true);
    });

    it("should throw NotFoundException when alert not found", async () => {
      prismaService.alert.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAlert("t-1", "missing", {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getAlerts", () => {
    it("should get alerts without filters", async () => {
      prismaService.alert.findMany.mockResolvedValue([{ id: "a-1" }]);

      const result = await service.getAlerts("t-1");

      expect(result).toHaveLength(1);
    });

    it("should get alerts with type, severity and status filters", async () => {
      prismaService.alert.findMany.mockResolvedValue([]);

      await service.getAlerts("t-1", {
        type: "TEMPERATURE",
        severity: "HIGH",
        status: "OPEN",
      });

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "TEMPERATURE",
            severity: "HIGH",
            status: "OPEN",
          }),
        }),
      );
    });
  });

  describe("generateComplianceReport", () => {
    it("should generate report with kpi calculations", async () => {
      const outOfRangeTemps = Array(6).fill({
        withinRange: false,
        control: {},
      });
      const inRangeTemp = { withinRange: true, control: {} };
      prismaService.temperatureMeasurement.findMany.mockResolvedValue([
        ...outOfRangeTemps,
        inRangeTemp,
      ]);

      prismaService.cleaningTask.findMany.mockResolvedValue([
        { planId: "p-1", plan: {} },
      ]);
      prismaService.pestControl.findMany.mockResolvedValue([]);
      prismaService.goodsReception.findMany.mockResolvedValue([
        { products: [{ estado: "REJECTED" }, { estado: "REJECTED" }] },
      ]);

      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prismaService.alert.findMany.mockResolvedValue([
        { status: "RESOLVED", createdAt, resolvedAt: new Date() },
      ]);

      const dto = {
        period: "MONTHLY",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        controlTypes: [],
      };

      const result = await service.generateComplianceReport("t-1", dto as any);

      expect(result.success).toBe(true);
      expect(result.data.kpis).toBeDefined();
      expect(result.data.recommendations.length).toBeGreaterThan(0);
    });

    it("should generate report with empty data (100% compliance defaults)", async () => {
      prismaService.temperatureMeasurement.findMany.mockResolvedValue([]);
      prismaService.cleaningTask.findMany.mockResolvedValue([]);
      prismaService.pestControl.findMany.mockResolvedValue([]);
      prismaService.goodsReception.findMany.mockResolvedValue([]);
      prismaService.alert.findMany.mockResolvedValue([]);

      const dto = {
        period: "WEEKLY",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-07"),
        controlTypes: [],
      };

      const result = await service.generateComplianceReport("t-1", dto as any);

      expect(result.success).toBe(true);
      expect(result.data.kpis.temperatureCompliance).toBe(100);
      expect(result.data.kpis.goodsAcceptanceRate).toBe(100);
      expect(result.data.recommendations).toHaveLength(0);
    });
  });

  it("should get compliance history with explicit days", async () => {
    const result = await service.getComplianceHistory("t-1", 30);
    expect(result).toBeUndefined();
  });

  it("should get compliance history using default days", async () => {
    const result = await service.getComplianceHistory("t-1");
    expect(result).toBeUndefined();
  });

  it("should create alert using provided alertType (not default)", async () => {
    prismaService.alert.create.mockResolvedValue({ id: "a-typed" });
    const result = await service.createAlert("t-1", {
      alertType: "TEMPERATURE",
      severity: "HIGH",
      message: "Temp alert",
    } as any);
    expect(result.success).toBe(true);
    expect(prismaService.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "TEMPERATURE" }),
      }),
    );
  });

  it("should create alert using default severity and message when not provided", async () => {
    prismaService.alert.create.mockResolvedValue({ id: "a-d" });
    const result = await service.createAlert("t-1", {} as any);
    expect(result.success).toBe(true);
    expect(prismaService.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "INFO", message: "" }),
      }),
    );
  });

  it("should count CLOSED status alerts in compliance KPI", async () => {
    prismaService.temperatureMeasurement.findMany.mockResolvedValue([]);
    prismaService.cleaningTask.findMany.mockResolvedValue([]);
    prismaService.pestControl.findMany.mockResolvedValue([]);
    prismaService.goodsReception.findMany.mockResolvedValue([]);

    const createdAt = new Date(Date.now() - 90 * 60 * 1000);
    prismaService.alert.findMany.mockResolvedValue([
      { status: "CLOSED", createdAt, resolvedAt: new Date() },
    ]);

    const dto = {
      period: "WEEKLY",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-07"),
      controlTypes: [],
    };

    const result = await service.generateComplianceReport("t-1", dto as any);

    expect(result.data.kpis.alertResponseTime).toBeGreaterThan(0);
  });

  it("should create LOW severity alert when withinRange is true (private)", async () => {
    prismaService.temperatureControl.findUnique.mockResolvedValue({
      id: "c-1",
      tenantId: "t-1",
      targetTemperature: 4,
      tolerance: 2,
      unit: "C",
    });
    prismaService.alert.create.mockResolvedValue({ id: "ta-1" });

    await (service as any).createTemperatureAlert("c-1", {
      temperature: 4,
      withinRange: true,
    });

    expect(prismaService.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severity: "LOW" }),
      }),
    );
  });

  describe("calculateNextExecution (private)", () => {
    it("should add 7 days for WEEKLY frequency", () => {
      const last = new Date("2026-01-01");
      const next = (service as any).calculateNextExecution("WEEKLY", last);
      expect(next.getDate()).toBe(8);
    });

    it("should add 1 month for MONTHLY frequency", () => {
      const last = new Date("2026-01-01");
      const next = (service as any).calculateNextExecution("MONTHLY", last);
      expect(next.getMonth()).toBe(1); // febrero
    });

    it("should add 3 months for QUARTERLY frequency", () => {
      const last = new Date("2026-01-01");
      const next = (service as any).calculateNextExecution("QUARTERLY", last);
      expect(next.getMonth()).toBe(3); // abril
    });
  });

  describe("calculateExpectedCleaningTasks (private)", () => {
    it("should count unique planIds", () => {
      const tasks = [{ planId: "p-1" }, { planId: "p-1" }, { planId: "p-2" }];
      const total = (service as any).calculateExpectedCleaningTasks(tasks);
      expect(total).toBe(2);
    });

    it("should return 0 for empty task list", () => {
      const total = (service as any).calculateExpectedCleaningTasks([]);
      expect(total).toBe(0);
    });
  });

  describe("generateRecommendations (private)", () => {
    it("should generate all recommendations when all kpis are below thresholds", () => {
      const data = {
        temperatures: Array(10).fill({ withinRange: false }),
      };
      const kpis = {
        temperatureCompliance: 80,
        cleaningCompliance: 80,
        goodsAcceptanceRate: 80,
        alertResponseTime: 120,
      };

      const recs = (service as any).generateRecommendations(data, kpis);

      expect(recs.length).toBeGreaterThanOrEqual(4);
    });

    it("should generate no recommendations when all kpis are above thresholds", () => {
      const data = { temperatures: [] };
      const kpis = {
        temperatureCompliance: 100,
        cleaningCompliance: 100,
        goodsAcceptanceRate: 100,
        alertResponseTime: 10,
      };

      const recs = (service as any).generateRecommendations(data, kpis);

      expect(recs).toHaveLength(0);
    });
  });
});
