import { Test, TestingModule } from "@nestjs/testing";
import { DashboardService } from "./dashboard.service";
import { PrismaService } from "../../common/services/prisma.service";
import { RoleAccessService } from "../role-access/role-access.service";

describe("DashboardService", () => {
  let service: DashboardService;
  let prismaService: any;
  let mockRoleAccess: { isSectionAllowed: jest.Mock };

  const mockPrismaService = {
    dashboardAlert: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    dashboardMetric: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    purchaseOrder: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    purchaseSchedule: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    menu: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    recipe: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    stock: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    menuScan: {
      groupBy: jest.fn(),
    },
    digitalMenu: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    session: {
      groupBy: jest.fn(),
    },
    production: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    workBatch: {
      count: jest.fn(),
    },
    productionOrder: {
      findMany: jest.fn(),
    },
    staffMember: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RoleAccessService,
          useValue: (mockRoleAccess = {
            isSectionAllowed: jest.fn().mockResolvedValue(true),
          }),
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prismaService = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getDashboardMetrics", () => {
    it("should return grouped metrics for a tenant", async () => {
      const mockMetrics = [
        {
          id: "metric-1",
          tenantId: "tenant-1",
          period: "MONTH",
          metricType: "REVENUE",
          value: 10000,
          date: new Date(),
        },
        {
          id: "metric-2",
          tenantId: "tenant-1",
          period: "MONTH",
          metricType: "COSTS",
          value: 5000,
          date: new Date(),
        },
      ];

      prismaService.dashboardMetric.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getDashboardMetrics("tenant-1", {
        period: "MONTH",
      });

      expect(result.success).toBe(true);
      expect(result.data.REVENUE).toBeDefined();
      expect(result.data.COSTS).toBeDefined();
      expect(prismaService.dashboardMetric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          period: "MONTH",
        }),
        orderBy: { date: "desc" },
        take: 500,
      });
    });

    it("should filter by metric types", async () => {
      prismaService.dashboardMetric.findMany.mockResolvedValue([]);

      await service.getDashboardMetrics("tenant-1", {
        metricTypes: ["REVENUE"],
      });

      expect(prismaService.dashboardMetric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          metricType: { in: ["REVENUE"] },
        }),
        orderBy: { date: "desc" },
        take: 500,
      });
    });
  });

  describe("calculateKPIs", () => {
    // Fuentes vacías para llegar hasta el bloque de programados sin datos.
    const mockEmptyKpiSources = () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);
      prismaService.menu.findMany.mockResolvedValue([]);
      prismaService.stock.findMany.mockResolvedValue([]);
      prismaService.stock.count.mockResolvedValue(0);
      prismaService.menuScan.groupBy.mockResolvedValue([]);
      prismaService.digitalMenu.findMany.mockResolvedValue([]);
      prismaService.digitalMenu.count.mockResolvedValue(0);
      prismaService.dashboardAlert.count.mockResolvedValue(0);
      prismaService.session.groupBy.mockResolvedValue([]);
      prismaService.order.count.mockResolvedValue(0);
      prismaService.order.aggregate.mockResolvedValue({ _sum: {} });
      prismaService.recipe.count.mockResolvedValue(0);
      prismaService.menu.count.mockResolvedValue(0);
      prismaService.workBatch.count.mockResolvedValue(0);
      prismaService.productionOrder.findMany.mockResolvedValue([]);
      prismaService.purchaseOrder.count.mockResolvedValue(0);
      prismaService.purchaseOrder.findFirst.mockResolvedValue(null);
    };

    it("should calculate KPIs for tenant", async () => {
      const mockProducts = [
        { purchasePrice: 10 },
        { purchasePrice: 20 },
        { purchasePrice: 30 },
      ];
      const mockMenus = [{ totalMargin: 100 }, { totalMargin: 200 }];
      const mockStocks = [
        { quantity: 10, minimumStock: 5 },
        { quantity: 3, minimumStock: 5 },
        { quantity: 8, minimumStock: 10 },
      ];
      const mockSessions = [{ userId: "user-1" }];
      const mockTodayRevenue = { _sum: { totalAmount: 500 } };
      const mockMonthlyRevenue = { _sum: { totalAmount: 1500 } };
      const mockBatchScheduledFor = new Date();
      const mockUpcomingOrders = [
        {
          id: "order-1",
          batchId: "batch-1",
          title: "Fondo oscuro",
          orderType: "COOKING",
          status: "PENDING",
          scheduledFor: new Date(),
          postponedTo: null,
          estimatedTime: 90,
          assignedStaffIds: [],
          batch: { scheduledFor: mockBatchScheduledFor },
        },
      ];

      prismaService.product.findMany.mockResolvedValue(mockProducts);
      prismaService.product.count.mockResolvedValue(3);
      prismaService.menu.findMany.mockResolvedValue(mockMenus);
      prismaService.stock.findMany.mockResolvedValue(mockStocks);
      prismaService.stock.count.mockResolvedValue(5);
      prismaService.menuScan.groupBy.mockResolvedValue([]);
      prismaService.digitalMenu.findMany.mockResolvedValue([]);
      prismaService.digitalMenu.count.mockResolvedValue(3);
      prismaService.dashboardAlert.count.mockResolvedValue(2);
      prismaService.session.groupBy.mockResolvedValue(mockSessions);
      prismaService.order.count.mockResolvedValue(7);
      prismaService.order.aggregate.mockResolvedValueOnce(mockTodayRevenue);
      prismaService.order.aggregate.mockResolvedValueOnce(mockMonthlyRevenue);
      prismaService.recipe.count.mockResolvedValue(12);
      prismaService.menu.count.mockResolvedValue(5);
      prismaService.workBatch.count.mockResolvedValue(2);
      prismaService.productionOrder.findMany.mockResolvedValue(
        mockUpcomingOrders,
      );
      prismaService.purchaseOrder.count.mockResolvedValue(0);
      prismaService.purchaseOrder.findFirst.mockResolvedValue(null);

      const result = await service.calculateKPIs("tenant-1");

      expect(result.success).toBe(true);
      expect(result.data.totalProducts).toBeDefined();
      expect(result.data.totalRecipes).toBeDefined();
      expect(result.data.totalMenus).toBeDefined();
      expect(result.data.activeProductionBatches).toBe(2);
      expect(result.data.upcomingProductionTasks).toHaveLength(1);
      expect(result.data.upcomingProductionTasks[0]).toEqual({
        id: "order-1",
        batchId: "batch-1",
        title: "Fondo oscuro",
        orderType: "COOKING",
        status: "PENDING",
        lotDate: mockBatchScheduledFor,
        isPostponed: false,
        estimatedTime: 90,
        assignedStaffNames: [],
      });
    });

    it("anuncia el pedido programado pendiente de enviar con la hora de su programación", async () => {
      mockEmptyKpiSources();
      // Reloj fijo (el borrador es del 02/09): sin esto, correr la suite el
      // 2026-09-02 real haría isToday true y rompería la aserción.
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T07:00:00Z"));
      try {
        prismaService.purchaseOrder.findFirst.mockResolvedValue({
          // 09:03 en Madrid (CEST): el cron genera pasados unos minutos de la
          // hora configurada, pero el aviso debe mostrar "09:00".
          createdAt: new Date("2026-09-02T07:03:00Z"),
          supplier: { name: "Frutas Candela" },
          events: [{ payload: { scheduleId: "schedule-1" } }],
        });
        prismaService.purchaseSchedule.findUnique.mockResolvedValue({
          timeOfDay: "09:00",
        });

        const result = await service.calculateKPIs("tenant-1");

        expect(result.data.nextScheduledPurchase).toEqual({
          dateKey: "2026-09-02",
          timeOfDay: "09:00",
          supplierName: "Frutas Candela",
          isToday: false,
          isPendingDraft: true,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("marca isToday cuando la próxima ejecución de la programación activa es hoy", async () => {
      mockEmptyKpiSources();
      // Martes 09:00 Madrid; la programación corre hoy a las 11:00.
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T07:00:00Z"));
      try {
        prismaService.purchaseSchedule.findMany.mockResolvedValueOnce([
          {
            daysOfWeek: [2],
            timeOfDay: "11:00",
            lastRunAt: null,
            supplier: { name: "Frutas Candela" },
          },
        ]);

        const result = await service.calculateKPIs("tenant-1");

        expect(result.data.nextScheduledPurchase).toEqual({
          dateKey: "2026-09-01",
          timeOfDay: "11:00",
          supplierName: "Frutas Candela",
          isToday: true,
          isPendingDraft: false,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("no anuncia ningún programado cuando ya se envió (sin BORRADOR pendiente)", async () => {
      mockEmptyKpiSources();

      const result = await service.calculateKPIs("tenant-1");

      expect(result.data.nextScheduledPurchase).toBeNull();
    });

    it("sin borrador del cron, anuncia la próxima ejecución de la programación activa más cercana", async () => {
      mockEmptyKpiSources();
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T07:00:00Z")); // martes 09:00 Madrid
      try {
        prismaService.purchaseSchedule.findMany.mockResolvedValueOnce([
          {
            daysOfWeek: [3], // miércoles
            timeOfDay: "08:00",
            lastRunAt: null,
            supplier: { name: "Lácteos Sur" },
          },
          {
            daysOfWeek: [2], // martes: la hora de hoy ya pasó → siguiente martes
            timeOfDay: "07:00",
            lastRunAt: null,
            supplier: { name: "Pescados Norte" },
          },
        ]);

        const result = await service.calculateKPIs("tenant-1");

        expect(result.data.nextScheduledPurchase).toEqual({
          dateKey: "2026-09-02",
          timeOfDay: "08:00",
          supplierName: "Lácteos Sur",
          isToday: false,
          isPendingDraft: false,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it("incluye las cifras monetarias para un rol con acceso a coste", async () => {
      mockEmptyKpiSources();
      const result = await service.calculateKPIs("tenant-1", "USER");
      expect(result.data).toHaveProperty("averageCost");
      expect(result.data).toHaveProperty("averageMargin");
      expect(result.data).toHaveProperty("todayRevenue");
      expect(result.data).toHaveProperty("monthlyRevenue");
    });

    it("elimina las cifras monetarias cuando el rol no puede ver coste", async () => {
      mockEmptyKpiSources();
      mockRoleAccess.isSectionAllowed.mockImplementation(
        (_t: string, _r: string, key: string) =>
          Promise.resolve(key !== "recipes.cost"),
      );
      const result = await service.calculateKPIs("tenant-1", "USER");
      expect(result.data).not.toHaveProperty("averageCost");
      expect(result.data).not.toHaveProperty("averageMargin");
      expect(result.data).not.toHaveProperty("todayRevenue");
      expect(result.data).not.toHaveProperty("monthlyRevenue");
      // los contadores no monetarios siguen ahí
      expect(result.data).toHaveProperty("upcomingProductionTasks");
      expect(result.data).toHaveProperty("lowStockItems");
    });
  });

  describe("getCostTrend", () => {
    it("should return cost trend for period", async () => {
      prismaService.dashboardMetric.findMany.mockResolvedValue([]);

      const result = await service.getCostTrend("tenant-1", "MONTH");

      expect(result.success).toBe(true);
      expect(prismaService.dashboardMetric.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          period: "MONTH",
          metricType: "COST_TREND",
        },
        orderBy: { date: "asc" },
        take: 12,
      });
    });

    it("should return existing metrics when dashboardMetrics exist", async () => {
      const mockMetrics = [
        { id: "m-1", metricType: "COST_TREND", value: 500, date: new Date() },
      ];
      prismaService.dashboardMetric.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getCostTrend("tenant-1", "MONTH");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMetrics);
    });
  });

  describe("getMenuMarginAnalysis", () => {
    it("should return menu margin analysis", async () => {
      const mockMenus = [
        {
          id: "menu-1",
          name: "Menu del dia",
          totalCost: 100,
          totalPrice: 150,
          totalMargin: 50,
          items: [],
        },
      ];

      prismaService.menu.findMany.mockResolvedValue(mockMenus);

      const result = await service.getMenuMarginAnalysis("tenant-1");

      expect(result.success).toBe(true);
      expect(result.data.menus).toHaveLength(1);
      expect(result.data.averageMargin).toBeDefined();
      expect(prismaService.menu.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", isActive: true },
        include: {
          items: {
            include: {
              recipe: true,
            },
          },
        },
      });
    });
  });

  describe("getAlerts", () => {
    it("should return alerts for tenant", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          tenantId: "tenant-1",
          alertType: "LOW_STOCK",
          severity: "HIGH",
          title: "Stock bajo",
        },
      ];

      prismaService.dashboardAlert.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getAlerts("tenant-1", {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAlerts);
    });

    it("should filter by alert type", async () => {
      prismaService.dashboardAlert.findMany.mockResolvedValue([]);

      await service.getAlerts("tenant-1", { alertType: "LOW_STOCK" });

      expect(prismaService.dashboardAlert.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", alertType: "LOW_STOCK" },
        orderBy: [
          { isResolved: "asc" },
          { severity: "desc" },
          { createdAt: "desc" },
        ],
        take: 50,
      });
    });
  });

  describe("createAlert", () => {
    it("should create new alert", async () => {
      const mockAlert = {
        id: "alert-1",
        tenantId: "tenant-1",
        alertType: "LOW_STOCK",
        severity: "HIGH",
        title: "Stock bajo",
        description: "Stock bajo",
      };

      prismaService.dashboardAlert.create.mockResolvedValue(mockAlert);

      const result = await service.createAlert("tenant-1", {
        alertType: "LOW_STOCK",
        severity: "HIGH",
        title: "Stock bajo",
        description: "Stock bajo",
      });

      expect(result.success).toBe(true);
      expect(prismaService.dashboardAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          alertType: "LOW_STOCK",
        }),
      });
    });
  });

  describe("resolveAlert", () => {
    it("should resolve an alert", async () => {
      const mockAlert = {
        id: "alert-1",
        tenantId: "tenant-1",
      };

      prismaService.dashboardAlert.findFirst.mockResolvedValue(mockAlert);
      prismaService.dashboardAlert.update.mockResolvedValue(mockAlert);

      const result = await service.resolveAlert(
        "alert-1",
        "tenant-1",
        "user-1",
        {
          resolutionNote: "Stock repuesto",
        },
      );

      expect(result.success).toBe(true);
      expect(prismaService.dashboardAlert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: {
          isResolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: "user-1",
        },
      });
    });
  });

  describe("getAlertStats", () => {
    it("should return alert statistics", async () => {
      prismaService.dashboardAlert.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(1) // resolved
        .mockResolvedValueOnce(2); // unresolved

      prismaService.dashboardAlert.groupBy.mockResolvedValue([]);

      const result = await service.getAlertStats("tenant-1");

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(3);
      expect(result.data.unresolved).toBe(2);
      expect(result.data.resolved).toBe(1);
    });

    it("should handle zero alerts", async () => {
      prismaService.dashboardAlert.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // resolved
        .mockResolvedValueOnce(0); // unresolved

      prismaService.dashboardAlert.groupBy.mockResolvedValue([]);

      const result = await service.getAlertStats("tenant-1");

      expect(result.data.total).toBe(0);
      expect(result.data.unresolved).toBe(0);
      expect(result.data.resolved).toBe(0);
    });

    it("should handle all alerts resolved", async () => {
      prismaService.dashboardAlert.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(5) // resolved
        .mockResolvedValueOnce(0); // unresolved

      prismaService.dashboardAlert.groupBy.mockResolvedValue([]);

      const result = await service.getAlertStats("tenant-1");

      expect(result.data.total).toBe(5);
      expect(result.data.unresolved).toBe(0);
      expect(result.data.resolved).toBe(5);
    });
  });

  describe("edge cases", () => {
    it("should handle empty product data in dashboard", async () => {
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.product.count.mockResolvedValue(0);
      prismaService.order.findMany.mockResolvedValue([]);
      prismaService.order.count.mockResolvedValue(0);
      prismaService.production.findMany.mockResolvedValue([]);
      prismaService.production.count.mockResolvedValue(0);
      prismaService.recipe.count.mockResolvedValue(0);
      prismaService.menu.findMany.mockResolvedValue([]);
      prismaService.menu.count.mockResolvedValue(0);
      prismaService.dashboardAlert.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaService.dashboardAlert.groupBy.mockResolvedValue([]);
      prismaService.stock.findMany.mockResolvedValue([]);
      prismaService.stock.count.mockResolvedValue(0);
      prismaService.stock.aggregate.mockResolvedValue({
        _avg: { currentQuantity: 0 },
      });

      const result = await service.getDashboardMetrics("tenant-1", {
        startDate: new Date(),
        endDate: new Date(),
      });

      expect(result.success).toBe(true);
    });

    it("should handle alert creation with minimal fields", async () => {
      prismaService.dashboardAlert.create.mockResolvedValue({
        id: "alert-1",
        tenantId: "tenant-1",
        alertType: "INFO",
        severity: "LOW",
        title: "Test",
        description: "Test",
      });

      const result = await service.createAlert("tenant-1", {
        alertType: "INFO",
        severity: "LOW",
        title: "Test",
        description: "Test",
      });

      expect(result.success).toBe(true);
      expect(prismaService.dashboardAlert.create).toHaveBeenCalled();
    });

    it("should handle alert with custom resolution notes", async () => {
      const mockAlert = { id: "alert-1", tenantId: "tenant-1" };

      prismaService.dashboardAlert.findFirst.mockResolvedValue(mockAlert);
      prismaService.dashboardAlert.update.mockResolvedValue(mockAlert);

      const longNote = "A".repeat(500);

      const result = await service.resolveAlert(
        "alert-1",
        "tenant-1",
        "user-1",
        {
          resolutionNote: longNote,
        },
      );

      expect(result.success).toBe(true);
      expect(prismaService.dashboardAlert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: expect.objectContaining({
          isResolved: true,
          resolvedAt: expect.any(Date),
          resolvedBy: "user-1",
        }),
      });
    });
  });
});
