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
  Headers,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
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

@Controller('api/v1/production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // Work Batches
  @Post('batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createWorkBatch(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateWorkBatchDto,
  ) {
    return this.productionService.createWorkBatch(tenantId, userId, dto);
  }

  @Get('batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getWorkBatches(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.productionService.getWorkBatches(tenantId);
  }

  @Get('batches/:batchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getWorkBatchById(
    @Param('batchId') batchId: string,
  ) {
    return this.productionService.getWorkBatchById(batchId);
  }

  @Post('batches/:batchId/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async startWorkBatch(
    @Param('batchId') batchId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.productionService.startWorkBatch(batchId, userId);
  }

  @Post('batches/:batchId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async completeWorkBatch(
    @Param('batchId') batchId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.productionService.completeWorkBatch(batchId, userId);
  }

  // Production Orders
  @Post('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createProductionOrder(
    @Body() dto: CreateProductionOrderDto,
  ) {
    return this.productionService.createProductionOrder(dto);
  }

  @Get('orders/:batchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getProductionOrdersByBatch(
    @Param('batchId') batchId: string,
  ) {
    return this.productionService.getProductionOrdersByBatch(batchId);
  }

  @Post('orders/:orderId/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async startProductionOrder(
    @Param('orderId') orderId: string,
  ) {
    return this.productionService.startProductionOrder(orderId);
  }

  @Put('orders/:orderId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async completeProductionOrder(
    @Param('orderId') orderId: string,
    @Body() body: { actualTime: number },
  ) {
    return this.productionService.completeProductionOrder(orderId, body.actualTime);
  }

  // Mise en Place
  @Post('mise-en-place')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createMiseEnPlaceSheet(
    @Body() dto: CreateMiseEnPlaceSheetDto,
  ) {
    return this.productionService.createMiseEnPlaceSheet(dto);
  }

  @Get('mise-en-place/:sheetId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getMiseEnPlaceSheet(
    @Param('sheetId') sheetId: string,
  ) {
    return this.productionService.getMiseEnPlaceSheet(sheetId);
  }

  @Post('mise-en-place/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async addMiseEnPlaceItem(
    @Body() dto: CreateMiseEnPlaceItemDto,
  ) {
    return this.productionService.addMiseEnPlaceItem(dto);
  }

  @Put('mise-en-place/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async updateMiseEnPlaceItem(
    @Param('itemId') itemId: string,
    @Body() body: { status: string },
    @Headers('x-user-id') userId?: string,
  ) {
    return this.productionService.updateMiseEnPlaceItem(itemId, body.status, userId);
  }

  @Post('mise-en-place/:sheetId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async verifyMiseEnPlaceSheet(
    @Param('sheetId') sheetId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.productionService.verifyMiseEnPlaceSheet(sheetId, userId);
  }

  // Task Assignments
  @Post('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createTaskAssignment(
    @Body() dto: CreateTaskAssignmentDto,
  ) {
    return this.productionService.createTaskAssignment(dto);
  }

  @Get('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getTaskAssignments(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.productionService.getTaskAssignments(tenantId);
  }

  @Put('assignments/:assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async updateTaskAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateTaskAssignmentDto,
  ) {
    return this.productionService.updateTaskAssignment(assignmentId, dto);
  }

  @Get('staff/available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getStaffAvailable(
    @Headers('x-tenant-id') tenantId: string,
    @Query('zone') zone?: string,
  ) {
    return this.productionService.getStaffAvailable(tenantId, zone);
  }

  @Get('staff/:staffId/tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getStaffMemberTasks(
    @Param('staffId') staffId: string,
  ) {
    return this.productionService.getStaffMemberTasks(staffId);
  }

  // Progress Tracking
  @Get('progress/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getProgressTracking(
    @Param('orderId') orderId: string,
  ) {
    return this.productionService.getProgressTracking(orderId);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getActiveAlerts(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.productionService.getActiveAlerts(tenantId);
  }

  @Put('alerts/:alertId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.productionService.resolveAlert(alertId, dto);
  }

  // Reports
  @Post('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  async generateProductionReport(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: GenerateProductionReportDto,
  ) {
    return this.productionService.generateProductionReport(tenantId, dto);
  }
}