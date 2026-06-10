import { SprintController } from "./sprint.controller";

describe("SprintController", () => {
  let controller: SprintController;

  const mockSprintService = {
    createSprint: jest.fn(),
    getAllSprints: jest.fn(),
    getSprintById: jest.fn(),
    updateSprint: jest.fn(),
    deleteSprint: jest.fn(),
    startSprint: jest.fn(),
    completeSprint: jest.fn(),
    cancelSprint: jest.fn(),
    getSprintProgress: jest.fn(),
    getSprintAnalytics: jest.fn(),
  };

  beforeEach(() => {
    controller = new SprintController(mockSprintService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("createSprint", () => {
    it("should create sprint", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", name: "Test Sprint" },
        message: "Sprint created successfully",
      };

      mockSprintService.createSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1", user: { id: "user-1" } };
      const dto = {
        name: "Test Sprint",
        type: "DEVELOPMENT",
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      };
      const result = await controller.createSprint(req, dto);

      expect(mockSprintService.createSprint).toHaveBeenCalledWith(
        "tenant-1",
        "user-1",
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getAllSprints", () => {
    it("should return all sprints", async () => {
      const mockResult = {
        success: true,
        data: [],
        message: "Sprints retrieved successfully",
      };

      mockSprintService.getAllSprints.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.getAllSprints(req);

      expect(mockSprintService.getAllSprints).toHaveBeenCalledWith("tenant-1");
      expect(result).toEqual(mockResult);
    });
  });

  describe("getSprintById", () => {
    it("should return sprint by id", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", name: "Test Sprint" },
        message: "Sprint retrieved successfully",
      };

      mockSprintService.getSprintById.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.getSprintById(req, "sprint-1");

      expect(mockSprintService.getSprintById).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("updateSprint", () => {
    it("should update sprint", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", name: "Updated Sprint" },
        message: "Sprint updated successfully",
      };

      mockSprintService.updateSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const dto = { name: "Updated Sprint" };
      const result = await controller.updateSprint(req, "sprint-1", dto);

      expect(mockSprintService.updateSprint).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteSprint", () => {
    it("should delete sprint", async () => {
      const mockResult = {
        success: true,
        message: "Sprint deleted successfully",
      };

      mockSprintService.deleteSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.deleteSprint(req, "sprint-1");

      expect(mockSprintService.deleteSprint).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("startSprint", () => {
    it("should start sprint", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", status: "IN_PROGRESS" },
        message: "Sprint started successfully",
      };

      mockSprintService.startSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1", user: { id: "user-1" } };
      const result = await controller.startSprint(req, "sprint-1");

      expect(mockSprintService.startSprint).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
        "user-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("completeSprint", () => {
    it("should complete sprint", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", status: "COMPLETED", progress: 100 },
        message: "Sprint completed successfully",
      };

      mockSprintService.completeSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.completeSprint(req, "sprint-1");

      expect(mockSprintService.completeSprint).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("cancelSprint", () => {
    it("should cancel sprint", async () => {
      const mockResult = {
        success: true,
        data: { id: "sprint-1", status: "CANCELLED" },
        message: "Sprint cancelled successfully",
      };

      mockSprintService.cancelSprint.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1", user: { id: "user-1" } };
      const result = await controller.cancelSprint(req, "sprint-1");

      expect(mockSprintService.cancelSprint).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
        "user-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getSprintProgress", () => {
    it("should return sprint progress", async () => {
      const mockResult = {
        success: true,
        data: { sprintId: "sprint-1", progress: 70, totalTasks: 10 },
        message: "Sprint progress retrieved successfully",
      };

      mockSprintService.getSprintProgress.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.getSprintProgress(req, "sprint-1");

      expect(mockSprintService.getSprintProgress).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("getSprintAnalytics", () => {
    it("should return sprint analytics", async () => {
      const mockResult = {
        success: true,
        data: {
          sprint: { id: "sprint-1", name: "Test Sprint" },
          tasks: { total: 10, byStatus: {}, totalEstimatedHours: 50 },
          team: { memberCount: 3 },
          metrics: { velocity: 1.5 },
        },
        message: "Sprint analytics retrieved successfully",
      };

      mockSprintService.getSprintAnalytics.mockResolvedValue(mockResult);

      const req = { tenantId: "tenant-1" };
      const result = await controller.getSprintAnalytics(req, "sprint-1");

      expect(mockSprintService.getSprintAnalytics).toHaveBeenCalledWith(
        "tenant-1",
        "sprint-1",
      );
      expect(result).toEqual(mockResult);
    });
  });
});
