import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AiAssistantConfigService } from "./ai-assistant-config.service";
import { AiAssistantConfigDto } from "./dto/ai-assistant-config.dto";
import { AuthGuard } from "../../../guards/auth.guard";
import { TenantGuard } from "../../../guards/tenant.guard";
import { RolesGuard } from "../../../guards/roles.guard";
import { Roles } from "../../../decorators/roles.decorator";

/**
 * Configuración del proveedor IA del asistente Chefchek, por tenant. La lee
 * cualquier usuario del tenant (para mostrar el estado en Ajustes); la
 * editan roles administradores, igual que ocr-config.
 */
@Controller("api/v1/ai-assistant/config")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AiAssistantConfigController {
  constructor(private readonly configService: AiAssistantConfigService) {}

  @Get()
  @Roles("ADMIN", "OWNER", "SUPERADMIN", "USER", "VIEWER")
  async getConfig(@Req() req: any) {
    const data = await this.configService.getPublicConfig(req.tenantId);
    return { success: true, data };
  }

  @Put()
  @Roles("ADMIN", "OWNER", "SUPERADMIN")
  async updateConfig(@Req() req: any, @Body() dto: AiAssistantConfigDto) {
    const data = await this.configService.saveConfig(
      req.tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data };
  }
}
