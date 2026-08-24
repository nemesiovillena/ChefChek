import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ProductionService } from "./production.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import {
  CreateWorkBatchDto,
  UpdateWorkBatchDto,
  CreateProductionOrderDto,
  PostponeProductionOrderDto,
  ReorderProductionOrdersDto,
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

@ApiTags("Production")
@Controller("api/v1/production")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("production")
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // Work Batches
  @Post("batches")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear un lote de trabajo (work batch)" })
  @ApiResponse({ status: 201, description: "Lote creado exitosamente" })
  async createWorkBatch(@Req() req: any, @Body() dto: CreateWorkBatchDto) {
    return this.productionService.createWorkBatch(
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  @Get("batches")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todos los lotes de trabajo" })
  @ApiResponse({ status: 200, description: "Lista de lotes" })
  async getWorkBatches(@Req() req: any) {
    return this.productionService.getWorkBatches(req.tenantId);
  }

  @Get("batches/:batchId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener un lote de trabajo por ID" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote encontrado" })
  async getWorkBatchById(@Req() req: any, @Param("batchId") batchId: string) {
    return this.productionService.getWorkBatchById(req.tenantId, batchId);
  }

  @Put("batches/:batchId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar un lote de trabajo" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote actualizado" })
  async updateWorkBatch(
    @Req() req: any,
    @Param("batchId") batchId: string,
    @Body() dto: UpdateWorkBatchDto,
  ) {
    return this.productionService.updateWorkBatch(req.tenantId, batchId, dto);
  }

  @Post("batches/:batchId/complete")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Completar un lote de trabajo" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote completado" })
  async completeWorkBatch(@Req() req: any, @Param("batchId") batchId: string) {
    return this.productionService.completeWorkBatch(req.tenantId, batchId);
  }

  // Production Orders
  @Post("orders")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear una orden de producción" })
  @ApiResponse({ status: 201, description: "Orden creada exitosamente" })
  async createProductionOrder(
    @Req() req: any,
    @Body() dto: CreateProductionOrderDto,
  ) {
    return this.productionService.createProductionOrder(
      req.tenantId,
      req.user?.id,
      dto,
    );
  }

  @Get("orders/:batchId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener órdenes de producción por lote" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lista de órdenes" })
  async getProductionOrdersByBatch(
    @Req() req: any,
    @Param("batchId") batchId: string,
  ) {
    return this.productionService.getProductionOrdersByBatch(
      req.tenantId,
      batchId,
    );
  }

  @Post("orders/:orderId/start")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Iniciar una orden de producción" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Orden iniciada" })
  async startProductionOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
  ) {
    return this.productionService.startProductionOrder(req.tenantId, orderId);
  }

  @Put("orders/:orderId/complete")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Completar una orden de producción" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Orden completada" })
  async completeProductionOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() body: { actualTime: number },
  ) {
    return this.productionService.completeProductionOrder(
      req.tenantId,
      orderId,
      body.actualTime,
    );
  }

  @Patch("orders/:orderId/postpone")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Posponer una orden de producción a otra fecha" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Orden pospuesta" })
  async postponeProductionOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() dto: PostponeProductionOrderDto,
  ) {
    return this.productionService.postponeProductionOrder(
      req.tenantId,
      orderId,
      dto.scheduledFor,
    );
  }

  @Patch("orders/reorder")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Reordenar tareas de producción a mano" })
  @ApiResponse({ status: 200, description: "Orden guardado" })
  async reorderProductionOrders(
    @Req() req: any,
    @Body() dto: ReorderProductionOrdersDto,
  ) {
    return this.productionService.reorderProductionOrders(
      req.tenantId,
      dto.orderIds,
    );
  }

  @Delete("orders/:orderId")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Eliminar una orden de producción" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Orden eliminada" })
  async deleteProductionOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
  ) {
    return this.productionService.deleteProductionOrder(req.tenantId, orderId);
  }

  // Mise en Place
  @Post("mise-en-place")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear hoja de mise en place" })
  @ApiResponse({ status: 201, description: "Hoja creada exitosamente" })
  async createMiseEnPlaceSheet(
    @Req() req: any,
    @Body() dto: CreateMiseEnPlaceSheetDto,
  ) {
    return this.productionService.createMiseEnPlaceSheet(req.tenantId, dto);
  }

  @Get("mise-en-place/:sheetId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener hoja de mise en place" })
  @ApiParam({ name: "sheetId", description: "ID de la hoja" })
  @ApiResponse({ status: 200, description: "Hoja encontrada" })
  async getMiseEnPlaceSheet(
    @Req() req: any,
    @Param("sheetId") sheetId: string,
  ) {
    return this.productionService.getMiseEnPlaceSheet(req.tenantId, sheetId);
  }

  @Get("orders/:orderId/mise-en-place-sheet")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary: "Obtener la hoja de mise en place de una orden (null si no tiene)",
  })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Hoja encontrada o null" })
  async getMiseEnPlaceSheetByOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
  ) {
    return this.productionService.getMiseEnPlaceSheetByOrder(
      req.tenantId,
      orderId,
    );
  }

  @Post("mise-en-place/items")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Agregar item a hoja de mise en place" })
  @ApiResponse({ status: 201, description: "Item agregado exitosamente" })
  async addMiseEnPlaceItem(
    @Req() req: any,
    @Body() dto: CreateMiseEnPlaceItemDto,
  ) {
    return this.productionService.addMiseEnPlaceItem(req.tenantId, dto);
  }

  @Put("mise-en-place/items/:itemId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar estado de item de mise en place" })
  @ApiParam({ name: "itemId", description: "ID del item" })
  @ApiResponse({ status: 200, description: "Item actualizado" })
  async updateMiseEnPlaceItem(
    @Req() req: any,
    @Param("itemId") itemId: string,
    @Body() body: { status: string },
  ) {
    return this.productionService.updateMiseEnPlaceItem(
      req.tenantId,
      itemId,
      body.status,
      req.user?.id,
    );
  }

  @Post("mise-en-place/:sheetId/verify")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Verificar hoja de mise en place" })
  @ApiParam({ name: "sheetId", description: "ID de la hoja" })
  @ApiResponse({ status: 200, description: "Hoja verificada" })
  async verifyMiseEnPlaceSheet(
    @Req() req: any,
    @Param("sheetId") sheetId: string,
  ) {
    return this.productionService.verifyMiseEnPlaceSheet(
      req.tenantId,
      sheetId,
      req.user?.id,
    );
  }

  // Production Tasks
  @Post("tasks")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear tarea de producción" })
  @ApiResponse({ status: 201, description: "Tarea creada exitosamente" })
  async createProductionTask(
    @Req() req: any,
    @Body() dto: CreateProductionTaskDto,
  ) {
    return this.productionService.createProductionTask(req.tenantId, dto);
  }

  @Get("orders/:orderId/tasks")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar tareas de producción de una orden" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Lista de tareas" })
  async getProductionTasksByOrder(
    @Req() req: any,
    @Param("orderId") orderId: string,
  ) {
    return this.productionService.getProductionTasksByOrder(
      req.tenantId,
      orderId,
    );
  }

  // Task Assignments
  @Post("assignments")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear asignación de tarea" })
  @ApiResponse({ status: 201, description: "Asignación creada exitosamente" })
  async createTaskAssignment(
    @Req() req: any,
    @Body() dto: CreateTaskAssignmentDto,
  ) {
    return this.productionService.createTaskAssignment(req.tenantId, dto);
  }

  @Get("assignments")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar asignaciones de tareas" })
  @ApiResponse({ status: 200, description: "Lista de asignaciones" })
  async getTaskAssignments(
    @Req() req: any,
    @Query("orderId") orderId?: string,
  ) {
    return this.productionService.getTaskAssignments(req.tenantId, orderId);
  }

  @Put("assignments/:assignmentId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar asignación de tarea" })
  @ApiParam({ name: "assignmentId", description: "ID de la asignación" })
  @ApiResponse({ status: 200, description: "Asignación actualizada" })
  async updateTaskAssignment(
    @Req() req: any,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateTaskAssignmentDto,
  ) {
    return this.productionService.updateTaskAssignment(
      req.tenantId,
      assignmentId,
      dto,
    );
  }

  // Staff
  @Get("staff")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todo el personal (activo e inactivo)" })
  @ApiResponse({ status: 200, description: "Lista de personal" })
  async getStaffMembers(@Req() req: any) {
    return this.productionService.getStaffMembers(req.tenantId);
  }

  @Post("staff")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear miembro de staff" })
  @ApiResponse({ status: 201, description: "Miembro de staff creado" })
  async createStaffMember(@Req() req: any, @Body() dto: CreateStaffMemberDto) {
    return this.productionService.createStaffMember(req.tenantId, dto);
  }

  @Put("staff/:staffId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar miembro de staff" })
  @ApiParam({ name: "staffId", description: "ID del miembro del staff" })
  @ApiResponse({ status: 200, description: "Miembro de staff actualizado" })
  async updateStaffMember(
    @Req() req: any,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateStaffMemberDto,
  ) {
    return this.productionService.updateStaffMember(req.tenantId, staffId, dto);
  }

  @Get("staff/available")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener personal disponible" })
  @ApiResponse({ status: 200, description: "Lista de personal disponible" })
  async getStaffAvailable(@Req() req: any, @Query("zone") zone?: string) {
    return this.productionService.getStaffAvailable(req.tenantId, zone);
  }

  @Get("staff/:staffId/tasks")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener tareas de miembro del staff" })
  @ApiParam({ name: "staffId", description: "ID del miembro del staff" })
  @ApiResponse({ status: 200, description: "Lista de tareas" })
  async getStaffMemberTasks(
    @Req() req: any,
    @Param("staffId") staffId: string,
  ) {
    return this.productionService.getStaffMemberTasks(req.tenantId, staffId);
  }

  // Progress Tracking
  @Get("progress/:orderId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener tracking de progreso de orden" })
  @ApiParam({ name: "orderId", description: "ID de la orden" })
  @ApiResponse({ status: 200, description: "Tracking de progreso" })
  async getProgressTracking(
    @Req() req: any,
    @Param("orderId") orderId: string,
  ) {
    return this.productionService.getProgressTracking(req.tenantId, orderId);
  }

  @Get("alerts")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener alertas activas" })
  @ApiResponse({ status: 200, description: "Lista de alertas" })
  async getActiveAlerts(@Req() req: any) {
    return this.productionService.getActiveAlerts(req.tenantId);
  }

  @Put("alerts/:alertId/resolve")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Resolver alerta" })
  @ApiParam({ name: "alertId", description: "ID de la alerta" })
  @ApiResponse({ status: 200, description: "Alerta resuelta" })
  async resolveAlert(
    @Req() req: any,
    @Param("alertId") alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.productionService.resolveAlert(req.tenantId, alertId, dto);
  }

  // Reports
  @Post("reports")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generar reporte de producción" })
  @ApiResponse({ status: 200, description: "Reporte generado" })
  async generateProductionReport(
    @Req() req: any,
    @Body() dto: GenerateProductionReportDto,
  ) {
    return this.productionService.generateProductionReport(req.tenantId, dto);
  }
}
