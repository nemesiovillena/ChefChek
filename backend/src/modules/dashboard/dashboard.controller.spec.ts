import { Test, TestingModule } from "@nestjs/testing";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import {
  DashboardQueryDto,
  CreateAlertDto,
  ResolveAlertDto,
  AlertsQueryDto,
} from "./dto/dashboard.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("DashboardController", () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockDashboardService = {
    calculateKPIs: jest.fn(),
    getDashboardMetrics: jest.fn(),
    getCostTrend: jest.fn(),
    getMenuMarginAnalysis: jest.fn(),
    getAlerts: jest.fn(),
    getAlertStats: jest.fn(),
    createAlert: jest.fn(),
    resolveAlert: jest.fn(),
  };

  const mockReq = {
    tenantId: "tenant-test-123",
    user: { id: "user-1", role: "ADMIN" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getKPIs", () => {
    it("should return calculated KPIs", async () => {
      const mockKPIs = {
        averageCost: { current: 100, target: 95, status: "OK" },
        averageMargin: { current: 30, target: 33, status: "OK" },
        lowStockAlerts: { current: 0, target: 0, status: "OK" },
        digitalMenuScans: { current: 50, target: 60, status: "OK" },
        activeAlerts: { current: 0, target: 0, status: "OK" },
      };

      mockDashboardService.calculateKPIs.mockResolvedValue({
        success: true,
        data: mockKPIs,
      });

      const result = await controller.getKPIs(mockReq);

      expect(mockDashboardService.calculateKPIs).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockKPIs);
    });
  });

  describe("getMetrics", () => {
    it("should return dashboard metrics", async () => {
      const query: DashboardQueryDto = { period: "MONTH" };
      const mockMetrics = {
        COST_TREND: [{ date: new Date(), value: 100 }],
      };

      mockDashboardService.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: mockMetrics,
      });

      const result = await controller.getMetrics(mockReq, query);

      expect(mockDashboardService.getDashboardMetrics).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMetrics);
    });

    it("should filter metrics by date range", async () => {
      const query = {
        period: "MONTH",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      } as any;

      mockDashboardService.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: {},
      });

      const result = await controller.getMetrics(mockReq, query);

      expect(mockDashboardService.getDashboardMetrics).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
      expect(result.success).toBe(true);
    });

    it("should filter metrics by metric types", async () => {
      const query: DashboardQueryDto = {
        period: "MONTH",
        metricTypes: ["COST_TREND", "MARGIN_ANALYSIS"],
      };

      mockDashboardService.getDashboardMetrics.mockResolvedValue({
        success: true,
        data: {},
      });

      await controller.getMetrics(mockReq, query);

      expect(mockDashboardService.getDashboardMetrics).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
    });
  });

  describe("getCostTrend", () => {
    it("should return cost trend data", async () => {
      const period = "MONTH";
      const mockTrend = [
        { date: new Date("2024-01"), value: 100 },
        { date: new Date("2024-02"), value: 105 },
      ];

      mockDashboardService.getCostTrend.mockResolvedValue({
        success: true,
        data: mockTrend,
      });

      const result = await controller.getCostTrend(mockReq, period);

      expect(mockDashboardService.getCostTrend).toHaveBeenCalledWith(
        mockReq.tenantId,
        period,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTrend);
    });

    it("should use default period if not provided", async () => {
      mockDashboardService.getCostTrend.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getCostTrend(mockReq);

      expect(mockDashboardService.getCostTrend).toHaveBeenCalledWith(
        mockReq.tenantId,
        undefined,
      );
    });
  });

  describe("getMenuMarginAnalysis", () => {
    it("should return menu margin analysis", async () => {
      const mockAnalysis = {
        menus: [
          { id: "menu-1", name: "Menu 1", marginPercent: 30, status: "OK" },
        ],
        averageMargin: 30,
        worstMargin: { marginPercent: 20 },
        bestMargin: { marginPercent: 40 },
      };

      mockDashboardService.getMenuMarginAnalysis.mockResolvedValue({
        success: true,
        data: mockAnalysis,
      });

      const result = await controller.getMenuMarginAnalysis(mockReq);

      expect(mockDashboardService.getMenuMarginAnalysis).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalysis);
    });
  });

  describe("getAlerts", () => {
    it("should return list of alerts", async () => {
      const query: AlertsQueryDto = { limit: 50 };
      const mockAlerts = [
        { id: "alert-1", severity: "HIGH", isResolved: false },
      ];

      mockDashboardService.getAlerts.mockResolvedValue({
        success: true,
        data: mockAlerts,
      });

      const result = await controller.getAlerts(mockReq, query);

      expect(mockDashboardService.getAlerts).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAlerts);
    });

    it("should filter alerts by severity", async () => {
      const query: AlertsQueryDto = { severity: "HIGH" };

      mockDashboardService.getAlerts.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getAlerts(mockReq, query);

      expect(mockDashboardService.getAlerts).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
    });

    it("should filter alerts by resolved status", async () => {
      const query: AlertsQueryDto = { isResolved: false };

      mockDashboardService.getAlerts.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getAlerts(mockReq, query);

      expect(mockDashboardService.getAlerts).toHaveBeenCalledWith(
        mockReq.tenantId,
        query,
      );
    });
  });

  describe("getAlertStats", () => {
    it("should return alert statistics", async () => {
      const mockStats = {
        total: 10,
        resolved: 7,
        unresolved: 3,
        resolutionRate: 70,
        bySeverity: { HIGH: 2, CRITICAL: 1 },
        byType: { STOCK: 2, COST: 1 },
      };

      mockDashboardService.getAlertStats.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const result = await controller.getAlertStats(mockReq);

      expect(mockDashboardService.getAlertStats).toHaveBeenCalledWith(
        mockReq.tenantId,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
    });
  });

  describe("createAlert", () => {
    it("should create a new alert", async () => {
      const createDto: CreateAlertDto = {
        alertType: "STOCK",
        severity: "HIGH",
        title: "Low Stock Alert",
        description: "Product X is below minimum stock",
      };

      const mockAlert = { id: "alert-1", ...createDto };

      mockDashboardService.createAlert.mockResolvedValue({
        success: true,
        data: mockAlert,
      });

      const result = await controller.createAlert(mockReq, createDto);

      expect(mockDashboardService.createAlert).toHaveBeenCalledWith(
        mockReq.tenantId,
        createDto,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAlert);
    });
  });

  describe("resolveAlert", () => {
    it("should resolve an alert", async () => {
      const alertId = "alert-1";
      const resolveDto: ResolveAlertDto = {
        resolutionNote: "Fixed by restocking",
      };

      const mockResolved = {
        id: alertId,
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: mockReq.user.id,
      };

      mockDashboardService.resolveAlert.mockResolvedValue({
        success: true,
        data: mockResolved,
      });

      const result = await controller.resolveAlert(
        mockReq,
        alertId,
        resolveDto,
      );

      expect(mockDashboardService.resolveAlert).toHaveBeenCalledWith(
        alertId,
        mockReq.tenantId,
        mockReq.user.id,
        resolveDto,
      );
      expect(result.success).toBe(true);
      expect(result.data.isResolved).toBe(true);
    });
  });
});
