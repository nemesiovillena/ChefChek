import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import {
  getWebSocketClient,
  type NotificationEvent,
  type OrderEvent,
  type ProductionTaskEvent,
  type ProductionAlertEvent,
  type StockAlertEvent,
  type StockEvent,
  type MenuEvent,
  type QRScanEvent,
} from '@/lib/websocket-client';

/**
 * Widen a typed event handler to the loose signature expected by
 * `WebSocketClient.off`. The client's `off` callback is typed as
 * `(...args: unknown[]) => void`, which is incompatible with specific
 * handlers like `(order: OrderEvent) => void` due to parameter contravariance.
 * This helper performs a safe reference-only widening so the same handler
 * instance passed to `on*` can be removed by reference from `off`.
 */
type OffHandler = (...args: unknown[]) => void;
function asOffHandler<T extends unknown[]>(handler: (...args: T) => void): OffHandler {
  return handler as OffHandler;
}

/**
 * Production alert as surfaced to consumers. The backend `ProductionAlertEvent`
 * carries `message`/`severity`/`type`; some consumers also read a `title`
 * field (falling back when absent), so it is modeled as optional here.
 */
interface ProductionAlertItem extends ProductionAlertEvent {
  title?: string;
}

/**
 * Stock alert as surfaced to consumers. The backend `StockAlertEvent` carries
 * `currentQuantity`/`minimumStock`; some consumers read legacy `quantity`/
 * `minimum` fields (falling back when absent), so they are modeled as optional.
 */
interface StockAlertItem extends StockAlertEvent {
  quantity?: number;
  minimum?: number;
}

// Hook for managing WebSocket notifications
export function useWebSocketNotifications() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient(auth);

    // Listen for new notifications
    const notificationHandler = (notification: NotificationEvent) => {
      setNotifications((prev) => {
        // Limit to last 50 notifications to prevent memory leaks
        const updated = [notification, ...prev];
        return updated.slice(0, 50);
      });
      setUnreadCount((prev) => Math.min(prev + 1, 99)); // Limit to 99

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
          data: notification.actionUrl,
        });
      }
    };

    wsClient.onNotification(notificationHandler);

    // Clean up listeners on unmount
    return () => {
      wsClient.off('notification', asOffHandler(notificationHandler));
      setNotifications([]); // Clear notifications on unmount
      setUnreadCount(0);
    };
  }, [auth, isAuthenticated, sessionId]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}

