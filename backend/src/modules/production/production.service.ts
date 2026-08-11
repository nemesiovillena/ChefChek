import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { NotificationsService } from "../core/notifications.service";
import { WorkBatchNumberService } from "./services/work-batch-number.service";
import { ProductionOrderNumberService } from "./services/production-order-number.service";
import {
  CreateWorkBatchDto,
  CreateProductionOrderDto,
  CreateMiseEnPlaceItemDto,
  CreateMiseEnPlaceSheetDto,
  CreateProductionTaskDto,
  CreateTaskAssignmentDto,
  UpdateTaskAssignmentDto,
  CreateStaffMemberDto,
  UpdateStaffMemberDto,
  UpdateAlertDto,
  GenerateProductionReportDto,
} from "./dto/production.dto";

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly batchNumberService: WorkBatchNumberService,
    private readonly orderNumberService: ProductionOrderNumberService,
  ) {}

  // Work Batches
  async createWorkBatch(
    tenantId: string,
    userId: string,
    dto: CreateWorkBatchDto,
  ): Promise<any> {
    const batchNumber =
      await this.batchNumberService.generateBatchNumber(tenantId);
    const scheduledFor = this.combineDateAndTime(
      dto.scheduledDate,
      dto.scheduledTime,
    );

    const batch = await this.prisma.workBatch.create({
      data: {
        tenantId,
        batchNumber,
        batchType: "PREPARATION",
        status: "PLANNED",
        scheduledFor,
        priority: dto.priority,
        responsible: dto.responsible,
        kitchenZone: dto.kitchenZone,
        notes: dto.description,
        createdBy: userId,
      },
    });

    return { success: true, data: batch };
  }

  async getWorkBatches(tenantId: string): Promise<any[]> {
    return this.prisma.workBatch.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { scheduledFor: "desc" },
      include: { productionOrders: true },
    });
  }

  async getWorkBatchById(tenantId: string, batchId: string): Promise<any> {
    const batch = await this.prisma.workBatch.findFirst({
      where: { id: batchId, tenantId, deletedAt: null },
      include: {
        productionOrders: { include: { miseEnPlaceItems: true } },
      },
    });

    if (!batch) {
      throw new NotFoundException("Work batch not found");
    }

    return batch;
  }

  async completeWorkBatch(tenantId: string, batchId: string): Promise<any> {
    const existing = await this.prisma.workBatch.findFirst({
      where: { id: batchId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Work batch not found");
    }

    const batch = await this.prisma.workBatch.update({
      where: { id: batchId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await this.generateFinalReport(batchId);

    return { success: true, data: batch };
  }

  // Production Orders
  async createProductionOrder(
    tenantId: string,
    userId: string,
    dto: CreateProductionOrderDto,
  ): Promise<any> {
    const batch = await this.prisma.workBatch.findFirst({
      where: { id: dto.batchId, tenantId, deletedAt: null },
    });
    if (!batch) {
      throw new NotFoundException("Work batch not found");
    }

    const orderNumber =
      await this.orderNumberService.generateOrderNumber(tenantId);

    const order = await this.prisma.productionOrder.create({
      data: {
        tenantId,
        batchId: dto.batchId,
        title: dto.title,
        recipeId: dto.recipeId,
        recipeName: dto.recipeName,
        quantity: dto.quantity,
        unit: dto.unit,
        estimatedTime: dto.estimatedTime,
        orderNumber,
        orderType: "PREPARATION",
        status: "PENDING",
        scheduledFor: new Date(),
        description: dto.description,
        assignedStaffIds: dto.assignedStaffIds ?? [],
        createdBy: userId,
      },
    });

    return { success: true, data: order };
  }

  async getProductionOrdersByBatch(
    tenantId: string,
    batchId: string,
  ): Promise<any[]> {
    return this.prisma.productionOrder.findMany({
      where: { batchId, tenantId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { miseEnPlaceItems: true },
    });
  }

  async startProductionOrder(tenantId: string, orderId: string): Promise<any> {
    const existing = await this.prisma.productionOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Production order not found");
    }

    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    // El seguimiento de progreso/milestones/alertas de retraso solo tiene
    // sentido si la orden definió un tiempo estimado. Una tarea de texto libre
    // sin tiempo no genera hitos temporales ni puede "retrasarse".
    if (existing.estimatedTime !== null) {
      await this.initializeProgressTracking(orderId, existing.estimatedTime);
    }

    return { success: true, data: order };
  }

  async completeProductionOrder(
    tenantId: string,
    orderId: string,
    actualTime: number,
  ): Promise<any> {
    const existing = await this.prisma.productionOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Production order not found");
    }

    const order = await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: "COMPLETED", completedAt: new Date(), actualTime },
    });

    await this.updateProgressTracking(orderId, "COMPLETED");

    return { success: true, data: order };
  }

  async deleteProductionOrder(tenantId: string, orderId: string): Promise<any> {
    const existing = await this.prisma.productionOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Production order not found");
    }

    await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // Mise en Place
  async createMiseEnPlaceSheet(
    tenantId: string,
    dto: CreateMiseEnPlaceSheetDto,
  ): Promise<any> {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: dto.orderId, tenantId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException("Production order not found");
    }

    const sheet = await this.prisma.miseEnPlaceSheet.create({
      data: {
        tenantId,
        batchId: dto.batchId,
        orderId: dto.orderId,
        zone: dto.zone,
        checklists: dto.checklists.map((item) => ({
          ...item,
          checked: false,
        })) as any,
      },
    });

    return { success: true, data: sheet };
  }

  async getMiseEnPlaceSheet(tenantId: string, sheetId: string): Promise<any> {
    const sheet = await this.prisma.miseEnPlaceSheet.findFirst({
      where: { id: sheetId, tenantId },
    });

    if (!sheet) {
      throw new NotFoundException("Mise en place sheet not found");
    }

    // Los items se crean con orderId, no con sheetId (ver addMiseEnPlaceItem
    // — el DTO ni siquiera acepta sheetId), así que la relación `items` de
    // Prisma (basada en sheetId) casi siempre viene vacía. Se listan por
    // orderId, que es como realmente se asocian en la práctica.
    const items = await this.prisma.miseEnPlaceItem.findMany({
      where: { orderId: sheet.orderId, tenantId },
      orderBy: { createdAt: "asc" },
    });

    return { ...sheet, items };
  }

  /**
   * A diferencia de getMiseEnPlaceSheet (busca por id de hoja, 404 si no
   * existe), esta busca por orden y devuelve null si la orden todavía no
   * tiene hoja creada — el frontend no tiene otra forma de descubrir el
   * sheetId de una orden sin este lookup.
   */
  async getMiseEnPlaceSheetByOrder(
    tenantId: string,
    orderId: string,
  ): Promise<any> {
    const sheet = await this.prisma.miseEnPlaceSheet.findFirst({
      where: { orderId, tenantId },
      orderBy: { createdAt: "desc" },
    });
    if (!sheet) {
      return null;
    }

    const items = await this.prisma.miseEnPlaceItem.findMany({
      where: { orderId, tenantId },
      orderBy: { createdAt: "asc" },
    });

    return { ...sheet, items };
  }

  async addMiseEnPlaceItem(
    tenantId: string,
    dto: CreateMiseEnPlaceItemDto,
  ): Promise<any> {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: dto.orderId, tenantId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException("Production order not found");
    }

    const item = await this.prisma.miseEnPlaceItem.create({
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

    return { success: true, data: item };
  }

  async updateMiseEnPlaceItem(
    tenantId: string,
    itemId: string,
    status: string,
    userId?: string,
  ): Promise<any> {
    const existing = await this.prisma.miseEnPlaceItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Mise en place item not found");
    }

    const updateData: any = { status };

    if (status === "READY" || status === "VERIFIED") {
      updateData.completedAt = new Date();
    }

    if (status === "VERIFIED" && userId) {
      updateData.verifiedBy = userId;
    }

    const item = await this.prisma.miseEnPlaceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return { success: true, data: item };
  }

  async verifyMiseEnPlaceSheet(
    tenantId: string,
    sheetId: string,
    userId: string,
  ): Promise<any> {
    const existing = await this.prisma.miseEnPlaceSheet.findFirst({
      where: { id: sheetId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Mise en place sheet not found");
    }

    const sheet = await this.prisma.miseEnPlaceSheet.update({
      where: { id: sheetId },
      data: { completedAt: new Date(), verifiedBy: userId },
    });

    return { success: true, data: sheet };
  }

  // Production Tasks
  async createProductionTask(
    tenantId: string,
    dto: CreateProductionTaskDto,
  ): Promise<any> {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: dto.orderId, tenantId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException("Production order not found");
    }

    const task = await this.prisma.productionTask.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        title: dto.title,
        taskType: dto.taskType,
        estimatedTime: dto.estimatedTime,
        dependencies: dto.dependencies ?? [],
      },
    });

    return { success: true, data: task };
  }

  async getProductionTasksByOrder(
    tenantId: string,
    orderId: string,
  ): Promise<any[]> {
    return this.prisma.productionTask.findMany({
      where: { orderId, tenantId },
      orderBy: { createdAt: "asc" },
      include: { assignments: true },
    });
  }

  // Task Assignments
  async createTaskAssignment(
    tenantId: string,
    dto: CreateTaskAssignmentDto,
  ): Promise<any> {
    const task = await this.prisma.productionTask.findFirst({
      where: { id: dto.taskId, tenantId },
    });
    if (!task) {
      throw new NotFoundException("Production task not found");
    }

    const staff = await this.getStaffMemberScoped(tenantId, dto.assignedTo);
    if (!staff || !staff.isActive) {
      throw new BadRequestException("Staff member not available");
    }
    if (staff.assignedTasks >= staff.maxTasks) {
      throw new BadRequestException("Staff member at maximum capacity");
    }

    const assignment = await this.prisma.taskAssignment.create({
      data: {
        tenantId,
        taskId: dto.taskId,
        orderId: dto.orderId,
        staffMemberId: dto.assignedTo,
        status: "ASSIGNED",
        assignedAt: new Date(),
      },
    });

    await this.incrementStaffTasks(dto.assignedTo);
    await this.prisma.productionTask.update({
      where: { id: dto.taskId },
      data: { status: "ASSIGNED" },
    });

    return { success: true, data: assignment };
  }

  async getTaskAssignments(tenantId: string, orderId?: string): Promise<any[]> {
    return this.prisma.taskAssignment.findMany({
      where: { tenantId, ...(orderId ? { orderId } : {}) },
      orderBy: { assignedAt: "desc" },
    });
  }

  async updateTaskAssignment(
    tenantId: string,
    assignmentId: string,
    dto: UpdateTaskAssignmentDto,
  ): Promise<any> {
    const existing = await this.prisma.taskAssignment.findFirst({
      where: { id: assignmentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Task assignment not found");
    }

    const updateData: any = {};

    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === "COMPLETED") {
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

    if (dto.status === "COMPLETED") {
      await this.decrementStaffTasks(assignment.staffMemberId);
      await this.prisma.productionTask.update({
        where: { id: assignment.taskId },
        data: { status: "COMPLETED" },
      });
    }

    return { success: true, data: assignment };
  }

  // Staff
  async createStaffMember(
    tenantId: string,
    dto: CreateStaffMemberDto,
  ): Promise<any> {
    const staff = await this.prisma.staffMember.create({
      data: {
        tenantId,
        name: dto.name,
        role: dto.role,
        email: dto.email,
        availableHours: dto.availableHours ?? 40,
        maxTasks: dto.maxTasks ?? 10,
      },
    });

    return { success: true, data: staff };
  }

  async updateStaffMember(
    tenantId: string,
    staffId: string,
    dto: UpdateStaffMemberDto,
  ): Promise<any> {
    const existing = await this.getStaffMemberScoped(tenantId, staffId);
    if (!existing) {
      throw new NotFoundException("Staff member not found");
    }

    const staff = await this.prisma.staffMember.update({
      where: { id: staffId },
      data: dto,
    });

    return { success: true, data: staff };
  }

  async getStaffMembers(tenantId: string): Promise<any[]> {
    return this.prisma.staffMember.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async getStaffAvailable(tenantId: string, zone?: string): Promise<any[]> {
    // Nota: StaffMember no tiene columna de zona en el schema — el parámetro
    // `zone` se acepta por compatibilidad con el endpoint pero no filtra nada
    // (mismo comportamiento que la versión anterior, no es una regresión).
    void zone;

    const staffMembers = await this.prisma.staffMember.findMany({
      where: { tenantId, isActive: true },
      orderBy: { assignedTasks: "asc" },
    });

    return staffMembers.filter((m) => m.assignedTasks < m.maxTasks);
  }

  async getStaffMemberTasks(tenantId: string, staffId: string): Promise<any[]> {
    return this.prisma.taskAssignment.findMany({
      where: {
        staffMemberId: staffId,
        tenantId,
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  // Progress Tracking
  async getProgressTracking(tenantId: string, orderId: string): Promise<any> {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: {
        progressTracking: true,
        milestones: true,
        alerts: { where: { isResolved: false } },
      },
    });

    if (!order || !order.progressTracking) {
      throw new NotFoundException("Progress tracking not found");
    }

    return {
      ...order.progressTracking,
      milestones: order.milestones,
      alerts: order.alerts,
    };
  }

  async getActiveAlerts(tenantId: string): Promise<any[]> {
    return this.prisma.productionAlert.findMany({
      where: { tenantId, isResolved: false },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveAlert(
    tenantId: string,
    alertId: string,
    dto: UpdateAlertDto,
  ): Promise<any> {
    const existing = await this.prisma.productionAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Alert not found");
    }

    const alert = await this.prisma.productionAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: dto.resolvedBy,
        resolution: dto.resolution,
      },
    });

    return { success: true, data: alert };
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
        period: { startDate: dto.startDate, endDate: dto.endDate },
        kpis,
        data,
        generatedAt: new Date(),
      },
    };
  }

  // Private Helper Methods
  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours || 0, minutes || 0, 0, 0);
    return combined;
  }

  private async getStaffMemberScoped(tenantId: string, staffId: string) {
    return this.prisma.staffMember.findFirst({
      where: { id: staffId, tenantId },
    });
  }

  private async incrementStaffTasks(staffId: string): Promise<void> {
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: { assignedTasks: { increment: 1 } },
    });
  }

  private async decrementStaffTasks(staffId: string): Promise<void> {
    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: { assignedTasks: { decrement: 1 } },
    });
  }

  private async initializeProgressTracking(
    orderId: string,
    estimatedTime: number,
  ): Promise<void> {
    await this.prisma.progressTracking.create({
      data: {
        orderId,
        overallProgress: 0,
        timeElapsed: 0,
        timeRemaining: estimatedTime,
        status: "ON_SCHEDULE",
      },
    });

    await this.createMilestones(orderId, estimatedTime);
  }

  private async createMilestones(
    orderId: string,
    totalTime: number,
  ): Promise<void> {
    if (!totalTime || totalTime <= 0) {
      return;
    }
    const milestones = [
      { name: "Mise en place", percentage: 20 },
      { name: "Preparation", percentage: 40 },
      { name: "Cooking", percentage: 70 },
      { name: "Plating", percentage: 90 },
      { name: "Completion", percentage: 100 },
    ];

    const startTime = new Date();

    await this.prisma.milestone.createMany({
      data: milestones.map((milestone) => ({
        orderId,
        name: milestone.name,
        percentage: milestone.percentage,
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
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      return;
    }
    // Sin tiempo estimado no hay fila de progressTracking (startProductionOrder
    // la omite) ni presupuesto temporal del que "retrasarse" — nada que updatus.
    if (order.estimatedTime === null) {
      return;
    }

    const progress = status === "COMPLETED" ? 100 : 25;
    const timeElapsed = Math.floor(
      (Date.now() - order.createdAt.getTime()) / (1000 * 60),
    );
    const timeRemaining = Math.max(0, order.estimatedTime - timeElapsed);

    await this.prisma.progressTracking.update({
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

    if (timeElapsed > order.estimatedTime * 0.8) {
      await this.checkForDelays(orderId);
    }
  }

  private calculateStatus(
    progress: number,
    timeElapsed: number,
    estimatedTime: number,
  ): string {
    // Sin tiempo transcurrido o sin presupuesto temporal no hay eficiencia que
    // calcular — la orden está "on schedule" por defecto (evita división por 0).
    if (!estimatedTime || timeElapsed === 0) {
      return "ON_SCHEDULE";
    }
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
    const tracking = await this.prisma.progressTracking.findUnique({
      where: { orderId },
    });
    // Bug real heredado del stub original: esta condición estaba invertida
    // (`=== "DELAYED"` → return), así que un pedido realmente retrasado
    // nunca llegaba a crear la alerta — se cortaba justo antes. Corregido:
    // solo seguir si el estado ES delay/crítico.
    if (
      !tracking ||
      (tracking.status !== "DELAYED" && tracking.status !== "CRITICAL")
    ) {
      return;
    }

    // Evitar alertas duplicadas mientras el pedido siga en el mismo estado
    // de retraso sin resolver (antes no había ninguna comprobación real de
    // esto — el guard de arriba lo hacía por accidente, mal).
    const existingAlert = await this.prisma.productionAlert.findFirst({
      where: { orderId, alertType: "DELAY", isResolved: false },
    });
    if (existingAlert) {
      return;
    }

    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      return;
    }

    await this.prisma.productionAlert.create({
      data: {
        tenantId: order.tenantId,
        orderId,
        alertType: "DELAY",
        severity: tracking.status === "CRITICAL" ? "HIGH" : "MEDIUM",
        message: `Production order is ${tracking.status.toLowerCase()}`,
        createdBy: "system",
      },
    });

    await this.notificationsService.notifyProductionDelay(
      order.tenantId,
      order.orderNumber,
      order.title,
      tracking.status as "DELAYED" | "CRITICAL",
      order.id,
    );
  }

  private async generateFinalReport(batchId: string): Promise<void> {
    const batch = await this.prisma.workBatch.findUnique({
      where: { id: batchId },
      include: { productionOrders: true },
    });
    if (!batch) {
      return;
    }

    const totalOrders = batch.productionOrders.length;
    if (totalOrders === 0) {
      return;
    }

    const completedOrders = batch.productionOrders.filter(
      (o) => o.status === "COMPLETED",
    ).length;
    const avgActualTime =
      batch.productionOrders.reduce((sum, o) => sum + (o.actualTime ?? 0), 0) /
      totalOrders;
    const avgEstimatedTime =
      batch.productionOrders.reduce(
        (sum, o) => sum + (o.estimatedTime ?? 0),
        0,
      ) / totalOrders;

    await this.prisma.productionReport.create({
      data: {
        tenantId: batch.tenantId,
        batchId,
        totalOrders,
        completedOrders,
        completionRate: (completedOrders / totalOrders) * 100,
        avgActualTime,
        avgEstimatedTime,
        efficiency:
          avgActualTime > 0 ? (avgEstimatedTime / avgActualTime) * 100 : 0,
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
    const batchWhere: any = {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    };
    if (batchIds && batchIds.length > 0) {
      batchWhere.id = { in: batchIds };
    }
    if (zone) {
      batchWhere.kitchenZone = zone;
    }

    const orderWhere: any = {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    };
    if (batchIds && batchIds.length > 0) {
      orderWhere.batchId = { in: batchIds };
    }

    const [batches, orders, tasks, alerts] = await Promise.all([
      this.prisma.workBatch.findMany({
        where: batchWhere,
        include: { productionOrders: true },
      }),
      this.prisma.productionOrder.findMany({ where: orderWhere }),
      this.prisma.taskAssignment.findMany({
        where: { tenantId, assignedAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.productionAlert.findMany({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
    ]);

    return { batches, orders, tasks, alerts };
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

    const totalOrders = data.orders.length;
    const completedOrders = data.orders.filter(
      (o: any) => o.status === "COMPLETED",
    ).length;
    kpis.completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const ordersWithTimes = data.orders.filter(
      (o: any) => o.actualTime && o.estimatedTime,
    );
    if (ordersWithTimes.length > 0) {
      const totalEstimated = ordersWithTimes.reduce(
        (sum: number, o: any) => sum + o.estimatedTime,
        0,
      );
      const totalActual = ordersWithTimes.reduce(
        (sum: number, o: any) => sum + o.actualTime,
        0,
      );
      kpis.efficiency =
        totalActual > 0 ? (totalEstimated / totalActual) * 100 : 0;
    }

    const onTimeOrders = ordersWithTimes.filter(
      (o: any) => o.actualTime <= o.estimatedTime,
    ).length;
    kpis.onTimeDelivery =
      ordersWithTimes.length > 0
        ? (onTimeOrders / ordersWithTimes.length) * 100
        : 0;

    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(
      (t: any) => t.status === "COMPLETED",
    ).length;
    kpis.staffUtilization =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const tasksWithDuration = data.tasks.filter((t: any) => t.actualTime);
    if (tasksWithDuration.length > 0) {
      kpis.avgTaskDuration =
        tasksWithDuration.reduce(
          (sum: number, t: any) => sum + t.actualTime,
          0,
        ) / tasksWithDuration.length;
    }

    kpis.alertCount = data.alerts.length;

    return kpis;
  }
}
