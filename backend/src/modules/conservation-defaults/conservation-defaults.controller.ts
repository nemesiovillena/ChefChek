import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { ConservationDefaultsService } from "./conservation-defaults.service";
import { ConservationDefaultsDto } from "./dto/conservation-defaults.dto";

/**
 * Defaults de conservación/vida útil por tenant. Los lee cualquier usuario
 * (alimentan el autorrelleno de Recetas y Artículos); los edita un
 * administrador desde Ajustes.
 */
@Controller("api/v1/conservation-defaults")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ConservationDefaultsController {
  constructor(private readonly service: ConservationDefaultsService) {}

  @Get()
  async getDefaults(@Req() req: any) {
    return this.service.getDefaults(req.tenantId);
  }

  @Put()
  @Roles("ADMIN", "OWNER", "SUPERADMIN")
  async setDefaults(@Req() req: any, @Body() dto: ConservationDefaultsDto) {
    return this.service.setDefaults(req.tenantId, dto, req.user.id);
  }
}
