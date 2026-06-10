import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { SprintService } from "./sprint.service";
import { PrismaService } from "../../common/services/prisma.service";

describe("SprintService", () => {
  let service: SprintService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    sprint: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SprintService>(SprintService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createSprint", () => {
    it("should create sprint successfully", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "NOT_STARTED",
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
      };

      mockPrismaService.sprint.create.mockResolvedValue(mockSprint);

      const dto = {
        name: "Test Sprint",
        type: "DEVELOPMENT",
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      };

      const result = await service.createSprint("tenant-1", "user-1", dto);

      expect(result).toHaveProperty("success", true);
      expect(result.data).toEqual(mockSprint);
      expect(prismaService.sprint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          name: "Test Sprint",
          type: "DEVELOPMENT",
        }),
      });
    });
  });

  describe("getAllSprints", () => {
    it("should return all sprints for tenant", async () => {
      const mockSprints = [
        { id: "sprint-1", name: "Sprint 1", tasks: [], teamMember: [] },
        { id: "sprint-2", name: "Sprint 2", tasks: [], teamMember: [] },
      ];

      mockPrismaService.sprint.findMany.mockResolvedValue(mockSprints);

      const result = await service.getAllSprints("tenant-1");

      expect(result).toHaveProperty("success", true);
      expect(result.data).toHaveLength(2);
      expect(prismaService.sprint.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        include: expect.any(Object),
        orderBy: { startDate: "desc" },
      });
    });
  });

  describe("getSprintById", () => {
    it("should return sprint by id", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        tasks: [],
        teamMember: [],
      };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);

      const result = await service.getSprintById("tenant-1", "sprint-1");

      expect(result).toHaveProperty("success", true);
      expect(result.data).toEqual(mockSprint);
    });

    it("should throw NotFoundException if sprint not found", async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);

      await expect(
        service.getSprintById("tenant-1", "nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteSprint", () => {
    it("should delete sprint successfully", async () => {
      const mockSprint = { id: "sprint-1", name: "Test Sprint" };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.sprint.delete.mockResolvedValue(mockSprint);

      const result = await service.deleteSprint("tenant-1", "sprint-1");

      expect(result).toHaveProperty("success", true);
      expect(result.message).toBe("Sprint deleted successfully");
    });

    it("should throw BadRequestException if sprint has tasks", async () => {
      const mockSprint = { id: "sprint-1", name: "Test Sprint" };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.task.count.mockResolvedValue(5);

      await expect(
        service.deleteSprint("tenant-1", "sprint-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("startSprint", () => {
    it("should start sprint successfully", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "NOT_STARTED",
      };

      const updatedSprint = { ...mockSprint, status: "IN_PROGRESS" };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.sprint.update.mockResolvedValue(updatedSprint);

      const result = await service.startSprint(
        "tenant-1",
        "sprint-1",
        "user-1",
      );

      expect(result).toHaveProperty("success", true);
      expect(prismaService.sprint.update).toHaveBeenCalledWith({
        where: { id: "sprint-1" },
        data: {
          status: "IN_PROGRESS",
          startDate: expect.any(Date),
        },
      });
    });

    it("should throw BadRequestException if sprint already started", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "IN_PROGRESS",
      };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);

      await expect(
        service.startSprint("tenant-1", "sprint-1", "user-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("completeSprint", () => {
    it("should complete sprint successfully", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "IN_PROGRESS",
        totalTasks: 10,
        completedTasks: 10,
      };

      const updatedSprint = {
        ...mockSprint,
        status: "COMPLETED",
        progress: 100,
      };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.sprint.update.mockResolvedValue(updatedSprint);

      const result = await service.completeSprint("tenant-1", "sprint-1");

      expect(result).toHaveProperty("success", true);
      expect(prismaService.sprint.update).toHaveBeenCalledWith({
        where: { id: "sprint-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          progress: 100,
        }),
      });
    });

    it("should throw BadRequestException if sprint has pending tasks", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "IN_PROGRESS",
      };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.task.count.mockResolvedValue(5);

      await expect(
        service.completeSprint("tenant-1", "sprint-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getSprintProgress", () => {
    it("should return sprint progress", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "IN_PROGRESS",
        totalTasks: 10,
        completedTasks: 7,
      };

      const mockTasks = [
        { id: "task-1", status: "COMPLETED" },
        { id: "task-2", status: "IN_PROGRESS" },
        { id: "task-3", status: "TODO" },
      ];

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.getSprintProgress("tenant-1", "sprint-1");

      expect(result).toHaveProperty("success", true);
      expect(result.data).toHaveProperty("progress", 33.33333333333333);
      expect(result.data).toHaveProperty("totalTasks", 3);
      expect(result.data).toHaveProperty("completedTasks", 1);
      expect(result.data).toHaveProperty("inProgressTasks", 1);
      expect(result.data).toHaveProperty("blockedTasks", 0);
    });
  });

  describe("getSprintAnalytics", () => {
    it("should return sprint analytics", async () => {
      const mockSprint = {
        id: "sprint-1",
        name: "Test Sprint",
        status: "IN_PROGRESS",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-15"),
        progress: 70,
        tasks: [
          {
            id: "task-1",
            status: "COMPLETED",
            priority: "HIGH",
            estimatedHours: 5,
            assignedTo: "user-1",
          },
          {
            id: "task-2",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            estimatedHours: 3,
          },
          { id: "task-3", status: "TODO", priority: "LOW", estimatedHours: 2 },
        ],
        teamMember: [{ id: "user-1", name: "John Doe" }],
      };

      mockPrismaService.sprint.findFirst.mockResolvedValue(mockSprint);

      const result = await service.getSprintAnalytics("tenant-1", "sprint-1");

      expect(result).toHaveProperty("success", true);
      expect(result.data).toHaveProperty("tasks");
      expect(result.data).toHaveProperty("team");
      expect(result.data).toHaveProperty("metrics");
      expect(result.data.tasks).toHaveProperty("totalEstimatedHours", 10);
    });
  });
});
