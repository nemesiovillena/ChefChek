import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
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
  ApiQuery,
} from "@nestjs/swagger";
import { EscandallosService } from "./escandallos.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";
import { GenerateEscandalloReportDto } from "./dto/escandallos.dto";

@ApiTags("Escandallos")
@Controller("api/v1/escandallos")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("escandallos")
export class EscandallosController {
  constructor(private readonly escandallosService: EscandallosService) {}

  @Get("recipes/:recipeId/detailed-cost")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener análisis detallado de costos de receta" })
  @ApiParam({ name: "recipeId", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Análisis de costos detallado" })
  async getDetailedRecipeCost(
    @Req() req: any,
    @Param("recipeId") recipeId: string,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.getDetailedRecipeCost(tenantId, recipeId);
  }

  @Get("recipes/:recipeId/variations")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener variaciones de costos históricas" })
  @ApiParam({ name: "recipeId", description: "ID de la receta" })
  @ApiQuery({ name: "startDate", required: false, description: "Fecha inicio" })
  @ApiQuery({ name: "endDate", required: false, description: "Fecha fin" })
  @ApiResponse({ status: 200, description: "Variaciones de costos" })
  async getCostVariations(
    @Req() req: any,
    @Param("recipeId") recipeId: string,
    @Query("startDate") startDate?: Date,
    @Query("endDate") endDate?: Date,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.getCostVariations(
      tenantId,
      recipeId,
      startDate,
      endDate,
    );
  }

  @Get("recipes/:recipeId/projections")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener proyecciones de costos" })
  @ApiParam({ name: "recipeId", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Proyecciones de costos" })
  async getCostProjections(
    @Req() req: any,
    @Param("recipeId") recipeId: string,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.getCostProjections(tenantId, recipeId);
  }

  @Get("recipes/:recipeId/analysis")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener análisis completo de escandallo" })
  @ApiParam({ name: "recipeId", description: "ID de la receta" })
  @ApiResponse({ status: 200, description: "Análisis completo" })
  async getCompleteCostAnalysis(
    @Req() req: any,
    @Param("recipeId") recipeId: string,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.getCompleteCostAnalysis(tenantId, recipeId);
  }

  @Post("reports")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Generar reporte de escandallos" })
  @ApiResponse({ status: 201, description: "Reporte generado" })
  async generateEscandalloReport(
    @Req() req: any,
    @Body() dto: GenerateEscandalloReportDto,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.generateEscandalloReport(tenantId, dto);
  }

  @Post("convert-units")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Convertir unidades multi-unidad" })
  @ApiQuery({ name: "fromUnit", description: "Unidad de origen" })
  @ApiQuery({ name: "toUnit", description: "Unidad de destino" })
  @ApiQuery({ name: "quantity", description: "Cantidad" })
  @ApiQuery({ name: "productId", description: "ID del producto" })
  @ApiResponse({ status: 200, description: "Conversión completada" })
  async convertUnits(
    @Req() req: any,
    @Query("fromUnit") fromUnit: string,
    @Query("toUnit") toUnit: string,
    @Query("quantity") quantity: number,
    @Query("productId") productId: string,
  ) {
    const tenantId = req.tenantId;
    return this.escandallosService.convertUnits(
      tenantId,
      fromUnit,
      toUnit,
      quantity,
      productId,
    );
  }
}
