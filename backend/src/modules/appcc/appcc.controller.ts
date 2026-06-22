import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { AppccService } from "./appcc.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
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

@Controller("api/v1/appcc")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AppccController {
  constructor(private readonly appccService: AppccService) {}

  // Temperature Controls
  @Post("temperature-controls")
  @Roles("ADMIN", "USER")
  async createTemperatureControl(
    @Req() req: any,
    @Body() dto: CreateTemperatureControlDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.appccService.createTemperatureControl(tenantId, userId, dto);
  }

  @Post("temperature-controls/:controlId/record")
  @Roles("ADMIN", "USER")
  async recordTemperature(
    @Req() req: any,
    @Param("controlId") controlId: string,
    @Body() dto: RecordTemperatureDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.appccService.recordTemperature(
      tenantId,
      controlId,
      dto,
      userId,
    );
  }

  @Get("temperature-controls")
  @Roles("ADMIN", "USER", "VIEWER")
  async getTemperatureControls(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.appccService.getTemperatureControls(tenantId);
  }

  @Get("temperature-controls/:controlId/measurements")
  @Roles("ADMIN", "USER", "VIEWER")
  async getTemperatureMeasurements(
    @Req() req: any,
    @Param("controlId") controlId: string,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.getTemperatureMeasurements(tenantId, controlId);
  }

  // Cleaning Plans
  @Post("cleaning-plans")
  @Roles("ADMIN", "USER")
  async createCleaningPlan(
    @Req() req: any,
    @Body() dto: CreateCleaningPlanDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.appccService.createCleaningPlan(tenantId, userId, dto);
  }

  @Post("cleaning-plans/:planId/tasks")
  @Roles("ADMIN", "USER")
  async addCleaningTask(
    @Req() req: any,
    @Param("planId") planId: string,
    @Body() dto: CreateCleaningTaskDto,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.addCleaningTask(tenantId, planId, dto);
  }

  @Put("cleaning-tasks/:taskId/complete")
  @Roles("ADMIN", "USER")
  async completeCleaningTask(
    @Req() req: any,
    @Param("taskId") taskId: string,
    @Body() dto: CompleteCleaningTaskDto,
  ) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.appccService.completeCleaningTask(
      tenantId,
      taskId,
      dto,
      userId,
    );
  }

  @Get("cleaning-plans")
  @Roles("ADMIN", "USER", "VIEWER")
  async getCleaningPlans(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.appccService.getCleaningPlans(tenantId);
  }

  // Pest Controls
  @Post("pest-controls")
  @Roles("ADMIN", "USER")
  async createPestControl(@Req() req: any, @Body() dto: CreatePestControlDto) {
    const tenantId = req.tenantId;
    return this.appccService.createPestControl(tenantId, dto);
  }

  @Get("pest-controls")
  @Roles("ADMIN", "USER", "VIEWER")
  async getPestControls(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.appccService.getPestControls(tenantId);
  }

  // Goods Reception
  @Post("goods-reception")
  @Roles("ADMIN", "USER")
  async createGoodsReception(
    @Req() req: any,
    @Body() dto: CreateGoodsReceptionDto,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.createGoodsReception(tenantId, dto);
  }

  @Get("goods-reception")
  @Roles("ADMIN", "USER", "VIEWER")
  async getGoodsReceptions(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.appccService.getGoodsReceptions(tenantId);
  }

  // Alerts
  @Post("alerts")
  @Roles("ADMIN", "USER")
  async createAlert(@Req() req: any, @Body() dto: CreateAlertDto) {
    const tenantId = req.tenantId;
    return this.appccService.createAlert(tenantId, dto);
  }

  @Put("alerts/:alertId")
  @Roles("ADMIN", "USER")
  async updateAlert(
    @Req() req: any,
    @Param("alertId") alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.updateAlert(tenantId, alertId, dto);
  }

  @Get("alerts")
  @Roles("ADMIN", "USER", "VIEWER")
  async getAlerts(
    @Req() req: any,
    @Query("type") type?: string,
    @Query("severity") severity?: string,
    @Query("status") status?: string,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.getAlerts(tenantId, { type, severity, status });
  }

  // Compliance Reports
  @Post("compliance-reports")
  @Roles("ADMIN", "USER")
  @HttpCode(HttpStatus.OK)
  async generateComplianceReport(
    @Req() req: any,
    @Body() dto: GenerateComplianceReportDto,
  ) {
    const tenantId = req.tenantId;
    return this.appccService.generateComplianceReport(tenantId, dto);
  }

  @Get("compliance-reports/history")
  @Roles("ADMIN", "USER", "VIEWER")
  async getComplianceHistory(@Req() req: any, @Query("days") days?: string) {
    const tenantId = req.tenantId;
    return this.appccService.getComplianceHistory(
      tenantId,
      days ? parseInt(days) : 30,
    );
  }
}
