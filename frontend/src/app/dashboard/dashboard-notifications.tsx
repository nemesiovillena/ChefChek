'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { NotificationEvent } from '@/lib/websocket-client';

const TYPE_STYLES = {
  ERROR: { wrap: 'bg-error/10 border-error/20', icon: 'text-error', glyph: 'error' },
  WARNING: { wrap: 'bg-warning/10 border-warning/20', icon: 'text-warning', glyph: 'warning' },
  DEFAULT: { wrap: 'bg-secondary-container/10 border-transparent', icon: 'text-secondary', glyph: 'info' },
} as const;

/** Un aviso de "Notificaciones y Alertas": icono por tipo, título y mensaje; las leídas salen atenuadas. */
export function DashboardNotificationRow({
  notification: notif,
  onOpen,
}: {
  notification: NotificationEvent;
  onOpen: () => void;
}) {
  const style = notif.type === 'ERROR' || notif.type === 'WARNING' ? TYPE_STYLES[notif.type] : TYPE_STYLES.DEFAULT;
  return (
    <div
      onClick={onOpen}
      className={`flex items-start gap-stack-sm p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${style.wrap} ${!notif.read ? '' : 'opacity-60'}`}
    >
      <span className={`material-symbols-outlined ${style.icon} text-[16px]`}>{style.glyph}</span>
      <div>
        <p className="text-xs text-primary font-medium">{notif.title}</p>
        <p className="text-[11px] text-on-surface-variant leading-tight">{notif.message}</p>
      </div>
    </div>
  );
}

/** "Mostrar todas" de la card de avisos: no hay página propia de notificaciones, se listan en un diálogo con scroll. */
export function AllNotificationsDialog({
  open,
  onOpenChange,
  notifications,
  onOpenNotification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: NotificationEvent[];
  onOpenNotification: (notification: NotificationEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Notificaciones y alertas ({notifications.length})</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-stack-sm overflow-y-auto pr-1">
          {notifications.map((notif) => (
            <DashboardNotificationRow
              key={notif.id}
              notification={notif}
              onOpen={() => {
                onOpenChange(false);
                onOpenNotification(notif);
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
