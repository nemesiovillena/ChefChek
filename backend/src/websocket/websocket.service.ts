import { Injectable, Logger } from "@nestjs/common";
import { WebSocketGateway } from "./websocket.gateway";
import {
  OrderEvent,
  ProductionEvent,
  ProductionTaskEvent,
  ProductionAlertEvent,
  StockAlertEvent,
  StockEvent,
  QRScanEvent,
  MenuEvent,
  NotificationEvent,
} from "./types/events";

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(private readonly gateway: WebSocketGateway) {}

  // Order Events
  broadcastOrderCreated(order: OrderEvent) {
    this.gateway.broadcastToKitchen(order.tenantId, "orderCreated", order);
    this.gateway.broadcastToTenant(order.tenantId, "notification", {
      id: `notification-${order.id}-${Date.now()}`,
      type: "INFO",
      title: "Nueva orden creada",
      message: `Orden #${order.orderNumber} de ${order.supplierName}`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
      actionUrl: `/orders/${order.id}`,
      createdAt: new Date(),
      tenantId: order.tenantId,
    } as NotificationEvent);
  }

  broadcastOrderUpdated(order: OrderEvent) {
    this.gateway.broadcastToKitchen(order.tenantId, "orderUpdated", order);
    this.gateway.broadcastToDashboard(order.tenantId, "orderUpdated", order);
  }

  broadcastOrderApproved(order: OrderEvent) {
    this.gateway.broadcastToKitchen(order.tenantId, "orderApproved", order);
    this.gateway.broadcastToTenant(order.tenantId, "notification", {
      id: `notification-${order.id}-${Date.now()}`,
      type: "SUCCESS",
      title: "Orden aprobada",
      message: `Orden #${order.orderNumber} aprobada`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
      actionUrl: `/orders/${order.id}`,
      createdAt: new Date(),
      tenantId: order.tenantId,
    } as NotificationEvent);
  }

  broadcastOrderRejected(order: OrderEvent) {
    this.gateway.broadcastToKitchen(order.tenantId, "orderRejected", order);
    this.gateway.broadcastToTenant(order.tenantId, "notification", {
      id: `notification-${order.id}-${Date.now()}`,
      type: "WARNING",
      title: "Orden rechazada",
      message: `Orden #${order.orderNumber} rechazada`,
      data: { orderId: order.id, orderNumber: order.orderNumber },
      actionUrl: `/orders/${order.id}`,
      createdAt: new Date(),
      tenantId: order.tenantId,
    } as NotificationEvent);
  }

  // Production Events
  broadcastProductionOrderCreated(productionOrder: ProductionEvent) {
    this.gateway.broadcastToKitchen(
      productionOrder.tenantId,
      "productionOrderCreated",
      productionOrder,
    );
    this.gateway.broadcastToDashboard(
      productionOrder.tenantId,
      "productionOrderCreated",
      productionOrder,
    );
  }

  broadcastProductionOrderUpdated(productionOrder: ProductionEvent) {
    this.gateway.broadcastToKitchen(
      productionOrder.tenantId,
      "productionOrderUpdated",
      productionOrder,
    );
    this.gateway.broadcastToDashboard(
      productionOrder.tenantId,
      "productionOrderUpdated",
      productionOrder,
    );
  }

  broadcastProductionTaskCompleted(task: ProductionTaskEvent) {
    this.gateway.broadcastToKitchen(
      task.tenantId,
      "productionTaskCompleted",
      task,
    );
    this.gateway.broadcastToDashboard(
      task.tenantId,
      "productionTaskCompleted",
      task,
    );
  }

  broadcastProductionAlert(alert: ProductionAlertEvent) {
    this.gateway.broadcastToKitchen(alert.tenantId, "productionAlert", alert);
    this.gateway.broadcastToDashboard(alert.tenantId, "productionAlert", alert);

    if (alert.severity === "CRITICAL") {
      this.gateway.broadcastToTenant(alert.tenantId, "notification", {
        id: `notification-${alert.id}-${Date.now()}`,
        type: "ERROR",
        title: "Alerta de producción crítica",
        message: alert.message,
        data: {
          alertId: alert.id,
          taskId: alert.taskId,
          recipeName: alert.recipeName,
        },
        actionUrl: `/production`,
        createdAt: new Date(),
        tenantId: alert.tenantId,
      } as NotificationEvent);
    }
  }

  // Stock Events
  broadcastStockLow(alert: StockAlertEvent) {
    this.gateway.broadcastToDashboard(alert.tenantId, "stockLow", alert);
    this.gateway.broadcastToTenant(alert.tenantId, "notification", {
      id: `notification-${alert.id}-${Date.now()}`,
      type: "WARNING",
      title: "Stock bajo",
      message: `${alert.productName} tiene stock bajo (${alert.currentQuantity} / ${alert.minimumStock})`,
      data: { productId: alert.productId, productName: alert.productName },
      actionUrl: `/products/${alert.productId}`,
      createdAt: new Date(),
      tenantId: alert.tenantId,
    } as NotificationEvent);
  }

  broadcastStockCritical(alert: StockAlertEvent) {
    this.gateway.broadcastToKitchen(alert.tenantId, "stockCritical", alert);
    this.gateway.broadcastToDashboard(alert.tenantId, "stockCritical", alert);
    this.gateway.broadcastToTenant(alert.tenantId, "notification", {
      id: `notification-${alert.id}-${Date.now()}`,
      type: "ERROR",
      title: "Stock crítico",
      message: `${alert.productName} está sin stock (${alert.currentQuantity})`,
      data: { productId: alert.productId, productName: alert.productName },
      actionUrl: `/products/${alert.productId}`,
      createdAt: new Date(),
      tenantId: alert.tenantId,
    } as NotificationEvent);
  }

  broadcastStockUpdated(stock: StockEvent) {
    this.gateway.broadcastToDashboard(stock.tenantId, "stockUpdated", stock);
  }

  // Digital Menu Events
  broadcastQRScan(scan: QRScanEvent) {
    this.gateway.broadcastToDashboard(scan.tenantId, "qrScan", scan);
  }

  broadcastMenuUpdated(menu: MenuEvent) {
    this.gateway.broadcastToTenant(menu.tenantId, "menuUpdated", menu);
  }

  broadcastMenuPublished(menu: MenuEvent) {
    this.gateway.broadcastToTenant(menu.tenantId, "menuPublished", menu);
    this.gateway.broadcastToTenant(menu.tenantId, "notification", {
      id: `notification-${menu.id}-${Date.now()}`,
      type: "SUCCESS",
      title: "Menú publicado",
      message: `Menú "${menu.name}" está ahora disponible`,
      data: { menuId: menu.id, menuName: menu.name },
      actionUrl: `/menus/${menu.id}`,
      createdAt: new Date(),
      tenantId: menu.tenantId,
    } as NotificationEvent);
  }

  // General Notifications
  broadcastNotification(notification: NotificationEvent) {
    this.gateway.broadcastToTenant(
      notification.tenantId,
      "notification",
      notification,
    );
  }

  sendNotificationToUser(userId: string, notification: NotificationEvent) {
    this.gateway.sendToUser(userId, "notification", notification);
  }

  broadcastError(tenantId: string, error: { message: string; code?: string }) {
    this.gateway.broadcastToTenant(tenantId, "error", error);
  }
}
