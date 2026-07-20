import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { WebSocketService } from "../../websocket/websocket.service";
import { NotificationEvent } from "../../websocket/types/events";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebSocketService,
  ) {}

  async createNotification(
    tenantId: string,
    data: {
      title: string;
      message: string;
      type: string;
      severity?: string;
      userId?: string;
      metadata?: any;
    },
  ) {
    // Alert es tenant-wide: no tiene columna userId, así que data.userId solo
    // se usa para createdBy (auditoría de quién generó la alerta), nunca como
    // destinatario. Bug preexistente detectado 2026-07-15: mapeo correcto,
    // mismo patrón que appcc.service.ts.
    const notification = await this.prisma.alert.create({
      data: {
        tenantId,
        type: data.type,
        alertType: data.type,
        title: data.title,
        severity: data.severity || "INFO",
        message: data.message,
        createdBy: data.userId || "system",
      },
    });

    // No debe abortar la creación de la alerta si el broadcast en vivo falla
    // (la fila en BD ya es la fuente de verdad; la campana la recogerá igual
    // en el próximo GET /alerts).
    try {
      this.websocketService.broadcastNotification({
        id: notification.id,
        type: (data.severity || "INFO") as NotificationEvent["type"],
        title: notification.title ?? data.type,
        message: notification.message,
        createdAt: notification.createdAt,
        tenantId,
      });
    } catch (err) {
      this.logger.warn(
        `Error emitiendo notificación por WebSocket: ${err.message}`,
      );
    }

    return {
      success: true,
      data: notification,
      message: "Notification created successfully",
    };
  }

  /** Notificación compartida de cambio de precio (albaranes, albarán manual, edición manual en Artículos). */
  async notifyPriceChange(
    tenantId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    percentageChange: number,
  ): Promise<void> {
    const direction = newPrice > oldPrice ? "aumentado" : "disminuido";
    const alertType = percentageChange > 25 ? "ERROR" : "WARNING";

    await this.createNotification(tenantId, {
      type: alertType,
      title: `Cambio de precio: ${productName}`,
      message: `Precio ${direction} ${Math.abs(percentageChange).toFixed(1)}%. De ${oldPrice.toFixed(2)}€ a ${newPrice.toFixed(2)}€.`,
      severity: alertType,
    });
  }

  async getUserNotifications(
    tenantId: string,
    userId?: string,
    limit: number = 50,
  ) {
    const where: any = { tenantId };

    if (userId) {
      where.userId = userId;
    }

    const notifications = await this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return {
      success: true,
      data: notifications,
      message: "Notifications retrieved successfully",
    };
  }

  async markAsRead(notificationId: string, tenantId: string) {
    const existing = await this.prisma.alert.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!existing) {
      throw new Error("Notification not found");
    }

    const notification = await this.prisma.alert.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      success: true,
      data: notification,
      message: "Notification marked as read",
    };
  }

  async sendBulkNotifications(
    tenantId: string,
    data: {
      title: string;
      message: string;
      type: string;
      severity?: string;
      userRoles?: string[];
    },
  ) {
    // Encontrar usuarios del tenant con los roles especificados
    const where: any = { tenantId, isActive: true };

    if (data.userRoles && data.userRoles.length > 0) {
      where.role = { in: data.userRoles };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    // Crear notificación para cada usuario
    const notifications = await Promise.all(
      users.map((user) =>
        this.createNotification(tenantId, {
          ...data,
          userId: user.id,
        }),
      ),
    );

    return {
      success: true,
      data: {
        count: notifications.length,
        notifications,
      },
      message: `Sent ${notifications.length} notifications successfully`,
    };
  }
}
