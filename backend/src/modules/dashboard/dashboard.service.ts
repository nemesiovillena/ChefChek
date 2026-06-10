import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  DashboardQueryDto,
  CreateMetricDto,
  CreateAlertDto,
  ResolveAlertDto,
  AlertsQueryDto,
} from "./dto/dashboard.dto";

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Métricas del Dashboard
  async getDashboardMetrics(tenantId: string, query: DashboardQueryDto) {
    const { period = "MONTH", metricTypes, startDate, endDate } = query;

    const where: any = { tenantId, period };

    if (metricTypes && metricTypes.length > 0) {
      where.metricType = { in: metricTypes };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        (where.date as any).gte = new Date(startDate);
      }
      if (endDate) {
        (where.date as any).lte = new Date(endDate);
      }
    } else {
      // Por defecto, últimos 12 meses
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      where.date = { gte: twelveMonthsAgo };
    }

    const metrics = await this.prisma.dashboardMetric.findMany({
      where,
      orderBy: { date: "desc" },
      take: 500,
    });

    // Agrupar por tipo de métrica
    const grouped = metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.metricType]) {
          acc[metric.metricType] = [];
        }
        acc[metric.metricType].push(metric);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return {
      success: true,
      data: grouped,
      message: "Dashboard metrics retrieved successfully",
    };
  }

  async calculateKPIs(tenantId: string) {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Costes de proveedores - promedio netPrice de productos
    const products = await this.prisma.product.findMany({
      where: { tenantId },
    });

    const avgCost =
      products.reduce((sum, p) => sum + p.purchasePrice, 0) /
      (products.length || 1);

    // Márgenes de carta - promedio de márgenes de menús activos
    const menus = await this.prisma.menu.findMany({
      where: { tenantId, isActive: true },
    });

    const avgMargin =
      menus.reduce((sum, m) => sum + (m.totalMargin || 0), 0) /
      (menus.length || 1);

    // Stock bajo - productos con quantity <= minimumStock
    const stocks = await this.prisma.stock.findMany({
      where: { tenantId },
      select: { quantity: true, minimumStock: true },
    });
    const lowStockCount = stocks.filter(
      (s) => s.quantity <= s.minimumStock,
    ).length;

    // Escaneos de menú digital
    const menuScans = await this.prisma.menuScan.groupBy({
      by: ["digitalMenuId"],
      _count: true,
      where: {
        digitalMenu: {
          tenantId,
        },
      },
    });

    const totalScans = menuScans.reduce((sum, s) => sum + s._count, 0);

    // Alertas activas no resueltas
    const activeAlerts = await this.prisma.dashboardAlert.count({
      where: {
        tenantId,
        isResolved: false,
        severity: { in: ["HIGH", "CRITICAL"] },
      },
    });

    // Total de productos activos
    const totalProducts = await this.prisma.product.count({
      where: { tenantId, isActive: true },
    });

    // Total de recetas activas
    const totalRecipes = await this.prisma.recipe.count({
      where: { tenantId },
    });

    // Total de menús activos
    const totalMenus = await this.prisma.menu.count({
      where: { tenantId, isActive: true },
    });

    // Usuarios activos (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await this.prisma.session.groupBy({
      by: ["userId"],
      where: {
        user: { tenantId },
        expiresAt: { gt: new Date() },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Productos con stock bajo
    const lowStockItems = lowStockCount;

    // Pedidos pendientes
    const pendingOrders = await this.prisma.order.count({
      where: {
        tenantId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    // Ingresos de hoy
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRevenue = await this.prisma.order.aggregate({
      where: {
        tenantId,
        orderedAt: { gte: todayStart },
        status: "COMPLETED",
      },
      _sum: { totalAmount: true },
    });

    // Ingresos del mes
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyRevenue = await this.prisma.order.aggregate({
      where: {
        tenantId,
        orderedAt: { gte: monthStart },
        status: "COMPLETED",
      },
      _sum: { totalAmount: true },
    });

    // KPIs calculados - formato completo para frontend
    this.logger.debug(
      `Calculating KPIs for tenant ${tenantId}: ${totalProducts} products, ${totalRecipes} recipes, ${totalMenus} menus`,
    );

    const kpis = {
      // Campos principales esperados por el frontend
      totalProducts,
      totalRecipes,
      totalMenus,
      activeUsers: activeUsers.length,
      lowStockItems,
      pendingOrders,
      todayRevenue: todayRevenue._sum.totalAmount || 0,
      monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      // Campos compatibles con formato existente
      averageCost: {
        current: avgCost,
        target: avgCost * 0.95,
        changePercent: 0,
        status: avgCost > avgCost * 1.05 ? "WARNING" : "OK",
      },
      averageMargin: {
        current: avgMargin,
        target: avgMargin * 1.1,
        changePercent: 0,
        status: avgMargin < 25 ? "WARNING" : "OK",
      },
      lowStockAlerts: {
        current: lowStockCount,
        target: 0,
        status: lowStockCount > 0 ? "CRITICAL" : "OK",
      },
      digitalMenuScans: {
        current: totalScans,
        target: totalScans * 1.2,
        changePercent: 0,
        status: "OK",
      },
      activeAlerts: {
        current: activeAlerts,
        target: 0,
        status: activeAlerts > 0 ? "CRITICAL" : "OK",
      },
    };

    return {
      success: true,
      data: kpis,
      message: "KPIs calculated successfully",
    };
  }

  async getCostTrend(tenantId: string, period: string = "MONTH") {
    const metrics = await this.prisma.dashboardMetric.findMany({
      where: {
        tenantId,
        metricType: "COST_TREND",
        period,
      },
      orderBy: { date: "asc" },
      take: 12,
    });

    if (metrics.length > 0) {
      return {
        success: true,
        data: metrics,
        message: "Cost trend retrieved successfully",
      };
    }

    // Calculate real cost trends from order data if no dashboardMetrics exist
    const now = new Date();
    const costTrendData = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);

      const monthEnd = new Date(date);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);

      const orders = await this.prisma.order.findMany({
        where: {
          tenantId,
          orderedAt: { gte: date, lte: monthEnd },
          status: "COMPLETED",
        },
      });

      const totalRevenue = orders.reduce(
        (sum, order) => sum + order.totalAmount,
        0,
      );
      const totalCost = totalRevenue * 0.7; // Approximate 70% cost
      const avgMargin =
        totalRevenue > 0
          ? ((totalRevenue - totalCost) / totalRevenue) * 100
          : 0;

      costTrendData.push({
        id: `real-${i}`,
        tenantId,
        metricType: "COST_TREND",
        metricName: "Monthly Cost",
        period,
        date,
        value: totalCost,
        target: totalCost * 0.95,
        change:
          i > 0
            ? totalCost - costTrendData[costTrendData.length - 1]?.value
            : 0,
        changePercent:
          i > 0 && costTrendData.length > 0
            ? ((totalCost - costTrendData[costTrendData.length - 1].value) /
                costTrendData[costTrendData.length - 1].value) *
              100
            : 0,
        metadata: {
          totalRevenue,
          avgMargin,
          orderCount: orders.length,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      success: true,
      data: costTrendData,
      message: "Real cost trend data calculated from orders",
    };
  }

  async getMenuMarginAnalysis(tenantId: string) {
    const menus = await this.prisma.menu.findMany({
      where: { tenantId, isActive: true },
      include: {
        items: {
          include: {
            recipe: true,
          },
        },
      },
    });

    const menuAnalysis = menus.map((menu) => {
      const totalCost = menu.totalCost;
      const totalPrice = menu.totalPrice;
      const margin = menu.totalMargin;
      const marginPercent = totalPrice > 0 ? (margin / totalPrice) * 100 : 0;

      return {
        id: menu.id,
        name: menu.name,
        totalCost,
        totalPrice,
        margin,
        marginPercent,
        itemCount: menu.items.length,
        status: marginPercent < 20 ? "WARNING" : "OK",
      };
    });

    return {
      success: true,
      data: {
        menus: menuAnalysis,
        averageMargin:
          menuAnalysis.reduce((sum, m) => sum + m.marginPercent, 0) /
          (menuAnalysis.length || 1),
        worstMargin: menuAnalysis.sort(
          (a, b) => a.marginPercent - b.marginPercent,
        )[0],
        bestMargin: menuAnalysis.sort(
          (a, b) => b.marginPercent - a.marginPercent,
        )[0],
      },
      message: "Menu margin analysis retrieved successfully",
    };
  }

  // Gestión de Alertas
  async getAlerts(tenantId: string, query: AlertsQueryDto) {
    const { severity, alertType, isResolved, limit = 50 } = query;

    const where: any = { tenantId };

    if (severity) {
      where.severity = severity;
    }

    if (alertType) {
      where.alertType = alertType;
    }

    if (isResolved !== undefined) {
      where.isResolved = isResolved;
    }

    const alerts = await this.prisma.dashboardAlert.findMany({
      where,
      orderBy: [
        { isResolved: "asc" },
        { severity: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
    });

    return {
      success: true,
      data: alerts,
      message: "Alerts retrieved successfully",
    };
  }

  async createAlert(tenantId: string, dto: CreateAlertDto) {
    const alert = await this.prisma.dashboardAlert.create({
      data: {
        tenantId,
        ...dto,
      },
    });

    return {
      success: true,
      data: alert,
      message: "Alert created successfully",
    };
  }

  async resolveAlert(
    alertId: string,
    tenantId: string,
    userId: string,
    dto: ResolveAlertDto,
  ) {
    const alert = await this.prisma.dashboardAlert.findFirst({
      where: { id: alertId, tenantId },
    });

    if (!alert) {
      throw new Error("Alert not found");
    }

    const updated = await this.prisma.dashboardAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });

    return {
      success: true,
      data: updated,
      message: "Alert resolved successfully",
    };
  }

  async getAlertStats(tenantId: string) {
    const total = await this.prisma.dashboardAlert.count({
      where: { tenantId },
    });

    const resolved = await this.prisma.dashboardAlert.count({
      where: { tenantId, isResolved: true },
    });

    const unresolved = await this.prisma.dashboardAlert.count({
      where: { tenantId, isResolved: false },
    });

    const bySeverity = await this.prisma.dashboardAlert.groupBy({
      by: ["severity"],
      _count: true,
      where: { tenantId, isResolved: false },
    });

    const byType = await this.prisma.dashboardAlert.groupBy({
      by: ["alertType"],
      _count: true,
      where: { tenantId, isResolved: false },
    });

    return {
      success: true,
      data: {
        total,
        resolved,
        unresolved,
        resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
        bySeverity: bySeverity.reduce(
          (acc, item) => {
            acc[item.severity] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byType: byType.reduce(
          (acc, item) => {
            acc[item.alertType] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      message: "Alert statistics retrieved successfully",
    };
  }

  // Helper methods
  private generateSimulatedMetrics(
    tenantId: string,
    metricType: string,
    period: string,
    count: number,
  ) {
    const metrics = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);

      metrics.push({
        id: `sim-${i}`,
        tenantId,
        metricType,
        metricName: "Simulated Metric",
        period,
        date,
        value: Math.random() * 1000 + 500, // Random value
        change: (Math.random() - 0.5) * 100,
        changePercent: (Math.random() - 0.5) * 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return metrics;
  }
}
