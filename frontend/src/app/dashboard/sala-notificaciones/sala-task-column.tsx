'use client';

import { useDroppable } from '@dnd-kit/core';
import type { SalaTask, SalaTaskStatus } from '@/hooks/use-sala-tasks';
import { SalaTaskCard } from './sala-task-card';

interface SalaTaskColumnProps {
  status: SalaTaskStatus;
  title: string;
  tasks: SalaTask[];
  onTaskClick: (task: SalaTask) => void;
}

export function SalaTaskColumn({ status, title, tasks, onTaskClick }: SalaTaskColumnProps) {
  // Droppable propio en la columna: permite soltar una card sobre una
  // columna vacía (o en el hueco tras la última card), no solo sobre otra card.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="tonal-layer-2 rounded-xl border border-border flex flex-col min-h-[240px]">
      <div className="p-stack-md border-b border-surface-variant flex justify-between items-center bg-surface-container-low rounded-t-xl">
        <h4 className="font-label-md text-label-md text-primary uppercase tracking-wide">{title}</h4>
        <span className="font-label-sm text-label-sm text-on-surface-variant px-stack-sm py-0.5 bg-surface-variant rounded-full">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-stack-sm space-y-stack-sm transition-colors ${isOver ? 'bg-secondary-container/10' : ''}`}
      >
        {tasks.length === 0 ? (
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant py-stack-lg">
            Sin notificaciones
          </p>
        ) : (
          tasks.map((task) => (
            <SalaTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}
