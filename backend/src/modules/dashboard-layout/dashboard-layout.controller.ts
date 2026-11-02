import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../decorators/roles.decorator";
import { DashboardLayoutService } from "./dashboard-layout.service";
import { UpdateDashboardLayoutDto } from "./dto/update-dashboard-layout.dto";

@Controller("api/v1/dashboard-layout")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class DashboardLayoutController {
  constructor(private readonly service: DashboardLayoutService) {}

  /** Pantalla del usuario autenticado (null = dashboard completo). */
  @Get("me")
  async getMine(@Req() req: any) {
    // Envuelto: un null suelto llega como cuerpo vacío.
    return { layout: await this.service.getForUser(req.tenantId, req.user.id) };
  }

  /** Dispositivos compartidos y su pantalla. OWNER/ADMIN. */
  @Get("devices")
  @Roles("ADMIN")
  async listDevices(@Req() req: any) {
    return this.service.listSharedDevices(req.tenantId);
  }

  @Put("devices/:userId")
  @Roles("ADMIN")
  async update(
    @Req() req: any,
    @Param("userId") userId: string,
    @Body() dto: UpdateDashboardLayoutDto,
  ) {
    return this.service.update(req.tenantId, userId, req.user.id, dto);
  }

  @Delete("devices/:userId")
  @Roles("ADMIN")
  @HttpCode(204)
  async reset(@Req() req: any, @Param("userId") userId: string) {
    await this.service.reset(req.tenantId, userId);
  }
}
