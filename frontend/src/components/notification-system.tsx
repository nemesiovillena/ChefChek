'use client';

import { useCallback, useEffect, useState } from 'react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
}

interface WindowWithNotification extends Window {
  addNotification?: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
}

// Module-level counter for stable notification IDs without calling impure
// functions (e.g. Date.now) during render.
let notificationCounter = 0;

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    notificationCounter += 1;
    const newNotification: Notification = {
      ...notification,
      id: `notification-${notificationCounter}`,
      timestamp: new Date(),
    };

    setNotifications((prev) => [newNotification, ...prev]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  }, [removeNotification]);

  // Expose function globally for use in other components
  useEffect(() => {
    (window as WindowWithNotification).addNotification = addNotification;
  }, [addNotification]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => {
        const colors = {
          success: 'bg-green-50 border-green-200 text-green-800',
          error: 'bg-red-50 border-red-200 text-red-800',
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          info: 'bg-blue-50 border-blue-200 text-blue-800',
        };

        return (
          <div
            key={notification.id}
            className={`${colors[notification.type]} border rounded-lg p-4 shadow-lg max-w-sm`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-sm">{notification.title}</h3>
                <p className="text-xs mt-1">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-gray-500 hover:text-gray-700 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Hook for using notifications in components.
// Guarded for SSR/prerender: `window` is unavailable on the server, so return a
// no-op there. The real notifier is only available client-side once
// NotificationSystem has mounted and assigned window.addNotification.
export function useNotification() {
  if (typeof window === 'undefined') return () => {};
  return (window as WindowWithNotification).addNotification || (() => {});
}