// Hook for real-time orders
export function useRealTimeOrders() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;
  const [lastOrder, setLastOrder] = useState<OrderEvent | null>(null);
  const [orderUpdates, setOrderUpdates] = useState<Array<{ type: 'created' | 'approved' | 'rejected'; order: OrderEvent; timestamp: Date }>>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient(auth);

    const orderCreatedHandler = (order: OrderEvent) => {
      setLastOrder(order);
      setOrderUpdates((prev) => [{ type: 'created' as const, order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const orderApprovedHandler = (order: OrderEvent) => {
      setOrderUpdates((prev) => [{ type: 'approved' as const, order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const orderRejectedHandler = (order: OrderEvent) => {
      setOrderUpdates((prev) => [{ type: 'rejected' as const, order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onOrderCreated(orderCreatedHandler);
    wsClient.onOrderApproved(orderApprovedHandler);
    wsClient.onOrderRejected(orderRejectedHandler);

    return () => {
      wsClient.off('orderCreated', asOffHandler(orderCreatedHandler));
      wsClient.off('orderApproved', asOffHandler(orderApprovedHandler));
      wsClient.off('orderRejected', asOffHandler(orderRejectedHandler));
    };
  }, [auth, isAuthenticated, sessionId]);

  return {
    lastOrder,
    orderUpdates,
    clearUpdates: () => setOrderUpdates([]),
  };
}

// Hook for real-time production updates
export function useRealTimeProduction() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;
  const [productionUpdates, setProductionUpdates] = useState<Array<{ type: 'task_completed' | 'alert'; task?: ProductionTaskEvent; alert?: ProductionAlertItem; timestamp: Date }>>([]);
  const [alerts, setAlerts] = useState<ProductionAlertItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient(auth);

    const taskCompletedHandler = (task: ProductionTaskEvent) => {
      setProductionUpdates((prev) => [{ type: 'task_completed' as const, task, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const alertHandler = (alert: ProductionAlertEvent) => {
      if (alert.severity === 'CRITICAL') {
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
      }
      setProductionUpdates((prev) => [{ type: 'alert' as const, alert, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onProductionTaskCompleted(taskCompletedHandler);
    wsClient.onProductionAlert(alertHandler);

    return () => {
      wsClient.off('productionTaskCompleted', asOffHandler(taskCompletedHandler));
      wsClient.off('productionAlert', asOffHandler(alertHandler));
      setAlerts([]);
      setProductionUpdates([]);
    };
  }, [auth, isAuthenticated, sessionId]);

  return {
    productionUpdates,
    alerts,
    clearUpdates: () => {
      setProductionUpdates([]);
      setAlerts([]);
    },
  };
}

// Hook for real-time stock updates
export function useRealTimeStock() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;
  const [stockAlerts, setStockAlerts] = useState<StockAlertItem[]>([]);
  const [stockUpdates, setStockUpdates] = useState<Array<{ type: 'critical' | 'updated'; alert?: StockAlertItem; stock?: StockEvent; timestamp: Date }>>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient(auth);

    const stockLowHandler = (alert: StockAlertEvent) => {
      setStockAlerts((prev) => [alert, ...prev].slice(0, 50));
    };

    const stockCriticalHandler = (alert: StockAlertEvent) => {
      setStockAlerts((prev) => [alert, ...prev].slice(0, 50));
      setStockUpdates((prev) => [{ type: 'critical' as const, alert, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const stockUpdatedHandler = (stock: StockEvent) => {
      setStockUpdates((prev) => [{ type: 'updated' as const, stock, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onStockLow(stockLowHandler);
    wsClient.onStockCritical(stockCriticalHandler);
    wsClient.onStockUpdated(stockUpdatedHandler);

    return () => {
      wsClient.off('stockLow', asOffHandler(stockLowHandler));
      wsClient.off('stockCritical', asOffHandler(stockCriticalHandler));
      wsClient.off('stockUpdated', asOffHandler(stockUpdatedHandler));
      setStockAlerts([]);
      setStockUpdates([]);
    };
  }, [auth, isAuthenticated, sessionId]);

  return {
    stockAlerts,
    stockUpdates,
    clearUpdates: () => {
      setStockAlerts([]);
      setStockUpdates([]);
    },
  };
}

// Hook for real-time digital menu updates
export function useRealTimeDigitalMenu() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;
  const [menuUpdates, setMenuUpdates] = useState<Array<{ type: 'published' | 'updated'; menu: MenuEvent; timestamp: Date }>>([]);
  const [qrScans, setQrScans] = useState<QRScanEvent[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient(auth);

    const menuPublishedHandler = (menu: MenuEvent) => {
      setMenuUpdates((prev) => [{ type: 'published' as const, menu, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const menuUpdatedHandler = (menu: MenuEvent) => {
      setMenuUpdates((prev) => [{ type: 'updated' as const, menu, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const qrScanHandler = (scan: QRScanEvent) => {
      setQrScans((prev) => [scan, ...prev].slice(0, 50));
    };

    wsClient.onMenuPublished(menuPublishedHandler);
    wsClient.onMenuUpdated(menuUpdatedHandler);
    wsClient.onQRScan(qrScanHandler);

    return () => {
      wsClient.off('menuPublished', asOffHandler(menuPublishedHandler));
      wsClient.off('menuUpdated', asOffHandler(menuUpdatedHandler));
      wsClient.off('qrScan', asOffHandler(qrScanHandler));
      setMenuUpdates([]);
      setQrScans([]);
    };
  }, [auth, isAuthenticated, sessionId]);

  return {
    menuUpdates,
    qrScans,
    clearUpdates: () => {
      setMenuUpdates([]);
      setQrScans([]);
    },
  };
}

// Hook to control WebSocket rooms
export function useWebSocketRooms() {
  const auth = useAuth();
  const { isAuthenticated, sessionId } = auth;

  const joinKitchen = useCallback(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient(auth);
      wsClient.joinKitchen();
    }
  }, [auth, isAuthenticated, sessionId]);

  const joinDashboard = useCallback(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient(auth);
      wsClient.joinDashboard();
    }
  }, [auth, isAuthenticated, sessionId]);

  const leaveRoom = useCallback(
    (room: string) => {
      if (isAuthenticated && sessionId) {
        const wsClient = getWebSocketClient(auth);
        wsClient.leaveRoom(room);
      }
    },
    [auth, isAuthenticated, sessionId]
  );

  return {
    joinKitchen,
    joinDashboard,
    leaveRoom,
  };
}
