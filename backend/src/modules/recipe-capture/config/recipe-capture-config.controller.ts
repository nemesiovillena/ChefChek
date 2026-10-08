import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { RecipeCaptureConfigService } from "./recipe-capture-config.service";
import { RecipeCaptureConfigDto } from "./dto/recipe-capture-config.dto";
import { AuthGuard } from "../../../guards/auth.guard";
import { TenantGuard } from "../../../guards/tenant.guard";
import { RolesGuard } from "../../../guards/roles.guard";
import { Roles } from "../../../decorators/roles.decorator";

/**
 * Configuración del modelo IA de la Captura de recetas, por tenant. La lee
 * cualquier usuario del tenant (para mostrarla en Ajustes); la editan roles
 * administradores, igual que la del asistente o el motor OCR.
 */
@Controller("api/v1/recipe-capture-config")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class RecipeCaptureConfigController {
  constructor(private readonly configService: RecipeCaptureConfigService) {}

  @Get()
  @Roles("ADMIN", "OWNER", "SUPERADMIN", "USER", "VIEWER")
  async getConfig(@Req() req: any) {
    const data = await this.configService.getPublicConfig(req.tenantId);
    return { success: true, data };
  }

  @Put()
  @Roles("ADMIN", "OWNER", "SUPERADMIN")
  async updateConfig(@Req() req: any, @Body() dto: RecipeCaptureConfigDto) {
    const data = await this.configService.saveConfig(
      req.tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data };
  }
}
