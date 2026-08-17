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
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useAuth } from '@/contexts/auth.context';
import {
  useDashboardKPIs,
  useCompleteProductionTask,
  useReorderProductionTasks,
} from '@/hooks/use-dashboard-kpis';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';
import { PostponeTaskDialog } from './postpone-task-dialog';
import { SortableTaskItem } from './sortable-task-item';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ProductionTasksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: kpis, isLoading } = useDashboardKPIs();
  const completeTask = useCompleteProductionTask();
  const reorderTasks = useReorderProductionTasks();
  const [postponingTask, setPostponingTask] = useState<UpcomingProductionTask | null>(null);
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

  const tasks = kpis?.upcomingProductionTasks ?? [];

  const handleComplete = async (e: React.MouseEvent, task: UpcomingProductionTask) => {
    e.stopPropagation();
    await completeTask.mutateAsync({ orderId: task.id, actualTime: task.estimatedTime ?? 0 });
  };

  const handlePostponeClick = (e: React.MouseEvent, task: UpcomingProductionTask) => {
    e.stopPropagation();
    setPostponingTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !kpis) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    queryClient.setQueryData(['dashboard-kpis'], {
      ...kpis,
      upcomingProductionTasks: reordered,
    });
    reorderTasks.mutate(reordered.map((t) => t.id));
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al dashboard
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tareas de preparación</h1>
        <p className="text-muted-foreground mt-1">{tasks.length} tarea(s) pendiente(s) o en curso</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay tareas de producción pendientes</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y">
                {tasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onNavigate={() => router.push(`/dashboard/production?batchId=${task.batchId}&orderId=${task.id}`)}
                    onComplete={(e) => handleComplete(e, task)}
                    onPostpone={(e) => handlePostponeClick(e, task)}
                    completeDisabled={completeTask.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {postponingTask && (
        <PostponeTaskDialog
          task={postponingTask}
          open={Boolean(postponingTask)}
          onOpenChange={(open) => {
            if (!open) setPostponingTask(null);
          }}
        />
      )}
    </div>
  );
}
