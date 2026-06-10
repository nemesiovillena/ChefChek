import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { DashboardService } from "./dashboard.service";
import {
  DashboardQueryDto,
  CreateAlertDto,
  ResolveAlertDto,
  AlertsQueryDto,
} from "./dto/dashboard.dto";

@ApiTags("Dashboard")
@Controller("api/v1/dashboard")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // KPIs y Métricas
  @Get("kpis")
  @ApiOperation({
    summary: "Obtener KPIs principales (costes, márgenes, stock, alertas)",
  })
  @ApiResponse({ status: 200, description: "KPIs calculados exitosamente" })
  async getKPIs(@Req() req: any) {
    return await this.dashboardService.calculateKPIs(req.tenantId);
  }

  @Get("metrics")
  @ApiOperation({ summary: "Obtener métricas del dashboard" })
  @ApiResponse({ status: 200, description: "Métricas obtenidas exitosamente" })
  async getMetrics(@Req() req: any, @Query() query: DashboardQueryDto) {
    return await this.dashboardService.getDashboardMetrics(req.tenantId, query);
  }

  @Get("metrics/cost-trend")
  @ApiOperation({ summary: "Obtener tendencia de costes por período" })
  @ApiResponse({ status: 200, description: "Tendencia de costes" })
  async getCostTrend(@Req() req: any, @Query("period") period?: string) {
    return await this.dashboardService.getCostTrend(req.tenantId, period);
  }

  @Get("metrics/menu-margin")
  @ApiOperation({ summary: "Analizar márgenes financieros de menús" })
  @ApiResponse({
    status: 200,
    description: "Análisis de márgenes con warnings",
  })
  async getMenuMarginAnalysis(@Req() req: any) {
    return await this.dashboardService.getMenuMarginAnalysis(req.tenantId);
  }

  // Alertas
  @Get("alerts")
  @ApiOperation({ summary: "Listar alertas activas" })
  @ApiResponse({ status: 200, description: "Lista de alertas" })
  async getAlerts(@Req() req: any, @Query() query: AlertsQueryDto) {
    return await this.dashboardService.getAlerts(req.tenantId, query);
  }

  @Get("alerts/stats")
  @ApiOperation({ summary: "Obtener estadísticas de alertas" })
  @ApiResponse({ status: 200, description: "Estadísticas de alertas" })
  async getAlertStats(@Req() req: any) {
    return await this.dashboardService.getAlertStats(req.tenantId);
  }

  @Post("alerts")
  @ApiOperation({ summary: "Crear alerta manual" })
  @ApiResponse({ status: 201, description: "Alerta creada exitosamente" })
  async createAlert(@Req() req: any, @Body() dto: CreateAlertDto) {
    return await this.dashboardService.createAlert(req.tenantId, dto);
  }

  @Put("alerts/:id/resolve")
  @ApiOperation({ summary: "Resolver alerta" })
  @ApiParam({ name: "id", description: "ID de la alerta" })
  @ApiResponse({ status: 200, description: "Alerta resuelta exitosamente" })
  async resolveAlert(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ResolveAlertDto,
  ) {
    return await this.dashboardService.resolveAlert(
      id,
      req.tenantId,
      req.user?.id,
      dto,
    );
  }
}
