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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotification } from '@/components/notification-system';
import { usePostponeProductionTask } from '@/hooks/use-dashboard-kpis';
import { useProductionBatches } from '@/hooks/use-production';

const NON_TRANSFERABLE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface PostponableTask {
  id: string;
  batchId: string;
  title: string;
}

const KEEP_BATCH_VALUE = '__keep__';

export function PostponeTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: PostponableTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addNotification = useNotification();
  const postponeTask = usePostponeProductionTask();
  const { batches } = useProductionBatches();
  const min = toDateInputValue(new Date());
  const [date, setDate] = useState('');
  const [targetBatchId, setTargetBatchId] = useState(KEEP_BATCH_VALUE);

  const otherBatches = batches.filter(
    (b) => b.id !== task.batchId && !NON_TRANSFERABLE_STATUSES.has(b.status),
  );

  const dateChanged = date !== '';
  const batchChanged = targetBatchId !== KEEP_BATCH_VALUE;
  const canSubmit = dateChanged || batchChanged;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await postponeTask.mutateAsync({
        orderId: task.id,
        scheduledFor: dateChanged ? date : undefined,
        batchId: batchChanged ? targetBatchId : undefined,
      });
      const targetBatchNumber = batchChanged
        ? otherBatches.find((b) => b.id === targetBatchId)?.batchNumber
        : undefined;
      const parts: string[] = [];
      if (dateChanged) {
        parts.push(`al ${new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}`);
      }
      if (targetBatchNumber) {
        parts.push(`al lote ${targetBatchNumber}`);
      }
      addNotification({
        type: 'success',
        title: batchChanged ? 'Tarea trasladada' : 'Tarea pospuesta',
        message: `"${task.title}" se ha movido ${parts.join(' y ')}`,
      });
      onOpenChange(false);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo actualizar la tarea',
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
            Posponer o trasladar tarea
          </DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>

        <div>
          <Label>Nueva fecha (opcional)</Label>
          <Input type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div>
          <Label>Trasladar a otro lote (opcional)</Label>
          <Select value={targetBatchId} onValueChange={(value) => setTargetBatchId(value ?? KEEP_BATCH_VALUE)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP_BATCH_VALUE}>Mantener lote actual</SelectItem>
              {otherBatches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batchNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={postponeTask.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || postponeTask.isPending}>
            {postponeTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
