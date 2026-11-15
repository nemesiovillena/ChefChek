'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { SalaTask, SalaTaskStatus } from '@/hooks/use-sala-tasks';
import PaginationControls from '@/components/shared/pagination-controls';
import { SalaTaskCard } from './sala-task-card';

const DEFAULT_PAGE_SIZE = 10;

interface SalaTaskColumnProps {
  status: SalaTaskStatus;
  title: string;
  tasks: SalaTask[];
  onTaskClick: (task: SalaTask) => void;
  /** Muestra las tareas por páginas (la columna de completadas crece sin fin). */
  paginate?: boolean;
}

export function SalaTaskColumn({ status, title, tasks, onTaskClick, paginate = false }: SalaTaskColumnProps) {
  // Droppable propio en la columna: permite soltar una card sobre una
  // columna vacía (o en el hueco tras la última card), no solo sobre otra card.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const totalPages = paginate ? Math.max(1, Math.ceil(tasks.length / pageSize)) : 1;
  // Si se completan o borran tareas y la página actual se queda vacía,
  // se muestra la última que tenga contenido.
  const currentPage = Math.min(page, totalPages);
  const visibleTasks = paginate
    ? tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : tasks;
  const showPagination = paginate && tasks.length > DEFAULT_PAGE_SIZE;

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
          visibleTasks.map((task) => (
            <SalaTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        )}
      </div>
      {showPagination && (
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          total={tasks.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          emptyLabel="Sin notificaciones"
        />
      )}
    </div>
  );
}
