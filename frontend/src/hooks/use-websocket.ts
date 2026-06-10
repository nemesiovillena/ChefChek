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
    wsClient.onNotification((notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
          data: notification.actionUrl,
        });
      }
    });

    // Clean up listeners on unmount
    return () => {
      wsClient.off('notification');
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

    wsClient.onOrderCreated((order) => {
      setLastOrder(order);
      setOrderUpdates((prev) => [{ type: 'created', order, timestamp: new Date() }, ...prev]);
    });

    wsClient.onOrderApproved((order) => {
      setOrderUpdates((prev) => [{ type: 'approved', order, timestamp: new Date() }, ...prev]);
    });

    wsClient.onOrderRejected((order) => {
      setOrderUpdates((prev) => [{ type: 'rejected', order, timestamp: new Date() }, ...prev]);
    });

    return () => {
      wsClient.off('orderCreated');
      wsClient.off('orderApproved');
      wsClient.off('orderRejected');
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

    wsClient.onProductionTaskCompleted((task) => {
      setProductionUpdates((prev) => [{ type: 'task_completed', task, timestamp: new Date() }, ...prev]);
    });

    wsClient.onProductionAlert((alert) => {
      if (alert.severity === 'CRITICAL') {
        setAlerts((prev) => [alert, ...prev]);
      }
      setProductionUpdates((prev) => [{ type: 'alert', alert, timestamp: new Date() }, ...prev]);
    });

    return () => {
      wsClient.off('productionTaskCompleted');
      wsClient.off('productionAlert');
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

    wsClient.onStockLow((alert) => {
      setStockAlerts((prev) => [alert, ...prev]);
    });

    wsClient.onStockCritical((alert) => {
      setStockAlerts((prev) => [alert, ...prev]);
      setStockUpdates((prev) => [{ type: 'critical', alert, timestamp: new Date() }, ...prev]);
    });

    wsClient.onStockUpdated((stock) => {
      setStockUpdates((prev) => [{ type: 'updated', stock, timestamp: new Date() }, ...prev]);
    });

    return () => {
      wsClient.off('stockLow');
      wsClient.off('stockCritical');
      wsClient.off('stockUpdated');
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

    wsClient.onMenuPublished((menu) => {
      setMenuUpdates((prev) => [{ type: 'published', menu, timestamp: new Date() }, ...prev]);
    });

    wsClient.onMenuUpdated((menu) => {
      setMenuUpdates((prev) => [{ type: 'updated', menu, timestamp: new Date() }, ...prev]);
    });

    wsClient.onQRScan((scan) => {
      setQrScans((prev) => [scan, ...prev]);
    });

    return () => {
      wsClient.off('menuPublished');
      wsClient.off('menuUpdated');
      wsClient.off('qrScan');
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