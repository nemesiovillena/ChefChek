'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BatchPriority, CreateWorkBatchInput, KitchenZone, WorkBatch } from '@/hooks/use-production';

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const PRIORITY_OPTIONS: { value: BatchPriority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const KITCHEN_ZONE_OPTIONS: { value: KitchenZone; label: string }[] = [
  { value: 'HOT_KITCHEN', label: 'Cocina caliente' },
  { value: 'COLD_KITCHEN', label: 'Cocina fría' },
  { value: 'PASTRY_KITCHEN', label: 'Pastelería' },
  { value: 'GRILL_STATION', label: 'Parrilla' },
  { value: 'FRYING_STATION', label: 'Fritos' },
  { value: 'PLATING_STATION', label: 'Emplatado' },
  { value: 'SERVICE_STATION', label: 'Servicio' },
];

interface BatchCreateDialogProps {
  onClose: () => void;
  onSubmit: (input: CreateWorkBatchInput) => Promise<void>;
  isSubmitting: boolean;
  initialBatch?: WorkBatch;
}

export default function BatchCreateDialog({ onClose, onSubmit, isSubmitting, initialBatch }: BatchCreateDialogProps) {
  const isEditMode = Boolean(initialBatch);
  const initialScheduled = initialBatch ? new Date(initialBatch.scheduledFor) : null;

  const [description, setDescription] = useState(initialBatch?.notes ?? '');
  const [scheduledDate, setScheduledDate] = useState(initialScheduled ? toDateInputValue(initialScheduled) : '');
  const [scheduledTime, setScheduledTime] = useState(initialScheduled ? toTimeInputValue(initialScheduled) : '08:00');
  const [priority, setPriority] = useState<BatchPriority>(initialBatch?.priority ?? 'MEDIUM');
  const [kitchenZone, setKitchenZone] = useState<KitchenZone>((initialBatch?.kitchenZone as KitchenZone) ?? 'HOT_KITCHEN');
  const [responsibleInput, setResponsibleInput] = useState(initialBatch?.responsible.join(', ') ?? '');

  const canSubmit = scheduledDate.trim() !== '' && scheduledTime.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const responsible = responsibleInput
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    await onSubmit({
      description: description.trim() || undefined,
      scheduledDate,
      scheduledTime,
      priority,
      kitchenZone,
      responsible,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-lg shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditMode ? 'Editar lote de producción' : 'Nuevo lote de producción'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del lote de producción"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha programada</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <Label>Hora programada</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as BatchPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zona de cocina</Label>
              <Select value={kitchenZone} onValueChange={(value) => setKitchenZone(value as KitchenZone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KITCHEN_ZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Responsables (separados por coma)</Label>
            <Input
              value={responsibleInput}
              onChange={(e) => setResponsibleInput(e.target.value)}
              placeholder="Ej: Lucía Fernández, Marcos Ruiz"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isEditMode
                ? isSubmitting
                  ? 'Guardando...'
                  : 'Guardar cambios'
                : isSubmitting
                  ? 'Creando...'
                  : 'Crear lote'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
