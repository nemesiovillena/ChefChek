'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import {
  compareSalaTasksByEventDate,
  useSalaTasks,
  useReorderSalaTasks,
  type SalaTask,
  type SalaTaskStatus,
} from '@/hooks/use-sala-tasks';
import { SalaTaskColumn } from './sala-task-column';
import { SalaTaskModal } from '@/components/sala-tasks/sala-task-modal';

export const dynamic = 'force-dynamic';

const COLUMNS: { status: SalaTaskStatus; title: string }[] = [
  { status: 'PENDIENTE', title: 'Pendiente' },
  { status: 'EN_CURSO', title: 'En curso' },
  { status: 'COMPLETADO', title: 'Completado' },
];

function groupByStatus(tasks: SalaTask[]): Record<SalaTaskStatus, SalaTask[]> {
  const grouped: Record<SalaTaskStatus, SalaTask[]> = {
    PENDIENTE: [],
    EN_CURSO: [],
    COMPLETADO: [],
  };
  for (const task of tasks) {
    grouped[task.status]?.push(task);
  }
  for (const status of Object.keys(grouped) as SalaTaskStatus[]) {
    grouped[status].sort(compareSalaTasksByEventDate);
  }
  return grouped;
}

export default function SalaNotificacionesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: tasks, isLoading } = useSalaTasks();
  const reorderTasks = useReorderSalaTasks();
  const [editingTask, setEditingTask] = useState<SalaTask | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const grouped = groupByStatus(tasks ?? []);
  const isStatus = (id: string): id is SalaTaskStatus =>
    id === 'PENDIENTE' || id === 'EN_CURSO' || id === 'COMPLETADO';
  const findStatusOf = (id: string): SalaTaskStatus | undefined =>
    (Object.keys(grouped) as SalaTaskStatus[]).find((status) =>
      grouped[status].some((t) => t.id === id),
    );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !tasks) return;

    const sourceStatus = findStatusOf(String(active.id));
    if (!sourceStatus) return;

    const destStatus = isStatus(String(over.id))
      ? (over.id as SalaTaskStatus)
      : findStatusOf(String(over.id));
    // El orden dentro de cada columna es cronológico: arrastrar solo sirve
    // para mover la notificación a otra columna (cambiar su estado).
    if (!destStatus || sourceStatus === destStatus) return;

    const nextTasks = tasks.map((t) =>
      t.id === active.id ? { ...t, status: destStatus } : t,
    );
    queryClient.setQueryData(['sala-tasks'], nextTasks);

    // sortOrder ya no gobierna la visualización, pero el endpoint de reorder
    // lo exige (>= 0): se envían índices secuenciales de las columnas afectadas.
    const items = nextTasks
      .filter((t) => t.status === sourceStatus || t.status === destStatus)
      .map((t, i) => ({ id: t.id, status: t.status, sortOrder: i }));
    reorderTasks.mutate(items);
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al dashboard
      </Button>

      <div className="flex items-center justify-between mb-stack-xl">
        <div>
          <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Sala</span>
          <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Notificaciones de Sala</h2>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {COLUMNS.map((column) => (
              <SalaTaskColumn
                key={column.status}
                status={column.status}
                title={column.title}
                tasks={grouped[column.status]}
                onTaskClick={setEditingTask}
              />
            ))}
          </div>
        </DndContext>
      )}

      <SalaTaskModal
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
      />
      <SalaTaskModal open={isCreating} onOpenChange={setIsCreating} />
    </div>
  );
}
