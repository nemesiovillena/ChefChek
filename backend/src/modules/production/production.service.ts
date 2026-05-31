import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkBatchDto,
  CreateProductionOrderDto,
  CreateMiseEnPlaceItemDto,
  CreateMiseEnPlaceSheetDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  UpdateAlertDto,
  GenerateProductionReportDto,
} from './dto/production.dto';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  // Work Batches
  async createWorkBatch(
    tenantId: string,
    userId: string,
    dto: CreateWorkBatchDto
  ): Promise<any> {
    const batch = await this.prisma.workBatch.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        scheduledDate: dto.scheduledDate,
        scheduledTime: dto.scheduledTime,
        priority: dto.priority,
        responsible: dto.responsible,
        kitchenZone: dto.kitchenZone,
        status: 'PENDING',
        createdBy: userId,
      },
    });

    return {
      success: true,
      data: batch,
    };
  }

  async getWorkBatches(tenantId: string): Promise<any[]> {
    return await this.prisma.workBatch.findMany({
      where: { tenantId },
      orderBy: { scheduledDate: 'desc' },
      include: {
        productionOrders: true,
      },
    });
  }

  async getWorkBatchById(batchId: string): Promise<any> {
    const batch = await this.prisma.workBatch.findUnique({
      where: { id: batchId },
      include: {
        productionOrders: {
          include: {
            miseEnPlaceItems: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Work batch not found');
    }

    return batch;
  }

  async startWorkBatch(batchId: string, userId: string): Promise<any> {
    const batch = await this.prisma.workBatch.update({
      where: { id: batchId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Initialize progress tracking for each order
    const orders = await this.prisma.productionOrder.findMany({
      where: { batchId },
    });

    for (const order of orders) {
      await this.initializeProgressTracking(order.id);
    }

    return {
      success: true,
      data: batch,
    };
  }

  async completeWorkBatch(batchId: string, userId: string): Promise<any> {
    const batch = await this.prisma.workBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
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
  async createProductionOrder(dto: CreateProductionOrderDto): Promise<any> {
    // Check ingredient availability and reserve
    for (const ingredient of dto.ingredients) {
      if (!ingredient.isAvailable) {
        throw new BadRequestException(
          `Ingredient ${ingredient.productName} is not available`
        );
      }

      // Mark as reserved
      await this.reserveIngredient(ingredient.productId, ingredient.quantity);
    }

    const order = await this.prisma.productionOrder.create({
      data: {
        batchId: dto.batchId,
        recipeId: dto.recipeId,
        recipeName: dto.recipeName,
        quantity: dto.quantity,
        unit: dto.unit,
        ingredients: dto.ingredients,
        estimatedTime: dto.estimatedTime,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      data: order,
    };
  }

  async getProductionOrdersByBatch(batchId: string): Promise<any[]> {
    return await this.prisma.productionOrder.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      include: {
        miseEnPlaceItems: true,
      },
    });
  }

  async startProductionOrder(orderId: string): Promise<any> {
    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    // Update progress tracking
    await this.updateProgressTracking(orderId, 'IN_PROGRESS');

    return {
      success: true,
      data: order,
    };
  }

  async completeProductionOrder(orderId: string, actualTime: number): Promise<any> {
    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        actualTime,
      },
    });

    // Update progress tracking
    await this.updateProgressTracking(orderId, 'COMPLETED');

    // Update inventory
    await this.updateInventory(orderId);

    return {
      success: true,
      data: order,
    };
  }

  // Mise en Place
  async createMiseEnPlaceSheet(dto: CreateMiseEnPlaceSheetDto): Promise<any> {
    const sheet = await this.prisma.miseEnPlaceSheet.create({
      data: {
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

  async getMiseEnPlaceSheet(sheetId: string): Promise<any> {
    const sheet = await this.prisma.miseEnPlaceSheet.findUnique({
      where: { id: sheetId },
      include: {
        items: true,
        qualityChecks: true,
      },
    });

    if (!sheet) {
      throw new NotFoundException('Mise en place sheet not found');
    }

    return sheet;
  }

  async addMiseEnPlaceItem(dto: CreateMiseEnPlaceItemDto): Promise<any> {
    const item = await this.prisma.miseEnPlaceItem.create({
      data: {
        orderId: dto.orderId,
        description: dto.description,
        quantity: dto.quantity,
        unit: dto.unit,
        status: 'PENDING',
        notes: dto.notes,
      },
    });

    return {
      success: true,
      data: item,
    };
  }

  async updateMiseEnPlaceItem(itemId: string, status: string, userId?: string): Promise<any> {
    const updateData: any = { status };

    if (status === 'READY' || status === 'VERIFIED') {
      updateData.completedAt = new Date();
    }

    if (status === 'VERIFIED' && userId) {
      updateData.verifiedBy = userId;
    }

    const item = await this.prisma.miseEnPlaceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return {
      success: true,
      data: item,
    };
  }

  async verifyMiseEnPlaceSheet(sheetId: string, userId: string): Promise<any> {
    const sheet = await this.prisma.miseEnPlaceSheet.update({
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
  async createTaskAssignment(dto: CreateTaskAssignmentDto): Promise<any> {
    // Check staff availability and capacity
    const staff = await this.getStaffMember(dto.assignedTo);
    if (!staff || !staff.availability) {
      throw new BadRequestException('Staff member not available');
    }

    if (staff.currentTasks >= staff.maxTasks) {
      throw new BadRequestException('Staff member at maximum capacity');
    }

    const assignment = await this.prisma.taskAssignment.create({
      data: {
        batchId: dto.batchId,
        orderId: dto.orderId,
        taskId: dto.taskId,
        assignedTo: dto.assignedTo,
        taskType: dto.taskType,
        estimatedTime: dto.estimatedTime,
        status: 'ASSIGNED',
        assignedAt: new Date(),
        dependencies: dto.dependencies || [],
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
    return await this.prisma.taskAssignment.findMany({
      where: {
        batch: {
          tenantId,
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async updateTaskAssignment(
    assignmentId: string,
    dto: UpdateTaskAssignmentDto
  ): Promise<any> {
    const updateData: any = {};

    if (dto.status) {
      updateData.status = dto.status;

      if (dto.status === 'IN_PROGRESS') {
        updateData.startedAt = new Date();
      } else if (dto.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    if (dto.actualTime) {
      updateData.actualTime = dto.actualTime;
    }

    const assignment = await this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: updateData,
    });

    // If completed, decrement staff tasks
    if (dto.status === 'COMPLETED') {
      await this.decrementStaffTasks(assignment.assignedTo);
    }

    return {
      success: true,
      data: assignment,
    };
  }

  async getStaffAvailable(tenantId: string, zone?: string): Promise<any[]> {
    const where: any = {
      tenantId,
      availability: true,
      currentTasks: {
        lt: this.prisma.staffMember.fields.maxTasks,
      },
    };

    if (zone) {
      where.kitchenZone = zone;
    }

    return await this.prisma.staffMember.findMany({
      where,
      orderBy: { currentTasks: 'asc' },
    });
  }

  async getStaffMemberTasks(staffId: string): Promise<any[]> {
    return await this.prisma.taskAssignment.findMany({
      where: {
        assignedTo: staffId,
        status: {
          in: ['ASSIGNED', 'IN_PROGRESS'],
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // Progress Tracking
  async getProgressTracking(orderId: string): Promise<any> {
    const tracking = await this.prisma.progressTracking.findUnique({
      where: { orderId },
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
      throw new NotFoundException('Progress tracking not found');
    }

    return tracking;
  }

  async getActiveAlerts(tenantId: string): Promise<any[]> {
    return await this.prisma.productionAlert.findMany({
      where: {
        order: {
          batch: {
            tenantId,
          },
        },
        resolvedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveAlert(alertId: string, dto: UpdateAlertDto): Promise<any> {
    const alert = await this.prisma.productionAlert.update({
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
    dto: GenerateProductionReportDto
  ): Promise<any> {
    const data = await this.collectProductionData(
      tenantId,
      dto.startDate,
      dto.endDate,
      dto.batchIds,
      dto.zone
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
  private async reserveIngredient(productId: string, quantity: number): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        reservedStock: {
          increment: quantity,
        },
      },
    });
  }

  private async initializeProgressTracking(orderId: string): Promise<void> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    await this.prisma.progressTracking.create({
      data: {
        orderId,
        overallProgress: 0,
        timeElapsed: 0,
        timeRemaining: order.estimatedTime,
        status: 'ON_SCHEDULE',
      },
    });

    // Create initial milestones
    await this.createMilestones(orderId, order.estimatedTime);
  }

  private async createMilestones(orderId: string, totalTime: number): Promise<void> {
    const milestones = [
      { name: 'Mise en place', percentage: 20 },
      { name: 'Preparation', percentage: 40 },
      { name: 'Cooking', percentage: 70 },
      { name: 'Plating', percentage: 90 },
      { name: 'Completion', percentage: 100 },
    ];

    const startTime = new Date();

    for (const milestone of milestones) {
      const scheduledTime = new Date(startTime.getTime() + (totalTime * milestone.percentage) / 100 * 60 * 1000);

      await this.prisma.milestone.create({
        data: {
          orderId,
          name: milestone.name,
          scheduledTime,
          status: 'PENDING',
        },
      });
    }
  }

  private async updateProgressTracking(orderId: string, status: string): Promise<void> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) return;

    let progress = 0;
    if (status === 'IN_PROGRESS') {
      progress = 25;
    } else if (status === 'COMPLETED') {
      progress = 100;
    }

    const timeElapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60));
    const timeRemaining = Math.max(0, order.estimatedTime - timeElapsed);

    await this.prisma.progressTracking.update({
      where: { orderId },
      data: {
        overallProgress: progress,
        timeElapsed,
        timeRemaining,
        status: this.calculateStatus(progress, timeElapsed, order.estimatedTime),
      },
    });

    // Check for delays and create alerts
    if (timeElapsed > order.estimatedTime * 0.8) {
      await this.checkForDelays(orderId);
    }
  }

  private calculateStatus(progress: number, timeElapsed: number, estimatedTime: number): string {
    const efficiency = progress / ((timeElapsed / estimatedTime) * 100);

    if (efficiency < 0.7) return 'CRITICAL';
    if (efficiency < 0.9) return 'DELAYED';
    if (efficiency > 1.1) return 'AHEAD';
    return 'ON_SCHEDULE';
  }

  private async checkForDelays(orderId: string): Promise<void> {
    const tracking = await this.prisma.progressTracking.findUnique({
      where: { orderId },
    });

    if (!tracking || tracking.status === 'DELAYED' || tracking.status === 'CRITICAL') {
      return;
    }

    // Create alert if significant delay detected
    await this.prisma.productionAlert.create({
      data: {
        orderId,
        type: 'DELAY',
        severity: tracking.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        message: `Production order is ${tracking.status.toLowerCase()}`,
        createdAt: new Date(),
      },
    });
  }

  private async updateInventory(orderId: string): Promise<void> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) return;

    for (const ingredient of order.ingredients) {
      await this.prisma.product.update({
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
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        currentTasks: {
          increment: 1,
        },
      },
    });
  }

  private async decrementStaffTasks(staffId: string): Promise<void> {
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        currentTasks: {
          decrement: 1,
        },
      },
    });
  }

  private async getStaffMember(staffId: string): Promise<any> {
    return await this.prisma.staffMember.findUnique({
      where: { id: staffId },
    });
  }

  private async generateFinalReport(batchId: string): Promise<void> {
    const batch = await this.prisma.workBatch.findUnique({
      where: { id: batchId },
      include: {
        productionOrders: true,
      },
    });

    if (!batch) return;

    // Calculate completion statistics
    const totalOrders = batch.productionOrders.length;
    const completedOrders = batch.productionOrders.filter((o) => o.status === 'COMPLETED').length;
    const avgActualTime = batch.productionOrders.reduce((sum, o) => sum + (o.actualTime || 0), 0) / totalOrders;
    const avgEstimatedTime = batch.productionOrders.reduce((sum, o) => sum + o.estimatedTime, 0) / totalOrders;

    // Save production report
    await this.prisma.productionReport.create({
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
    zone?: string
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

    data.batches = await this.prisma.workBatch.findMany({
      where,
      include: {
        productionOrders: true,
      },
    });

    data.orders = await this.prisma.productionOrder.findMany({
      where,
    });

    data.tasks = await this.prisma.taskAssignment.findMany({
      where,
    });

    data.alerts = await this.prisma.productionAlert.findMany({
      where,
    });

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
    const completedOrders = data.orders.filter((o) => o.status === 'COMPLETED').length;
    kpis.completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Efficiency
    const ordersWithTimes = data.orders.filter((o) => o.actualTime && o.estimatedTime);
    if (ordersWithTimes.length > 0) {
      const totalEstimated = ordersWithTimes.reduce((sum, o) => sum + o.estimatedTime, 0);
      const totalActual = ordersWithTimes.reduce((sum, o) => sum + o.actualTime, 0);
      kpis.efficiency = (totalEstimated / totalActual) * 100;
    }

    // On-time delivery (orders completed within estimated time)
    const onTimeOrders = ordersWithTimes.filter((o) => o.actualTime <= o.estimatedTime).length;
    kpis.onTimeDelivery = ordersWithTimes.length > 0 ? (onTimeOrders / ordersWithTimes.length) * 100 : 0;

    // Staff utilization
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((t) => t.status === 'COMPLETED').length;
    kpis.staffUtilization = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Average task duration
    const tasksWithDuration = data.tasks.filter((t) => t.actualTime);
    if (tasksWithDuration.length > 0) {
      kpis.avgTaskDuration = tasksWithDuration.reduce((sum, t) => sum + t.actualTime, 0) / tasksWithDuration.length;
    }

    // Alert count
    kpis.alertCount = data.alerts.length;

    return kpis;
  }
}