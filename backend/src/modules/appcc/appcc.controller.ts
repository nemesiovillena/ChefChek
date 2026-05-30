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
import { AppccService } from './appcc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
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
} from './dto/appcc.dto';

@Controller('api/v1/appcc')
export class AppccController {
  constructor(private readonly appccService: AppccService) {}

  // Temperature Controls
  @Post('temperature-controls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createTemperatureControl(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateTemperatureControlDto,
  ) {
    return this.appccService.createTemperatureControl(tenantId, userId, dto);
  }

  @Post('temperature-controls/:controlId/record')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async recordTemperature(
    @Param('controlId') controlId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: RecordTemperatureDto,
  ) {
    return this.appccService.recordTemperature(controlId, dto, userId);
  }

  @Get('temperature-controls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getTemperatureControls(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.appccService.getTemperatureControls(tenantId);
  }

  @Get('temperature-controls/:controlId/measurements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getTemperatureMeasurements(
    @Param('controlId') controlId: string,
  ) {
    return this.appccService.getTemperatureMeasurements(controlId);
  }

  // Cleaning Plans
  @Post('cleaning-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createCleaningPlan(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateCleaningPlanDto,
  ) {
    return this.appccService.createCleaningPlan(tenantId, userId, dto);
  }

  @Post('cleaning-plans/:planId/tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async addCleaningTask(
    @Param('planId') planId: string,
    @Body() dto: CreateCleaningTaskDto,
  ) {
    return this.appccService.addCleaningTask(planId, dto);
  }

  @Put('cleaning-tasks/:taskId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async completeCleaningTask(
    @Param('taskId') taskId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CompleteCleaningTaskDto,
  ) {
    return this.appccService.completeCleaningTask(taskId, dto, userId);
  }

  @Get('cleaning-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getCleaningPlans(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.appccService.getCleaningPlans(tenantId);
  }

  // Pest Controls
  @Post('pest-controls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createPestControl(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreatePestControlDto,
  ) {
    return this.appccService.createPestControl(tenantId, dto);
  }

  @Get('pest-controls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getPestControls(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.appccService.getPestControls(tenantId);
  }

  // Goods Reception
  @Post('goods-reception')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createGoodsReception(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateGoodsReceptionDto,
  ) {
    return this.appccService.createGoodsReception(tenantId, dto);
  }

  @Get('goods-reception')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getGoodsReceptions(
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.appccService.getGoodsReceptions(tenantId);
  }

  // Alerts
  @Post('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async createAlert(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateAlertDto,
  ) {
    return this.appccService.createAlert(tenantId, dto);
  }

  @Put('alerts/:alertId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async updateAlert(
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.appccService.updateAlert(alertId, dto);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getAlerts(
    @Headers('x-tenant-id') tenantId: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    return this.appccService.getAlerts(tenantId, { type, severity, status });
  }

  // Compliance Reports
  @Post('compliance-reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  @HttpCode(HttpStatus.OK)
  async generateComplianceReport(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: GenerateComplianceReportDto,
  ) {
    return this.appccService.generateComplianceReport(tenantId, dto);
  }

  @Get('compliance-reports/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getComplianceHistory(
    @Headers('x-tenant-id') tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.appccService.getComplianceHistory(
      tenantId,
      days ? parseInt(days) : 30,
    );
  }
}