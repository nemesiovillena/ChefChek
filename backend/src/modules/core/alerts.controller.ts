import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { Roles } from "../../decorators/roles.decorator";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";

/** Alertas de negocio (cambios de precio, desviaciones, etc.) mostradas en la campana de Notificaciones del dashboard. */
@ApiTags("alerts")
@ApiBearerAuth()
@Controller("api/v1/alerts")
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary:
      "Listar alertas del tenant (para hidratar la campana de Notificaciones)",
  })
  async findAll(@Query("limit") limit: string | undefined, @Req() req: any) {
    const result = await this.notificationsService.getUserNotifications(
      req.tenantId,
      undefined,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      ...result,
      data: result.data.map((alert) => ({
        id: alert.id,
        type: alert.severity,
        title: alert.title ?? alert.type,
        message: alert.message,
        createdAt: alert.createdAt,
        tenantId: alert.tenantId,
        read: alert.isRead,
      })),
    };
  }

  @Patch(":id/read")
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({ summary: "Marcar una alerta como leída" })
  async markAsRead(@Param("id") id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.tenantId);
  }
}
