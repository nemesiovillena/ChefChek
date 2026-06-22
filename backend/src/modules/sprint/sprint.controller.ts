import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
import { SprintService } from "./sprint.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

@ApiTags("Sprint Tracker")
@Controller("api/v1/sprints")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @Post()
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Crear nuevo sprint" })
  @ApiResponse({ status: 201, description: "Sprint creado exitosamente" })
  async createSprint(@Req() req: any, @Body() dto: any) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.sprintService.createSprint(tenantId, userId, dto);
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener todos los sprints del tenant" })
  @ApiResponse({ status: 200, description: "Lista de sprints" })
  async getAllSprints(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.sprintService.getAllSprints(tenantId);
  }

  @Get(":sprintId")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener sprint por ID" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint encontrado" })
  async getSprintById(@Req() req: any, @Param("sprintId") sprintId: string) {
    const tenantId = req.tenantId;
    return this.sprintService.getSprintById(tenantId, sprintId);
  }

  @Put(":sprintId")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Actualizar sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint actualizado" })
  async updateSprint(
    @Req() req: any,
    @Param("sprintId") sprintId: string,
    @Body() dto: any,
  ) {
    const tenantId = req.tenantId;
    return this.sprintService.updateSprint(tenantId, sprintId, dto);
  }

  @Delete(":sprintId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Eliminar sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint eliminado" })
  async deleteSprint(@Req() req: any, @Param("sprintId") sprintId: string) {
    const tenantId = req.tenantId;
    return this.sprintService.deleteSprint(tenantId, sprintId);
  }

  @Post(":sprintId/start")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Iniciar sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint iniciado" })
  async startSprint(@Req() req: any, @Param("sprintId") sprintId: string) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.sprintService.startSprint(tenantId, sprintId, userId);
  }

  @Post(":sprintId/complete")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Completar sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint completado" })
  async completeSprint(@Req() req: any, @Param("sprintId") sprintId: string) {
    const tenantId = req.tenantId;
    return this.sprintService.completeSprint(tenantId, sprintId);
  }

  @Post(":sprintId/cancel")
  @Roles("ADMIN", "USER")
  @ApiOperation({ summary: "Cancelar sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Sprint cancelado" })
  async cancelSprint(@Req() req: any, @Param("sprintId") sprintId: string) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    return this.sprintService.cancelSprint(tenantId, sprintId, userId);
  }

  @Get(":sprintId/progress")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener progreso de sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Progreso de sprint" })
  async getSprintProgress(
    @Req() req: any,
    @Param("sprintId") sprintId: string,
  ) {
    const tenantId = req.tenantId;
    return this.sprintService.getSprintProgress(tenantId, sprintId);
  }

  @Get(":sprintId/analytics")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Obtener analytics de sprint" })
  @ApiParam({ name: "sprintId", description: "ID del sprint" })
  @ApiResponse({ status: 200, description: "Analytics de sprint" })
  async getSprintAnalytics(
    @Req() req: any,
    @Param("sprintId") sprintId: string,
  ) {
    const tenantId = req.tenantId;
    return this.sprintService.getSprintAnalytics(tenantId, sprintId);
  }
}
