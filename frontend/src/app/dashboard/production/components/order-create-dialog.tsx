'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useStaffMembers } from '@/hooks/use-production-staff';
import type { CreateProductionOrderInput } from '@/hooks/use-production';

interface OrderCreateDialogProps {
  batchId: string;
  onClose: () => void;
  onSubmit: (input: CreateProductionOrderInput) => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Diálogo de creación de orden de producción: una tarea de cocina definida por
 * título + descripción + personal asignado. La asignación se hace aquí, en la
 * creación, eligiendo miembros del equipo (StaffMember) — por eso ya no hace
 * falta ni el panel de "Tareas y personal asignado" ni la hoja de mise en place.
 */
export default function OrderCreateDialog({ batchId, onClose, onSubmit, isSubmitting }: OrderCreateDialogProps) {
  const { staff, isLoading: isLoadingStaff } = useStaffMembers();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

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
    await onSubmit({
      batchId,
      title,
      description: description || undefined,
      assignedStaffIds: selectedStaff.length > 0 ? selectedStaff : undefined,
    });
  };

  const activeStaff = staff.filter((s) => s.isActive);

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm overflow-y-auto z-50 flex items-start justify-center p-4">
      <div className="relative top-8 mx-auto p-6 border w-full max-w-lg shadow-xl rounded-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Nueva orden de producción</h3>
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
            ) : activeStaff.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay miembros del equipo. Crea personal en la sección Personal.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {activeStaff.map((member) => {
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
              {isSubmitting ? 'Creando...' : 'Crear orden'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
