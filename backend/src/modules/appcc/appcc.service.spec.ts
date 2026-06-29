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
      update: jest.fn(),
    },
    pestControl: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    goodsReception: {
      create: jest.fn(),
      findMany: jest.fn(),
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
  });
});
