import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CreateWorkBatchDto,
  CreateProductionOrderDto,
  CreateMiseEnPlaceItemDto,
  CreateMiseEnPlaceSheetDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  UpdateAlertDto,
  GenerateProductionReportDto,
} from "./dto/production.dto";

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  // Work Batches
  async createWorkBatch(
    tenantId: string,
    userId: string,
    dto: CreateWorkBatchDto,
  ): Promise<any> {
    const batch = await this.prisma.workBatch.create({
      data: {
        tenantId,
        batchNumber: dto.name,
        batchType: "PREPARATION",
        status: "PENDING",
        scheduledFor: new Date(`${dto.scheduledDate} ${dto.scheduledTime}`),
        createdBy: userId,
      } as any,
    });

    return {
      success: true,
      data: batch,
    };
  }

  async getWorkBatches(tenantId: string): Promise<any[]> {
    return await (this.prisma as any).workBatch.findMany({
      where: { tenantId },
      orderBy: { scheduledDate: "desc" },
      include: {
        productionOrders: true,
      },
    });
  }

  async getWorkBatchById(tenantId: string, batchId: string): Promise<any> {
    const batch = await (this.prisma as any).workBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        productionOrders: {
          include: {
            miseEnPlaceItems: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException("Work batch not found");
    }

    return batch;
  }

  async startWorkBatch(
    tenantId: string,
    batchId: string,
    userId: string,
  ): Promise<any> {
    const existing = await (this.prisma as any).workBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Work batch not found");
    }

    const batch = await this.prisma.workBatch.update({
      where: { id: batchId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    // OPTIMIZED: Fetch orders with estimatedTime in one query
    const orders = await (this.prisma as any).productionOrder.findMany({
      where: { batchId },
      select: { id: true, estimatedTime: true },
    });

    // OPTIMIZED: Batch create progress tracking and milestones
    await Promise.all(
      orders.map((order: { id: string; estimatedTime: number }) =>
        this.initializeProgressTrackingBatch(order.id, order.estimatedTime),
      ),
    );

    return {
      success: true,
      data: batch,
    };
  }

  async completeWorkBatch(
    tenantId: string,
    batchId: string,
    userId: string,
  ): Promise<any> {
    const existing = await (this.prisma as any).workBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Work batch not found");
    }

    const batch = await this.prisma.workBatch.update({
      where: { id: batchId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Generate final production report
    await this.generateFinalReport(batchId);

    return {
      success: true,
      data: batch,
    };
  }

  // Production Orders
  async createProductionOrder(
    tenantId: string,
    dto: CreateProductionOrderDto,
  ): Promise<any> {
    // Check ingredient availability and reserve
    for (const ingredient of dto.ingredients) {
      if (!ingredient.isAvailable) {
        throw new BadRequestException(
          `Ingredient ${ingredient.productName} is not available`,
        );
      }

      // Mark as reserved
      await this.reserveIngredient(ingredient.productId, ingredient.quantity);
    }

    const order = await (this.prisma as any).productionOrder.create({
      data: {
        tenantId,
        orderNumber: `PO-${Date.now()}`,
        orderType: "PREPARATION",
        status: "PENDING",
        scheduledFor: new Date(),
        items: dto.ingredients,
        miseEnPlaceItems: dto.ingredients,
        notes: (dto as any).notes || "",
        createdBy: "system",
      } as any,
    });

    return {
      success: true,
      data: order,
    };
  }

  async getProductionOrdersByBatch(
    tenantId: string,
    batchId: string,
  ): Promise<any[]> {
    return await (this.prisma as any).productionOrder.findMany({
      where: { batchId, batch: { tenantId } },
      orderBy: { createdAt: "asc" },
      include: {
        miseEnPlaceItems: true,
      },
    });
  }

  async startProductionOrder(tenantId: string, orderId: string): Promise<any> {
    const existing = await (this.prisma as any).productionOrder.findFirst({
      where: { id: orderId, batch: { tenantId } },
    });
    if (!existing) {
      throw new NotFoundException("Production order not found");
    }

    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: "IN_PROGRESS",
      },
    });

    // Update progress tracking
    await this.updateProgressTracking(orderId, "IN_PROGRESS");

    return {
      success: true,
      data: order,
    };
  }

  async completeProductionOrder(
    tenantId: string,
    orderId: string,
    actualTime: number,
  ): Promise<any> {
    const existing = await (this.prisma as any).productionOrder.findFirst({
      where: { id: orderId, batch: { tenantId } },
    });
    if (!existing) {
      throw new NotFoundException("Production order not found");
    }

    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        actualTime,
      },
    });

    // Update progress tracking
    await this.updateProgressTracking(orderId, "COMPLETED");

    // Update inventory
    await this.updateInventory(orderId);

    return {
      success: true,
      data: order,
    };
  }

  // Mise en Place
  async createMiseEnPlaceSheet(
    tenantId: string,
    dto: CreateMiseEnPlaceSheetDto,
  ): Promise<any> {
    const sheet = await (this.prisma as any).miseEnPlaceSheet.create({
      data: {
        tenantId,
        batchId: dto.batchId,
        orderId: dto.orderId,
        zone: dto.zone,
        checklists: dto.checklists.map((item) => ({
          ...item,
          checked: false,
        })),
      },
    });

    return {
      success: true,
      data: sheet,
    };
  }

  async getMiseEnPlaceSheet(tenantId: string, sheetId: string): Promise<any> {
    const sheet = await (this.prisma as any).miseEnPlaceSheet.findFirst({
      where: { id: sheetId, tenantId },
      include: {
        items: true,
        qualityChecks: true,
      },
    });

    if (!sheet) {
      throw new NotFoundException("Mise en place sheet not found");
    }

    return sheet;
  }

  async addMiseEnPlaceItem(
    tenantId: string,
    dto: CreateMiseEnPlaceItemDto,
  ): Promise<any> {
    const item = await (this.prisma as any).miseEnPlaceItem.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        description: dto.description,
        quantity: dto.quantity,
        unit: dto.unit,
        status: "PENDING",
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: item,
    };
  }

  async updateMiseEnPlaceItem(
    tenantId: string,
    itemId: string,
    status: string,
    userId?: string,
  ): Promise<any> {
    const updateData: any = { status };

    if (status === "READY" || status === "VERIFIED") {
      updateData.completedAt = new Date();
    }

    if (status === "VERIFIED" && userId) {
      updateData.verifiedBy = userId;
    }

    const item = await (this.prisma as any).miseEnPlaceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return {
      success: true,
      data: item,
    };
  }

  async verifyMiseEnPlaceSheet(
    tenantId: string,
    sheetId: string,
    userId: string,
  ): Promise<any> {
    const existing = await (this.prisma as any).miseEnPlaceSheet.findFirst({
      where: { id: sheetId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Mise en place sheet not found");
    }

    const sheet = await (this.prisma as any).miseEnPlaceSheet.update({
      where: { id: sheetId },
      data: {
        completedAt: new Date(),
        verifiedBy: userId,
      },
    });

    return {
      success: true,
      data: sheet,
    };
  }

  // Task Assignments
  async createTaskAssignment(
    tenantId: string,
    dto: CreateTaskAssignmentDto,
  ): Promise<any> {
    // Check staff availability and capacity
    const staff = await this.getStaffMember(dto.assignedTo);
    if (!staff || !staff.isActive) {
      throw new BadRequestException("Staff member not available");
    }

    if (staff.assignedTasks >= staff.maxTasks) {
      throw new BadRequestException("Staff member at maximum capacity");
    }

    const assignment = await (this.prisma as any).taskAssignment.create({
      data: {
        tenantId,
        batchId: dto.batchId,
        taskId: dto.taskId,
        staffMemberId: dto.assignedTo,
        status: "ASSIGNED",
        assignedAt: new Date(),
      },
    });

    // Increment staff current tasks
    await this.incrementStaffTasks(dto.assignedTo);

    return {
      success: true,
      data: assignment,
    };
  }

  async getTaskAssignments(tenantId: string): Promise<any[]> {
    return await (this.prisma as any).taskAssignment.findMany({
      where: {
        tenantId,
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  async updateTaskAssignment(
    tenantId: string,
    assignmentId: string,
    dto: UpdateTaskAssignmentDto,
  ): Promise<any> {
    const updateData: any = {};

    if (dto.status) {
      updateData.status = dto.status;

      if (dto.status === "IN_PROGRESS") {
        updateData.startedAt = new Date();
      } else if (dto.status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }

    if (dto.actualTime) {
      updateData.actualTime = dto.actualTime;
    }

    const assignment = await (this.prisma as any).taskAssignment.update({
      where: { id: assignmentId },
      data: updateData,
    });

    // If completed, decrement staff tasks
    if (dto.status === "COMPLETED") {
      await this.decrementStaffTasks(assignment.staffMemberId);
    }

    return {
      success: true,
      data: assignment,
    };
  }

  async getStaffAvailable(tenantId: string, zone?: string): Promise<any[]> {
    const where: any = {
      tenantId,
      isActive: true,
    };

    const staffMembers = await (this.prisma as any).staffMember.findMany({
      where,
      orderBy: { assignedTasks: "asc" },
    });

    // Filtrar en memoria por capacidad (assignedTasks < maxTasks)
    return staffMembers.filter((m: any) => m.assignedTasks < m.maxTasks);
  }

  async getStaffMemberTasks(tenantId: string, staffId: string): Promise<any[]> {
    return await (this.prisma as any).taskAssignment.findMany({
      where: {
        staffMemberId: staffId,
        tenantId,
        status: {
          in: ["ASSIGNED", "IN_PROGRESS"],
        },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  // Progress Tracking
  async getProgressTracking(tenantId: string, orderId: string): Promise<any> {
    const tracking = await (this.prisma as any).progressTracking.findFirst({
      where: { orderId, order: { batch: { tenantId } } },
      include: {
        milestones: true,
        alerts: {
          where: {
            resolvedAt: null,
          },
        },
      },
    });

    if (!tracking) {
      throw new NotFoundException("Progress tracking not found");
    }

    return tracking;
  }

  async getActiveAlerts(tenantId: string): Promise<any[]> {
    return await (this.prisma as any).productionAlert.findMany({
      where: {
        order: {
          batch: {
            tenantId,
          },
        },
        resolvedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveAlert(
    tenantId: string,
    alertId: string,
    dto: UpdateAlertDto,
  ): Promise<any> {
    const existing = await (this.prisma as any).productionAlert.findFirst({
      where: { id: alertId, order: { batch: { tenantId } } },
    });
    if (!existing) {
      throw new NotFoundException("Alert not found");
    }

    const alert = await (this.prisma as any).productionAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        resolvedBy: dto.resolvedBy,
        resolution: dto.resolution,
      },
    });

    return {
      success: true,
      data: alert,
    };
  }

  // Reports
  async generateProductionReport(
    tenantId: string,
    dto: GenerateProductionReportDto,
  ): Promise<any> {
    const data = await this.collectProductionData(
      tenantId,
      dto.startDate,
      dto.endDate,
      dto.batchIds,
      dto.zone,
    );

    const kpis = this.calculateProductionKPIs(data);

    return {
      success: true,
      data: {
        period: {
          startDate: dto.startDate,
          endDate: dto.endDate,
        },
        kpis,
        data,
        generatedAt: new Date(),
      },
    };
  }

  // Private Helper Methods
  private async reserveIngredient(
    productId: string,
    quantity: number,
  ): Promise<void> {
    await (this.prisma as any).product.update({
      where: { id: productId },
      data: {
        reservedStock: {
          increment: quantity,
        },
      },
    });
  }

  private async initializeProgressTrackingBatch(
    orderId: string,
    estimatedTime: number,
  ): Promise<void> {
    await (this.prisma as any).progressTracking.create({
      data: {
        orderId,
        overallProgress: 0,
        timeElapsed: 0,
        timeRemaining: estimatedTime,
        status: "ON_SCHEDULE",
      },
    });

    // OPTIMIZED: Batch create milestones with createMany
    await this.createMilestonesBatch(orderId, estimatedTime);
  }

  private async createMilestonesBatch(
    orderId: string,
    totalTime: number,
  ): Promise<void> {
    const milestones = [
      { name: "Mise en place", percentage: 20 },
      { name: "Preparation", percentage: 40 },
      { name: "Cooking", percentage: 70 },
      { name: "Plating", percentage: 90 },
      { name: "Completion", percentage: 100 },
    ];

    const startTime = new Date();

    // OPTIMIZED: Batch create milestones with createMany
    await (this.prisma as any).milestone?.createMany({
      data: milestones.map((milestone) => ({
        orderId,
        name: milestone.name,
        scheduledTime: new Date(
          startTime.getTime() +
            ((totalTime * milestone.percentage) / 100) * 60 * 1000,
        ),
        status: "PENDING",
      })),
    });
  }

  private async updateProgressTracking(
    orderId: string,
    status: string,
  ): Promise<void> {
    const order = await (this.prisma as any).productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return;
    }

    let progress = 0;
    if (status === "IN_PROGRESS") {
      progress = 25;
    } else if (status === "COMPLETED") {
      progress = 100;
    }

    const timeElapsed = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60),
    );
    const timeRemaining = Math.max(0, order.estimatedTime - timeElapsed);

    await (this.prisma as any).progressTracking.update({
      where: { orderId },
      data: {
        overallProgress: progress,
        timeElapsed,
        timeRemaining,
        status: this.calculateStatus(
          progress,
          timeElapsed,
          order.estimatedTime,
        ),
      },
    });

    // Check for delays and create alerts
    if (timeElapsed > order.estimatedTime * 0.8) {
      await this.checkForDelays(orderId);
    }
  }

  private calculateStatus(
    progress: number,
    timeElapsed: number,
    estimatedTime: number,
  ): string {
    const efficiency = progress / ((timeElapsed / estimatedTime) * 100);

    if (efficiency < 0.7) {
      return "CRITICAL";
    }
    if (efficiency < 0.9) {
      return "DELAYED";
    }
    if (efficiency > 1.1) {
      return "AHEAD";
    }
    return "ON_SCHEDULE";
  }

  private async checkForDelays(orderId: string): Promise<void> {
    const tracking = await (this.prisma as any).progressTracking.findUnique({
      where: { orderId },
    });

    if (
      !tracking ||
      tracking.status === "DELAYED" ||
      tracking.status === "CRITICAL"
    ) {
      return;
    }

    // Create alert if significant delay detected
    await (this.prisma as any).productionAlert.create({
      data: {
        orderId,
        type: "DELAY",
        severity: tracking.status === "CRITICAL" ? "HIGH" : "MEDIUM",
        message: `Production order is ${tracking.status.toLowerCase()}`,
        createdAt: new Date(),
      },
    });
  }

  private async updateInventory(orderId: string): Promise<void> {
    const order = await (this.prisma as any).productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return;
    }

    for (const ingredient of order.ingredients) {
      await (this.prisma as any).product.update({
        where: { id: ingredient.productId },
        data: {
          stock: {
            decrement: ingredient.quantity * order.quantity,
          },
          reservedStock: {
            decrement: ingredient.quantity * order.quantity,
          },
        },
      });
    }
  }

  private async incrementStaffTasks(staffId: string): Promise<void> {
    await (this.prisma as any).staffMember.update({
      where: { id: staffId },
      data: {
        assignedTasks: {
          increment: 1,
        },
      },
    });
  }

  private async decrementStaffTasks(staffId: string): Promise<void> {
    await (this.prisma as any).staffMember.update({
      where: { id: staffId },
      data: {
        assignedTasks: {
          decrement: 1,
        },
      },
    });
  }

  private async getStaffMember(staffId: string): Promise<any> {
    return await (this.prisma as any).staffMember.findUnique({
      where: { id: staffId },
    });
  }

  private async generateFinalReport(batchId: string): Promise<void> {
    const batch = await (this.prisma as any).workBatch.findUnique({
      where: { id: batchId },
      include: {
        productionOrders: true,
      },
    });

    if (!batch) {
      return;
    }

    // Calculate completion statistics
    const totalOrders = batch.productionOrders.length;
    const completedOrders = batch.productionOrders.filter(
      (o) => o.status === "COMPLETED",
    ).length;
    const avgActualTime =
      batch.productionOrders.reduce((sum, o) => sum + (o.actualTime || 0), 0) /
      totalOrders;
    const avgEstimatedTime =
      batch.productionOrders.reduce((sum, o) => sum + o.estimatedTime, 0) /
      totalOrders;

    // Save production report
    await (this.prisma as any).productionReport?.create({
      data: {
        tenantId: batch.tenantId,
        batchId,
        totalOrders,
        completedOrders,
        completionRate: (completedOrders / totalOrders) * 100,
        avgActualTime,
        avgEstimatedTime,
        efficiency: (avgEstimatedTime / avgActualTime) * 100,
        generatedAt: new Date(),
      },
    });
  }

  private async collectProductionData(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    batchIds?: string[],
    zone?: string,
  ): Promise<any> {
    const where: any = {
      batch: {
        tenantId,
      },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (batchIds && batchIds.length > 0) {
      where.batchId = {
        in: batchIds,
      };
    }

    if (zone) {
      where.batch = {
        ...where.batch,
        kitchenZone: zone,
      };
    }

    const data: any = {};

    // OPTIMIZED: Run queries in parallel instead of sequentially
    const [batches, orders, tasks, alerts] = await Promise.all([
      (this.prisma as any).workBatch.findMany({
        where,
        include: {
          productionOrders: true,
        },
      }),
      (this.prisma as any).productionOrder.findMany({
        where,
      }),
      (this.prisma as any).taskAssignment.findMany({
        where,
      }),
      (this.prisma as any).productionAlert.findMany({
        where,
      }),
    ]);

    data.batches = batches;
    data.orders = orders;
    data.tasks = tasks;
    data.alerts = alerts;

    return data;
  }

  private calculateProductionKPIs(data: any): any {
    const kpis: any = {
      completionRate: 0,
      efficiency: 0,
      onTimeDelivery: 0,
      staffUtilization: 0,
      avgTaskDuration: 0,
      alertCount: 0,
    };

    // Completion rate
    const totalOrders = data.orders.length;
    const completedOrders = data.orders.filter(
      (o) => o.status === "COMPLETED",
    ).length;
    kpis.completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Efficiency
    const ordersWithTimes = data.orders.filter(
      (o) => o.actualTime && o.estimatedTime,
    );
    if (ordersWithTimes.length > 0) {
      const totalEstimated = ordersWithTimes.reduce(
        (sum, o) => sum + o.estimatedTime,
        0,
      );
      const totalActual = ordersWithTimes.reduce(
        (sum, o) => sum + o.actualTime,
        0,
      );
      kpis.efficiency = (totalEstimated / totalActual) * 100;
    }

    // On-time delivery (orders completed within estimated time)
    const onTimeOrders = ordersWithTimes.filter(
      (o) => o.actualTime <= o.estimatedTime,
    ).length;
    kpis.onTimeDelivery =
      ordersWithTimes.length > 0
        ? (onTimeOrders / ordersWithTimes.length) * 100
        : 0;

    // Staff utilization
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(
      (t) => t.status === "COMPLETED",
    ).length;
    kpis.staffUtilization =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Average task duration
    const tasksWithDuration = data.tasks.filter((t) => t.actualTime);
    if (tasksWithDuration.length > 0) {
      kpis.avgTaskDuration =
        tasksWithDuration.reduce((sum, t) => sum + t.actualTime, 0) /
        tasksWithDuration.length;
    }

    // Alert count
    kpis.alertCount = data.alerts.length;

    return kpis;
  }
}
