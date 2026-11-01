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
import { RoleAccessService } from "../role-access/role-access.service";
import { PurchaseListScopeService } from "../role-access/purchase-list-scope.service";
import { PrismaService } from "../../common/services/prisma.service";
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
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly roleAccess: RoleAccessService,
    private readonly purchaseListScope: PurchaseListScopeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Quien solo pide con sus listas no recibe avisos de pedidos de otros
   * proveedores. Devuelve los ids de pedido que no debe ver.
   */
  private async hiddenOrderIds(
    req: any,
    alerts: { entityType: string | null; entityId: string | null }[],
  ): Promise<Set<string>> {
    const orderIds = alerts
      .filter((a) => a.entityType === "PURCHASE_ORDER" && a.entityId)
      .map((a) => a.entityId as string);
    if (orderIds.length === 0) {
      return new Set();
    }
    const scope = await this.purchaseListScope.resolve(req.tenantId, req.user);
    if (!scope) {
      return new Set();
    }
    const visible = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId: req.tenantId,
        id: { in: orderIds },
        supplierId: { in: scope.supplierIds },
      },
      select: { id: true },
    });
    const visibleIds = new Set(visible.map((o) => o.id));
    return new Set(orderIds.filter((id) => !visibleIds.has(id)));
  }

  @Get()
  @Roles("ADMIN", "USER", "VIEWER")
  @ApiOperation({
    summary:
      "Listar alertas del tenant (para hidratar la campana de Notificaciones)",
  })
  async findAll(@Query("limit") limit: string | undefined, @Req() req: any) {
    const canViewCosts = await this.roleAccess.isSectionAllowed(
      req.tenantId,
      req.user?.role,
      "recipes.cost",
      req.user?.id,
    );
    const result = await this.notificationsService.getUserNotifications(
      req.tenantId,
      undefined,
      limit ? parseInt(limit, 10) : 50,
      !canViewCosts,
    );

    const hidden = await this.hiddenOrderIds(req, result.data);

    return {
      ...result,
      data: result.data
        .filter(
          (alert) =>
            !(
              alert.entityType === "PURCHASE_ORDER" &&
              alert.entityId &&
              hidden.has(alert.entityId)
            ),
        )
        .map((alert) => ({
          id: alert.id,
          type: alert.severity,
          title: alert.title ?? alert.type,
          message: alert.message,
          createdAt: alert.createdAt,
          tenantId: alert.tenantId,
          read: alert.isRead,
          entityType: alert.entityType ?? undefined,
          entityId: alert.entityId ?? undefined,
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
