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
    grouped[status].sort((a, b) => a.sortOrder - b.sortOrder);
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
    if (!destStatus) return;
    if (sourceStatus === destStatus && active.id === over.id) return;

    const next = { ...grouped, [sourceStatus]: [...grouped[sourceStatus]], [destStatus]: [...grouped[destStatus]] };
    const sourceList = next[sourceStatus];
    const activeIndex = sourceList.findIndex((t) => t.id === active.id);
    if (activeIndex === -1) return;
    const [moved] = sourceList.splice(activeIndex, 1);

    if (sourceStatus === destStatus) {
      const overIndex = sourceList.findIndex((t) => t.id === over.id);
      sourceList.splice(overIndex === -1 ? sourceList.length : overIndex, 0, moved);
    } else {
      const destList = next[destStatus];
      const overIndex = destList.findIndex((t) => t.id === over.id);
      destList.splice(overIndex === -1 ? destList.length : overIndex, 0, { ...moved, status: destStatus });
    }

    // Reescribe sortOrder en cada card de las columnas afectadas ANTES de
    // cachear: si no, el cache optimista sigue con el sortOrder viejo y
    // groupByStatus() lo revierte visualmente en el siguiente render hasta
    // que responde el reorder (y un segundo drag rápido operaría sobre esa
    // lista ya desincronizada).
    next[sourceStatus] = next[sourceStatus].map((t, i) => ({ ...t, sortOrder: i }));
    next[destStatus] = next[destStatus].map((t, i) => ({ ...t, sortOrder: i }));

    const flat = COLUMNS.flatMap((c) => next[c.status]);
    queryClient.setQueryData(['sala-tasks'], flat);

    const affectedStatuses = new Set([sourceStatus, destStatus]);
    const items = flat
      .filter((t) => affectedStatuses.has(t.status))
      .map((t) => ({ id: t.id, status: t.status, sortOrder: t.sortOrder }));
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
