'use client';

import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { usePostponeProductionTask } from '@/hooks/use-dashboard-kpis';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function PostponeTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: UpcomingProductionTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addNotification = useNotification();
  const postponeTask = usePostponeProductionTask();
  const min = toDateInputValue(new Date());
  const currentLotDate = toDateInputValue(new Date(task.lotDate));
  const [date, setDate] = useState(currentLotDate > min ? currentLotDate : min);

  const handleSubmit = async () => {
    if (!date) return;
    try {
      await postponeTask.mutateAsync({ orderId: task.id, scheduledFor: date });
      addNotification({
        type: 'success',
        title: 'Tarea pospuesta',
        message: `"${task.title}" se ha movido al ${new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}`,
      });
      onOpenChange(false);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo posponer',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[var(--primary)]" />
            Posponer tarea
          </DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>

        <div>
          <Label>Nueva fecha</Label>
          <Input type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={postponeTask.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!date || postponeTask.isPending}>
            {postponeTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Posponer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
