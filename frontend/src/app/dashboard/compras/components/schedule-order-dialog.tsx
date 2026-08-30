'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/components/notification-system';
import {
  PURCHASE_SCHEDULE_DAYS,
  useSchedulePurchaseOrder,
} from '@/hooks/use-purchase-schedules';
import type { PurchaseOrder } from '@/hooks/use-purchase-orders';

/**
 * "Programar pedidos como este": copia los artículos del pedido a una lista de
 * compra nueva y crea una programación recurrente sobre ella. El resultado es
 * una programación normal — el sistema genera un BORRADOR + aviso en cada
 * día/hora y nunca envía nada al proveedor.
 */
export function ScheduleOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: PurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addNotification = useNotification();
  const scheduleMut = useSchedulePurchaseOrder();

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [listName, setListName] = useState('');

  const defaultName = `Pedido ${order.orderNumber}`;
  const lineCount = order._count?.lines ?? order.lines?.length ?? 0;

  const summary = useMemo(() => {
    if (daysOfWeek.length === 0) return 'Marca al menos un día';
    const labels = PURCHASE_SCHEDULE_DAYS.filter((d) =>
      daysOfWeek.includes(d.value),
    ).map((d) => d.label);
    return `${labels.join(' · ')} a las ${timeOfDay}`;
  }, [daysOfWeek, timeOfDay]);

  const toggleDay = (day: number) =>
    setDaysOfWeek((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );

  const reset = () => {
    setDaysOfWeek([]);
    setTimeOfDay('09:00');
    setListName('');
  };

  const handleConfirm = async () => {
    if (daysOfWeek.length === 0) return;
    try {
      await scheduleMut.mutateAsync({
        orderId: order.id,
        daysOfWeek,
        timeOfDay,
        listName: listName.trim() || undefined,
      });
      addNotification({
        type: 'success',
        title: 'Pedidos programados',
        message:
          'Se generará un borrador y un aviso los días elegidos. Gestiónalo en Compras → Programaciones.',
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo programar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
            Programar pedidos como este
          </DialogTitle>
          <DialogDescription>
            {order.supplier?.name}
            {order.location?.name ? ` · ${order.location.name}` : ''} ·{' '}
            {lineCount} {lineCount === 1 ? 'artículo' : 'artículos'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="rounded-xl bg-[var(--surface-container-low)] p-3 text-sm text-[var(--on-surface-variant)]">
            Se creará una lista de compra con los artículos de este pedido y
            quedará programada. El día y hora elegidos se genera un pedido en
            <span className="font-medium text-[var(--on-surface)]"> borrador</span>{' '}
            más una notificación para revisarlo y enviarlo. Nunca se envía nada
            automáticamente.
          </p>

          <div>
            <label
              htmlFor="schedule-list-name"
              className="block text-xs font-medium text-[var(--on-surface-variant)]"
            >
              Nombre de la lista
            </label>
            <input
              id="schedule-list-name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder={defaultName}
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[var(--on-surface-variant)]">
              Días de la semana
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PURCHASE_SCHEDULE_DAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={daysOfWeek.includes(value)}
                  onClick={() => toggleDay(value)}
                  className={`h-9 w-9 rounded-full text-sm font-medium transition ${
                    daysOfWeek.includes(value)
                      ? 'bg-[var(--primary)] text-primary-foreground'
                      : 'border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="schedule-time"
              className="block text-xs font-medium text-[var(--on-surface-variant)]"
            >
              Hora
            </label>
            <input
              id="schedule-time"
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="mt-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <p className="text-sm text-[var(--on-surface-variant)]">
            Resumen: <span className="text-[var(--on-surface)]">{summary}</span>
          </p>

          <div className="flex justify-end gap-2 border-t border-[var(--outline-variant)] pt-4">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={daysOfWeek.length === 0 || scheduleMut.isPending}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {scheduleMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Crear programación
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
