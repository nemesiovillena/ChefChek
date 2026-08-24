import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { OcrConfigService } from "./ocr-config.service";
import { OcrConfigDto } from "./dto/ocr-config.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";

/**
 * Configuración del motor IA de OCR, por tenant. La lee cualquier usuario del
 * tenant (para mostrarla en Ajustes/Subir); la editan roles administradores.
 */
@Controller("api/v1/ocr-config")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class OcrConfigController {
  constructor(private readonly ocrConfigService: OcrConfigService) {}

  @Get()
  @Roles("ADMIN", "OWNER", "SUPERADMIN", "USER", "VIEWER")
  async getConfig(@Req() req: any) {
    const data = await this.ocrConfigService.getPublicConfig(req.tenantId);
    return { success: true, data };
  }

  @Put()
  @Roles("ADMIN", "OWNER", "SUPERADMIN")
  async updateConfig(@Req() req: any, @Body() dto: OcrConfigDto) {
    const data = await this.ocrConfigService.saveConfig(
      req.tenantId,
      dto,
      req.user.id,
    );
    return { success: true, data };
  }
}
