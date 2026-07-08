import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { SuperadminService } from "./superadmin.service";
import { AuthGuard } from "../../guards/auth.guard";
import { SuperadminGuard } from "../../guards/superadmin.guard";
import { UpdateModuleDto } from "../modules/dto/module.dto";
import { UpdateTenantDto } from "../tenants/dto/create-tenant.dto";

@ApiTags("Superadmin")
@Controller("api/v1/superadmin")
@UseGuards(AuthGuard, SuperadminGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get("tenants")
  @ApiOperation({ summary: "Lista todos los tenants del sistema" })
  @ApiResponse({ status: 200, description: "Lista de tenants" })
  async listTenants(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.superadminService.listTenants(+page, +limit);
  }

  @Get("tenants/trashed")
  @ApiOperation({ summary: "Lista los clientes dados de baja (papelera)" })
  @ApiResponse({ status: 200, description: "Clientes en papelera" })
  async listTrashedTenants() {
    return this.superadminService.listTrashedTenants();
  }

  @Get("tenants/:tenantId/modules")
  @ApiOperation({ summary: "Obtiene los módulos activos de un tenant" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Lista de módulos" })
  @ApiResponse({ status: 404, description: "Tenant no encontrado" })
  async getTenantModules(@Param("tenantId") tenantId: string) {
    return this.superadminService.getTenantModules(tenantId);
  }

  @Patch("tenants/:tenantId/modules/:moduleId")
  @ApiOperation({ summary: "Activa o desactiva un módulo de un tenant" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiParam({ name: "moduleId", description: "ID del módulo" })
  @ApiResponse({ status: 200, description: "Módulo actualizado" })
  @ApiResponse({ status: 404, description: "Tenant o módulo no encontrado" })
  async toggleTenantModule(
    @Param("tenantId") tenantId: string,
    @Param("moduleId") moduleId: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: any,
  ) {
    return this.superadminService.toggleTenantModule(
      tenantId,
      moduleId,
      dto,
      req.user.id,
    );
  }

  @Patch("tenants/:tenantId")
  @ApiOperation({ summary: "Actualiza datos de un tenant" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Tenant actualizado" })
  async updateTenant(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.superadminService.updateTenant(tenantId, dto);
  }

  @Patch("tenants/:tenantId/restore")
  @ApiOperation({ summary: "Recupera un cliente dado de baja" })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 200, description: "Cliente recuperado" })
  @ApiResponse({
    status: 404,
    description: "Cliente no encontrado en papelera",
  })
  async restoreTenant(@Param("tenantId") tenantId: string) {
    return this.superadminService.restoreTenant(tenantId);
  }

  @Delete("tenants/:tenantId/purge")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Borra definitivamente un cliente y todos sus datos",
  })
  @ApiParam({ name: "tenantId", description: "ID del tenant" })
  @ApiResponse({ status: 204, description: "Cliente borrado permanentemente" })
  @ApiResponse({
    status: 400,
    description: "Debe darse de baja antes de purgar",
  })
  @ApiResponse({ status: 404, description: "Cliente no encontrado" })
  async purgeTenant(@Param("tenantId") tenantId: string, @Req() req: any) {
    return this.superadminService.purgeTenant(tenantId, req.user.id);
  }
}
