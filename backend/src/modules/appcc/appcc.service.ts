import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateTemperatureControlDto,
  RecordTemperatureDto,
  CreateCleaningPlanDto,
  CreateCleaningTaskDto,
  CompleteCleaningTaskDto,
  CreatePestControlDto,
  CreateGoodsReceptionDto,
  CreateAlertDto,
  UpdateAlertDto,
  GenerateComplianceReportDto,
} from "./dto/appcc.dto";

@Injectable()
export class AppccService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemperatureControl(
    tenantId: string,
    userId: string,
    dto: CreateTemperatureControlDto,
  ): Promise<any> {
    const control = await this.prisma.temperatureControl.create({
      data: {
        tenantId,
        ...dto,
        createdBy: userId,
      },
    });

    return {
      success: true,
      data: control,
    };
  }

  async recordTemperature(
    tenantId: string,
    controlId: string,
    dto: RecordTemperatureDto,
    userId: string,
  ): Promise<any> {
    const control = await this.prisma.temperatureControl.findFirst({
      where: { id: controlId, tenantId },
    });

    if (!control) {
      throw new NotFoundException("Temperature control not found");
    }

    const measurement = await this.prisma.temperatureMeasurement.create({
      data: {
        controlId,
        temperature: dto.temperature,
        withinRange: this.isWithinRange(
          dto.temperature,
          control.targetTemperature,
          control.tolerance,
        ),
        recordedAt: new Date(),
        recordedBy: userId,
        notes: dto.notes,
      },
    } as any);

    // Generar alerta si está fuera de rango
    if (!measurement.withinRange) {
      await this.createTemperatureAlert(controlId, measurement);
    }

    return {
      success: true,
      data: measurement,
    };
  }

  async getTemperatureControls(tenantId: string): Promise<any[]> {
    return await this.prisma.temperatureControl.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTemperatureMeasurements(
    tenantId: string,
    controlId: string,
  ): Promise<any[]> {
    const control = await this.prisma.temperatureControl.findFirst({
      where: { id: controlId, tenantId },
    });
    if (!control) {
      throw new NotFoundException("Temperature control not found");
    }

    return await this.prisma.temperatureMeasurement.findMany({
      where: { controlId },
      orderBy: { recordedAt: "desc" },
      take: 100,
    });
  }

  async createCleaningPlan(
    tenantId: string,
    userId: string,
    dto: CreateCleaningPlanDto,
  ): Promise<any> {
    const plan = await this.prisma.cleaningPlan.create({
      data: {
        tenantId,
        name: dto.name,
        frequency: dto.frequency,
        description: dto.description,
        responsible: dto.responsible || [],
        durationMinutes: dto.durationMinutes,
        createdBy: userId,
      },
    } as any);

    return {
      success: true,
      data: plan,
    };
  }

  async addCleaningTask(
    tenantId: string,
    planId: string,
    dto: CreateCleaningTaskDto,
  ): Promise<any> {
    const plan = await this.prisma.cleaningPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) {
      throw new NotFoundException("Cleaning plan not found");
    }

    const task = await this.prisma.cleaningTask.create({
      data: {
        planId,
        ...dto,
        completed: false,
      },
    } as any);

    return {
      success: true,
      data: task,
    };
  }

  async completeCleaningTask(
    tenantId: string,
    taskId: string,
    dto: CompleteCleaningTaskDto,
    userId: string,
  ): Promise<any> {
    const existing = await this.prisma.cleaningTask.findFirst({
      where: { id: taskId, plan: { tenantId } },
    });
    if (!existing) {
      throw new NotFoundException("Cleaning task not found");
    }

    const task = await this.prisma.cleaningTask.update({
      where: { id: taskId },
      data: {
        completed: true,
        completedAt: new Date(),
        verifiedBy: dto.verifiedBy || userId,
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: task,
    };
  }

  async getCleaningPlans(tenantId: string): Promise<any[]> {
    return await this.prisma.cleaningPlan.findMany({
      where: { tenantId },
      include: {
        tasks: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPestControl(
    tenantId: string,
    dto: CreatePestControlDto,
  ): Promise<any> {
    const pestControl = await this.prisma.pestControl.create({
      data: {
        tenantId,
        empresa: dto.company,
        type: dto.type,
        date: dto.date,
        nextDate: dto.nextDate,
        products: dto.products,
        area: dto.affectedAreas?.[0] || "",
        notes: dto.notes,
        createdBy: "system",
      } as any,
    });

    return {
      success: true,
      data: pestControl,
    };
  }

  async getPestControls(tenantId: string): Promise<any[]> {
    return await this.prisma.pestControl.findMany({
      where: { tenantId },
      orderBy: { date: "desc" },
    });
  }

  async createGoodsReception(
    tenantId: string,
    dto: CreateGoodsReceptionDto,
  ): Promise<any> {
    const reception = await this.prisma.goodsReception.create({
      data: {
        tenantId,
        proveedorId: dto.supplierId,
        items: dto.products,
        albaran: dto.deliveryNote,
        notes: (dto as any).notes,
        receivedBy: (dto as any).receivedBy,
        observaciones: dto.observations,
      } as any,
    });

    // Validar products recibidos
    const rejectedProducts = dto.products.filter(
      (p) => !this.isWithinRange(p.temperature, dto.acceptableTemperature, 2),
    );

    if (rejectedProducts.length > 0) {
      await this.createGoodsReceptionAlert(reception.id, rejectedProducts);
    }

    return {
      success: true,
      data: reception,
      rejectedProducts: rejectedProducts.map((p) => p.productId),
    };
  }

  async getGoodsReceptions(tenantId: string): Promise<any[]> {
    return await this.prisma.goodsReception.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {} as any,
    });
  }

  async createAlert(tenantId: string, dto: CreateAlertDto): Promise<any> {
    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        type: (dto as any).alertType || "INFO",
        alertType: (dto as any).alertType || "INFO",
        severity: dto.severity || "INFO",
        message: dto.message || "",
        isResolved: false,
        createdBy: (dto as any).createdBy || "system",
      } as any,
    });

    // Notificar usuarios asignados
    if (dto.assignees && dto.assignees.length > 0) {
      await this.notifyAlertUsers(alert.id, dto.assignees);
    }

    return {
      success: true,
      data: alert,
    };
  }

  async updateAlert(
    tenantId: string,
    alertId: string,
    dto: UpdateAlertDto,
  ): Promise<any> {
    const existing = await this.prisma.alert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Alert not found");
    }

    const alert = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: alert,
    };
  }

  async getAlerts(tenantId: string, filters?: any): Promise<any[]> {
    const where: any = { tenantId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return await this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async generateComplianceReport(
    tenantId: string,
    dto: GenerateComplianceReportDto,
  ): Promise<any> {
    const reportData = await this.collectComplianceData(
      tenantId,
      dto.startDate,
      dto.endDate,
      dto.controlTypes,
    );

    const kpis = this.calculateComplianceKPIs(reportData);

    const recommendations = this.generateRecommendations(reportData, kpis);

    return {
      success: true,
      data: {
        period: dto.period,
        startDate: dto.startDate,
        endDate: dto.endDate,
        kpis,
        reportData,
        recommendations,
        generatedAt: new Date(),
      },
    };
  }

  async getComplianceHistory(
    tenantId: string,
    days: number = 30,
  ): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await (this.prisma as any).complianceReport?.findMany({
      where: {
        tenantId,
        generatedAt: { gte: startDate },
      },
      orderBy: { generatedAt: "desc" },
      take: 30,
    });
  }

  private async collectComplianceData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    controlTypes?: string[],
  ): Promise<any> {
    const data: any = {};

    // Recopilar datos de temperaturas
    data.temperatures = await this.prisma.temperatureMeasurement.findMany({
      where: {
        control: {
          tenantId,
        },
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        control: true,
      },
    });

    // Recopilar datos de limpieza
    data.cleaningTasks = await this.prisma.cleaningTask.findMany({
      where: {
        plan: {
          tenantId,
        },
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        plan: true,
      },
    });

    // Recopilar datos de plagas
    data.pestControls = await this.prisma.pestControl.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Recopilar datos de recepciones
    data.goodsReceptions = await this.prisma.goodsReception.findMany({
      where: {
        tenantId,
        fecha: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Recopilar alertas
    data.alerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return data;
  }

  private calculateComplianceKPIs(data: any): any {
    const kpis: any = {
      temperatureCompliance: 0,
      cleaningCompliance: 0,
      pestControlCoverage: 100,
      goodsAcceptanceRate: 0,
      alertResponseTime: 0,
      overallCompliance: 0,
    };

    // Calcular cumplimiento de temperaturas
    const totalTemps = data.temperatures.length;
    const compliantTemps = data.temperatures.filter(
      (m) => m.withinRange,
    ).length;
    kpis.temperatureCompliance =
      totalTemps > 0 ? (compliantTemps / totalTemps) * 100 : 100;

    // Calcular cumplimiento de limpieza
    const totalTasks = data.cleaningTasks.length;
    const completedTasks = totalTasks; // Ya filtramos completados
    const totalExpectedTasks = this.calculateExpectedCleaningTasks(
      data.cleaningTasks,
    );
    kpis.cleaningCompliance =
      totalExpectedTasks > 0
        ? (completedTasks / totalExpectedTasks) * 100
        : 100;

    // Calcular aceptación de mercancías
    const totalProducts = data.goodsReceptions.reduce(
      (sum, reception) => sum + reception.products.length,
      0,
    );
    const acceptedProducts = data.goodsReceptions.reduce(
      (sum, reception) =>
        sum + reception.products.filter((p) => p.estado === "ACCEPTED").length,
      0,
    );
    kpis.goodsAcceptanceRate =
      totalProducts > 0 ? (acceptedProducts / totalProducts) * 100 : 100;

    // Calcular tiempo de respuesta a alertas
    const resolvedAlerts = data.alerts.filter(
      (a) => a.status === "RESOLVED" || a.status === "CLOSED",
    );
    if (resolvedAlerts.length > 0) {
      const totalResponseTime = resolvedAlerts.reduce(
        (sum, alert) =>
          sum + (alert.resolvedAt.getTime() - alert.createdAt.getTime()),
        0,
      );
      kpis.alertResponseTime =
        totalResponseTime / resolvedAlerts.length / (1000 * 60); // en minutos
    }

    // Calcular cumplimiento general
    kpis.overallCompliance =
      (kpis.temperatureCompliance +
        kpis.cleaningCompliance +
        kpis.goodsAcceptanceRate) /
      3;

    return kpis;
  }

  private generateRecommendations(data: any, kpis: any): string[] {
    const recommendations: string[] = [];

    if (kpis.temperatureCompliance < 90) {
      recommendations.push(
        "⚠️ Mejorar control de temperaturas. Considera aumentar frecuencia de monitoreo.",
      );
    }

    if (kpis.cleaningCompliance < 90) {
      recommendations.push(
        "🧹 Revisar cumplimiento de planes de limpieza. Ajustar frecuencia o responsables.",
      );
    }

    if (kpis.goodsAcceptanceRate < 90) {
      recommendations.push(
        "📦 Revisar proceso de recepción de mercancías. Capacitar personal en controles.",
      );
    }

    if (kpis.alertResponseTime > 60) {
      recommendations.push(
        "⏱️ Tiempo de respuesta a alertas excesivo. Implementar sistema de notificaciones.",
      );
    }

    // Detectar tendencias
    const temperatureIssues = data.temperatures.filter((m) => !m.withinRange);
    if (temperatureIssues.length > 5) {
      recommendations.push(
        "🌡️ Múltiples incidencias de temperatura detectadas. Revisar equipos y cámaras.",
      );
    }

    return recommendations;
  }

  private async createTemperatureAlert(
    controlId: string,
    measurement: any,
  ): Promise<void> {
    const control = await this.prisma.temperatureControl.findUnique({
      where: { id: controlId },
    });

    await this.prisma.alert.create({
      data: {
        tenantId: control.tenantId,
        type: "TEMPERATURE",
        alertType: "TEMPERATURE",
        severity: measurement.withinRange ? "LOW" : "HIGH",
        message: `Temperatura ${measurement.temperature}°${control.unit} fuera de rango (${control.targetTemperature}°${control.unit} ± ${control.tolerance}°${control.unit})`,
        isResolved: false,
        createdBy: "system",
      } as any,
    });
  }

  private async createGoodsReceptionAlert(
    receptionId: string,
    rejectedProducts: any[],
  ): Promise<void> {
    const reception = await this.prisma.goodsReception.findUnique({
      where: { id: receptionId },
    });

    await this.prisma.alert.create({
      data: {
        tenantId: reception.tenantId,
        type: "GOODS_RECEPTION",
        alertType: "GOODS_RECEPTION",
        severity: "HIGH",
        message: `${rejectedProducts.length} products rechazados por temperatura fuera de rango`,
        isResolved: false,
        createdBy: "system",
      } as any,
    });
  }

  private async notifyAlertUsers(
    alertId: string,
    assigneeIds: string[],
  ): Promise<void> {
    // Crear notificaciones para usuarios asignados
    for (const userId of assigneeIds) {
      await (this.prisma as any).alertNotification?.create({
        data: {
          alertId,
          userId,
          status: "PENDING",
          sentAt: null,
          readAt: null,
        } as any,
      });
    }
  }

  private async checkCleaningPlanReminders(tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const plans = await this.prisma.cleaningPlan.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        tasks: {
          where: {
            completed: false,
          },
        },
      },
    });

    for (const plan of plans) {
      const isDueToday = this.isPlanDueToday(plan, today);

      if (isDueToday) {
        const pendingTasks = plan.tasks.filter((t) => !t.completed);

        if (pendingTasks.length > 0) {
          await this.createCleaningReminder(plan, pendingTasks);
        }
      }
    }
  }

  private isPlanDueToday(plan: any, today: Date): boolean {
    const lastExecution = plan.lastExecutionAt
      ? new Date(plan.lastExecutionAt)
      : new Date(plan.createdAt);

    const nextExecution = this.calculateNextExecution(
      plan.frequency,
      lastExecution,
    );

    return (
      nextExecution.getDate() === today.getDate() &&
      nextExecution.getMonth() === today.getMonth() &&
      nextExecution.getFullYear() === today.getFullYear()
    );
  }

  private calculateNextExecution(frequency: string, lastExecution: Date): Date {
    const next = new Date(lastExecution);

    switch (frequency) {
      case "DAILY":
        next.setDate(next.getDate() + 1);
        break;
      case "WEEKLY":
        next.setDate(next.getDate() + 7);
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      case "QUARTERLY":
        next.setMonth(next.getMonth() + 3);
        break;
    }

    return next;
  }

  private async createCleaningReminder(plan: any, tasks: any[]): Promise<void> {
    await this.prisma.alert.create({
      data: {
        tenantId: plan.tenantId,
        type: "CLEANING",
        alertType: "CLEANING",
        severity: "MEDIUM",
        message: `${tasks.length} tareas pendientes del plan "${plan.name}"`,
        isResolved: false,
        createdBy: "system",
      } as any,
    });
  }

  private isWithinRange(
    value: number,
    target: number,
    tolerance: number,
  ): boolean {
    return value >= target - tolerance && value <= target + tolerance;
  }

  private calculateExpectedCleaningTasks(completedTasks: any[]): number {
    // Estimar tareas esperadas basado en frecuencia
    const plansMap = new Map();
    completedTasks.forEach((task) => {
      if (!plansMap.has(task.planId)) {
        plansMap.set(task.planId, { completed: 0, expected: 1 });
      }
      plansMap.get(task.planId).completed++;
    });

    let totalExpected = 0;
    plansMap.forEach((data) => {
      totalExpected += data.expected;
    });

    return totalExpected;
  }
}
