import { useContext, useEffect, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { getWebSocketClient, type NotificationEvent } from '@/lib/websocket-client';

// Hook for managing WebSocket notifications
export function useWebSocketNotifications() {
  const { isAuthenticated, sessionId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient({
      user: null,
      tenantId: null,
      sessionId,
    } as any);

    // Listen for new notifications
    const notificationHandler = (notification: any) => {
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
      wsClient.off('notification', notificationHandler);
      setNotifications([]); // Clear notifications on unmount
      setUnreadCount(0);
    };
  }, [isAuthenticated, sessionId]);

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
  const { isAuthenticated, sessionId } = useAuth();
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [orderUpdates, setOrderUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient({
      user: null,
      tenantId: null,
      sessionId,
    } as any);

    const orderCreatedHandler = (order: any) => {
      setLastOrder(order);
      setOrderUpdates((prev) => [{ type: 'created', order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const orderApprovedHandler = (order: any) => {
      setOrderUpdates((prev) => [{ type: 'approved', order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const orderRejectedHandler = (order: any) => {
      setOrderUpdates((prev) => [{ type: 'rejected', order, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onOrderCreated(orderCreatedHandler);
    wsClient.onOrderApproved(orderApprovedHandler);
    wsClient.onOrderRejected(orderRejectedHandler);

    return () => {
      wsClient.off('orderCreated', orderCreatedHandler);
      wsClient.off('orderApproved', orderApprovedHandler);
      wsClient.off('orderRejected', orderRejectedHandler);
    };
  }, [isAuthenticated, sessionId]);

  return {
    lastOrder,
    orderUpdates,
    clearUpdates: () => setOrderUpdates([]),
  };
}

// Hook for real-time production updates
export function useRealTimeProduction() {
  const { isAuthenticated, sessionId } = useAuth();
  const [productionUpdates, setProductionUpdates] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient({
      user: null,
      tenantId: null,
      sessionId,
    } as any);

    const taskCompletedHandler = (task: any) => {
      setProductionUpdates((prev) => [{ type: 'task_completed', task, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const alertHandler = (alert: any) => {
      if (alert.severity === 'CRITICAL') {
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
      }
      setProductionUpdates((prev) => [{ type: 'alert', alert, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onProductionTaskCompleted(taskCompletedHandler);
    wsClient.onProductionAlert(alertHandler);

    return () => {
      wsClient.off('productionTaskCompleted', taskCompletedHandler);
      wsClient.off('productionAlert', alertHandler);
      setAlerts([]);
      setProductionUpdates([]);
    };
  }, [isAuthenticated, sessionId]);

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
  const { isAuthenticated, sessionId } = useAuth();
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [stockUpdates, setStockUpdates] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient({
      user: null,
      tenantId: null,
      sessionId,
    } as any);

    const stockLowHandler = (alert: any) => {
      setStockAlerts((prev) => [alert, ...prev].slice(0, 50));
    };

    const stockCriticalHandler = (alert: any) => {
      setStockAlerts((prev) => [alert, ...prev].slice(0, 50));
      setStockUpdates((prev) => [{ type: 'critical', alert, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const stockUpdatedHandler = (stock: any) => {
      setStockUpdates((prev) => [{ type: 'updated', stock, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    wsClient.onStockLow(stockLowHandler);
    wsClient.onStockCritical(stockCriticalHandler);
    wsClient.onStockUpdated(stockUpdatedHandler);

    return () => {
      wsClient.off('stockLow', stockLowHandler);
      wsClient.off('stockCritical', stockCriticalHandler);
      wsClient.off('stockUpdated', stockUpdatedHandler);
      setStockAlerts([]);
      setStockUpdates([]);
    };
  }, [isAuthenticated, sessionId]);

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
  const { isAuthenticated, sessionId } = useAuth();
  const [menuUpdates, setMenuUpdates] = useState<any[]>([]);
  const [qrScans, setQrScans] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) {
      return;
    }

    const wsClient = getWebSocketClient({
      user: null,
      tenantId: null,
      sessionId,
    } as any);

    const menuPublishedHandler = (menu: any) => {
      setMenuUpdates((prev) => [{ type: 'published', menu, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const menuUpdatedHandler = (menu: any) => {
      setMenuUpdates((prev) => [{ type: 'updated', menu, timestamp: new Date() }, ...prev].slice(0, 50));
    };

    const qrScanHandler = (scan: any) => {
      setQrScans((prev) => [scan, ...prev].slice(0, 50));
    };

    wsClient.onMenuPublished(menuPublishedHandler);
    wsClient.onMenuUpdated(menuUpdatedHandler);
    wsClient.onQRScan(qrScanHandler);

    return () => {
      wsClient.off('menuPublished', menuPublishedHandler);
      wsClient.off('menuUpdated', menuUpdatedHandler);
      wsClient.off('qrScan', qrScanHandler);
      setMenuUpdates([]);
      setQrScans([]);
    };
  }, [isAuthenticated, sessionId]);

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
  const { isAuthenticated, sessionId } = useAuth();

  const joinKitchen = useCallback(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient({
        user: null,
        tenantId: null,
        sessionId,
      } as any);
      wsClient.joinKitchen();
    }
  }, [isAuthenticated, sessionId]);

  const joinDashboard = useCallback(() => {
    if (isAuthenticated && sessionId) {
      const wsClient = getWebSocketClient({
        user: null,
        tenantId: null,
        sessionId,
      } as any);
      wsClient.joinDashboard();
    }
  }, [isAuthenticated, sessionId]);

  const leaveRoom = useCallback(
    (room: string) => {
      if (isAuthenticated && sessionId) {
        const wsClient = getWebSocketClient({
          user: null,
          tenantId: null,
          sessionId,
        } as any);
        wsClient.leaveRoom(room);
      }
    },
    [isAuthenticated, sessionId]
  );

  return {
    joinKitchen,
    joinDashboard,
    leaveRoom,
  };
}