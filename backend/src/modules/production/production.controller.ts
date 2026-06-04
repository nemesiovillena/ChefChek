import {
  Controller,
  Get,
  Post,
  Put,
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
import { Roles } from "../../decorators/roles.decorator";
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

@ApiTags("Production")
@ApiBearerAuth("JWT-auth")
@Controller("api/v1/production")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // Work Batches
  @Post("batches")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear un lote de trabajo (work batch)" })
  @ApiResponse({ status: 201, description: "Lote creado exitosamente" })
  async createWorkBatch(@Req() req: any, @Body() dto: CreateWorkBatchDto) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.productionService.createWorkBatch(tenantId, userId, dto);
  }

  @Get("batches")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar todos los lotes de trabajo" })
  @ApiResponse({ status: 200, description: "Lista de lotes" })
  async getWorkBatches(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productionService.getWorkBatches(tenantId);
  }

  @Get("batches/:batchId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener un lote de trabajo por ID" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote encontrado" })
  async getWorkBatchById(@Req() req: any, @Param("batchId") batchId: string) {
    const tenantId = req.tenantId;
    return this.productionService.getWorkBatchById(tenantId, batchId);
  }

  @Post("batches/:batchId/start")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Iniciar un lote de trabajo" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote iniciado" })
  async startWorkBatch(@Req() req: any, @Param("batchId") batchId: string) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.productionService.startWorkBatch(tenantId, batchId, userId);
  }

  @Post("batches/:batchId/complete")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Completar un lote de trabajo" })
  @ApiParam({ name: "batchId", description: "ID del lote" })
  @ApiResponse({ status: 200, description: "Lote completado" })
  async completeWorkBatch(@Req() req: any, @Param("batchId") batchId: string) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.productionService.completeWorkBatch(tenantId, batchId, userId);
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
    const tenantId = req.tenantId;
    return this.productionService.createProductionOrder(tenantId, dto);
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
    const tenantId = req.tenantId;
    return this.productionService.getProductionOrdersByBatch(tenantId, batchId);
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
    const tenantId = req.tenantId;
    return this.productionService.startProductionOrder(tenantId, orderId);
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
    const tenantId = req.tenantId;
    return this.productionService.completeProductionOrder(
      tenantId,
      orderId,
      body.actualTime,
    );
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
    const tenantId = req.tenantId;
    return this.productionService.createMiseEnPlaceSheet(tenantId, dto);
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
    const tenantId = req.tenantId;
    return this.productionService.getMiseEnPlaceSheet(tenantId, sheetId);
  }

  @Post("mise-en-place/items")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Agregar item a hoja de mise en place" })
  @ApiResponse({ status: 201, description: "Item agregado exitosamente" })
  async addMiseEnPlaceItem(
    @Req() req: any,
    @Body() dto: CreateMiseEnPlaceItemDto,
  ) {
    const tenantId = req.tenantId;
    return this.productionService.addMiseEnPlaceItem(tenantId, dto);
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
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.productionService.updateMiseEnPlaceItem(
      tenantId,
      itemId,
      body.status,
      userId,
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
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.productionService.verifyMiseEnPlaceSheet(
      tenantId,
      sheetId,
      userId,
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
    const tenantId = req.tenantId;
    return this.productionService.createTaskAssignment(tenantId, dto);
  }

  @Get("assignments")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Listar asignaciones de tareas" })
  @ApiResponse({ status: 200, description: "Lista de asignaciones" })
  async getTaskAssignments(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productionService.getTaskAssignments(tenantId);
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
    const tenantId = req.tenantId;
    return this.productionService.updateTaskAssignment(
      tenantId,
      assignmentId,
      dto,
    );
  }

  @Get("staff/available")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener personal disponible" })
  @ApiResponse({ status: 200, description: "Lista de personal disponible" })
  async getStaffAvailable(@Req() req: any, @Query("zone") zone?: string) {
    const tenantId = req.tenantId;
    return this.productionService.getStaffAvailable(tenantId, zone);
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
    const tenantId = req.tenantId;
    return this.productionService.getStaffMemberTasks(tenantId, staffId);
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
    const tenantId = req.tenantId;
    return this.productionService.getProgressTracking(tenantId, orderId);
  }

  @Get("alerts")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener alertas activas" })
  @ApiResponse({ status: 200, description: "Lista de alertas" })
  async getActiveAlerts(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.productionService.getActiveAlerts(tenantId);
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
    const tenantId = req.tenantId;
    return this.productionService.resolveAlert(tenantId, alertId, dto);
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
    const tenantId = req.tenantId;
    return this.productionService.generateProductionReport(tenantId, dto);
  }
}
