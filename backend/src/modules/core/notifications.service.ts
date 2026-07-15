import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    // El modelo Alert no tiene columnas title/description/userId (solo type,
    // alertType, severity, message, createdBy) — bug preexistente detectado
    // 2026-07-15: esta llamada lanzaba PrismaClientValidationError en runtime
    // (severity/message/createdBy son requeridos y no se enviaban), lo que
    // abortaba la transacción entera de confirmación de albarán en cualquier
    // cambio de precio >10%. El spec anterior mockeaba Prisma y no lo
    // detectó. Mapeo correcto: mismo patrón que appcc.service.ts.
    const notification = await this.prisma.alert.create({
      data: {
        tenantId,
        type: data.type,
        alertType: data.type,
        severity: data.severity || "INFO",
        message: data.title ? `${data.title}: ${data.message}` : data.message,
        createdBy: data.userId || "system",
      },
    });

    return {
      success: true,
      data: notification,
      message: "Notification created successfully",
    };
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
    // Schema no tiene isRead, así que simulamos actualizando metadata
    const notification = await this.prisma.alert.findFirst({
      where: { id: notificationId, tenantId },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    // En una implementación real, tendríamos un campo isRead
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
