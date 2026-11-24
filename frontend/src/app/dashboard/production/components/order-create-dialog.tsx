'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useStaffMembers } from '@/hooks/use-production-staff';
import type { ProductionOrder, UpdateProductionOrderInput } from '@/hooks/use-production';

interface OrderCreateDialogProps {
  initialOrder?: ProductionOrder;
  onClose: () => void;
  onSubmit: (input: UpdateProductionOrderInput) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Diálogo de creación y edición de orden de producción: una tarea de cocina
 * definida por título + descripción + personal asignado, elegido entre los
 * miembros del equipo (StaffMember). Con `initialOrder` funciona en modo edición.
 */
export default function OrderCreateDialog({ initialOrder, onClose, onSubmit, isSubmitting }: OrderCreateDialogProps) {
  const isEditMode = Boolean(initialOrder);
  const addNotification = useNotification();
  const { staff, isLoading: isLoadingStaff } = useStaffMembers();
  const [title, setTitle] = useState(initialOrder?.title ?? '');
  const [description, setDescription] = useState(initialOrder?.description ?? '');
  const [selectedStaff, setSelectedStaff] = useState<string[]>(initialOrder?.assignedStaffIds ?? []);

  const canSubmit = title.trim() !== '' && !isSubmitting;

  const toggleStaff = (staffId: string) => {
    setSelectedStaff((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        assignedStaffIds: selectedStaff,
      });
    } catch (e) {
      // El modal sigue abierto para no perder lo escrito.
      addNotification({
        type: 'error',
        title: isEditMode ? 'No se pudo guardar la orden' : 'No se pudo crear la orden',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  // Los inactivos ya asignados siguen visibles para poder verlos y quitarlos.
  const selectableStaff = staff.filter(
    (s) => s.isActive || initialOrder?.assignedStaffIds?.includes(s.id),
  );

  return (
    <div className="fixed inset-0 bg-black/55 overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-lg shadow-xl rounded-lg bg-surface-raised border-line-soft mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-text-strong">
            {isEditMode ? 'Editar orden de producción' : 'Nueva orden de producción'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-text-muted dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Limpiar la freidora, Marinar el pollo..."
            />
          </div>

          <div>
            <Label>Descripción (opcional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Explica la tarea..."
            />
          </div>

          <div>
            <Label>Personal asignado (opcional)</Label>
            {isLoadingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando equipo...
              </div>
            ) : selectableStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay miembros del equipo. Crea personal en la sección Personal.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectableStaff.map((member) => {
                  const selected = selectedStaff.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleStaff(member.id)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition-colors ' +
                        (selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background hover:bg-accent')
                      }
                    >
                      {member.name}
                      {member.role ? <span className="opacity-60"> · {member.role}</span> : null}
                      {!member.isActive ? <span className="opacity-60"> · inactivo</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isEditMode
                ? isSubmitting ? 'Guardando...' : 'Guardar cambios'
                : isSubmitting ? 'Creando...' : 'Crear orden'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
