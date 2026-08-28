'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useCreateSalaTask,
  useUpdateSalaTask,
  useDeleteSalaTask,
  type SalaTask,
  type SalaTaskInput,
  type SalaTaskStatus,
} from '@/hooks/use-sala-tasks';

const STATUS_LABELS: Record<SalaTaskStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function emptyFormState(): SalaTaskInput {
  return {
    title: '',
    eventDate: '',
    guestCount: undefined,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    menuNotes: '',
    observations: '',
    allergies: '',
    status: 'PENDIENTE',
  };
}

function taskToFormState(task: SalaTask): SalaTaskInput {
  return {
    title: task.title,
    eventDate: toDateInputValue(task.eventDate),
    guestCount: task.guestCount ?? undefined,
    customerName: task.customerName ?? '',
    customerPhone: task.customerPhone ?? '',
    customerEmail: task.customerEmail ?? '',
    menuNotes: task.menuNotes ?? '',
    observations: task.observations ?? '',
    allergies: task.allergies ?? '',
    status: task.status,
  };
}

export interface SalaTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tarea a editar; omitir para modo creación. */
  task?: SalaTask | null;
}

export function SalaTaskModal({ open, onOpenChange, task }: SalaTaskModalProps) {
  const isEditing = Boolean(task);
  const [form, setForm] = useState<SalaTaskInput>(() =>
    task ? taskToFormState(task) : emptyFormState(),
  );
  // Sentinela que nunca coincide con un id real ni con el modo creación:
  // fuerza una resincronización del formulario la próxima vez que se abra,
  // incluso para la MISMA tarea (si no, cerrar con "Cancelar" y reabrir la
  // misma card mostraba el borrador descartado en vez de los datos reales).
  const CLOSED = '__closed__';
  const [openedForKey, setOpenedForKey] = useState<string>(CLOSED);
  const currentKey = task ? task.id : '__new__';

  // El modal se monta una vez y se reabre para distintas tareas (o creación);
  // sincroniza el formulario cuando cambia el target en vez de con useEffect.
  if (open && openedForKey !== currentKey) {
    setOpenedForKey(currentKey);
    setForm(task ? taskToFormState(task) : emptyFormState());
  } else if (!open && openedForKey !== CLOSED) {
    setOpenedForKey(CLOSED);
  }

  const createTask = useCreateSalaTask();
  const updateTask = useUpdateSalaTask();
  const deleteTask = useDeleteSalaTask();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const saving = createTask.isPending || updateTask.isPending;

  const handleChange = <K extends keyof SalaTaskInput>(key: K, value: SalaTaskInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.eventDate) {
      addNotification({
        type: 'error',
        title: 'Faltan datos',
        message: 'Título y fecha del evento son obligatorios.',
      });
      return;
    }

    try {
      // form.guestCount ya es number | undefined (ver handleChange); no
      // reprocesar con `||` aquí, o un 0 comensales válido se perdería.
      if (isEditing && task) {
        await updateTask.mutateAsync({ id: task.id, ...form });
      } else {
        await createTask.mutateAsync(form);
      }
      onOpenChange(false);
    } catch {
      addNotification({
        type: 'error',
        title: 'Error al guardar',
        message: 'No se pudo guardar la notificación de sala.',
      });
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Eliminar notificación de sala',
      description: `¿Eliminar "${task.title}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await deleteTask.mutateAsync(task.id);
      onOpenChange(false);
    } catch {
      addNotification({
        type: 'error',
        title: 'Error al eliminar',
        message: 'No se pudo eliminar la notificación de sala.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar notificación de sala' : 'Nueva notificación de sala'}</DialogTitle>
          <DialogDescription>
            Reservas, menús y encargos que sala comunica a cocina.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sala-task-title">Título *</Label>
            <Input
              id="sala-task-title"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ej. Comida de empresa 25 pax"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sala-task-date">Fecha del evento *</Label>
              <Input
                id="sala-task-date"
                type="date"
                value={form.eventDate}
                onChange={(e) => handleChange('eventDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sala-task-guests">Comensales</Label>
              <Input
                id="sala-task-guests"
                type="number"
                min={0}
                value={form.guestCount ?? ''}
                onChange={(e) =>
                  handleChange('guestCount', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sala-task-customer">Nombre y apellidos</Label>
              <Input
                id="sala-task-customer"
                value={form.customerName ?? ''}
                onChange={(e) => handleChange('customerName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sala-task-phone">Teléfono</Label>
              <Input
                id="sala-task-phone"
                type="tel"
                value={form.customerPhone ?? ''}
                onChange={(e) => handleChange('customerPhone', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sala-task-email">Email</Label>
            <Input
              id="sala-task-email"
              type="email"
              value={form.customerEmail ?? ''}
              onChange={(e) => handleChange('customerEmail', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sala-task-menu">Menú</Label>
            <Textarea
              id="sala-task-menu"
              rows={3}
              value={form.menuNotes ?? ''}
              onChange={(e) => handleChange('menuNotes', e.target.value)}
              placeholder="Menú, encargos, texto libre..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sala-task-observations">Observaciones</Label>
            <Textarea
              id="sala-task-observations"
              rows={2}
              value={form.observations ?? ''}
              onChange={(e) => handleChange('observations', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sala-task-allergies">Alergias</Label>
            <Textarea
              id="sala-task-allergies"
              rows={2}
              value={form.allergies ?? ''}
              onChange={(e) => handleChange('allergies', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={form.status}
              onValueChange={(value) => handleChange('status', value as SalaTaskStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
