'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';

interface UpcomingTaskRowProps {
  task: UpcomingProductionTask;
  onNavigate: () => void;
  onComplete: (e: React.MouseEvent) => void;
  onPostpone: (e: React.MouseEvent) => void;
  completeDisabled: boolean;
}

export function UpcomingTaskRow({
  task,
  onNavigate,
  onComplete,
  onPostpone,
  completeDisabled,
}: UpcomingTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const inProgress = task.status === 'IN_PROGRESS';
  const lotDate = new Date(task.lotDate);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onNavigate}
      {...attributes}
      {...listeners}
      className={`p-stack-lg flex items-center justify-between hover:bg-surface-variant transition-colors cursor-grab active:cursor-grabbing select-none active:scale-[0.995] duration-100 ${
        isDragging ? 'relative z-10 opacity-90 shadow-lg bg-surface-container-high' : ''
      }`}
    >
      <div className="flex items-center gap-stack-md">
        <span
          title="Arrastrar para reordenar"
          className="w-7 h-7 shrink-0 rounded flex items-center justify-center text-on-surface-variant/50"
        >
          <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
        </span>
        <div className={`w-2 h-12 rounded-full ${inProgress ? 'bg-secondary' : 'bg-primary'}`}></div>
        <div>
          <h4 className="font-body-lg text-body-lg text-primary">{task.title}</h4>
          <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
            <span className="material-symbols-outlined text-[14px]">person</span>
            {task.assignedStaffNames.length > 0 ? task.assignedStaffNames.join(', ') : 'Sin asignar'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-stack-lg">
        <div className="text-right">
          {inProgress ? (
            <div className="flex flex-col items-end">
              <span className="material-symbols-outlined text-secondary animate-pulse">progress_activity</span>
              <p className="text-[10px] text-secondary font-label-sm mt-1 uppercase">En progreso</p>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              {task.isPostponed && (
                <span className="text-[10px] text-secondary font-label-sm uppercase">Pospuesta</span>
              )}
              <span className="font-label-md text-label-md text-secondary">
                {lotDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )}
        </div>
        {!inProgress && (
          <button
            type="button"
            onClick={onPostpone}
            onPointerDown={(e) => e.stopPropagation()}
            title="Posponer tarea a otra fecha"
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-variant/40 hover:bg-surface-variant hover:text-primary active:scale-90 transition-all duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">event_repeat</span>
          </button>
        )}
        <button
          type="button"
          onClick={onComplete}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={completeDisabled}
          title="Marcar tarea como completada"
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-secondary bg-secondary-container/15 hover:bg-secondary-container/30 hover:text-primary active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">task_alt</span>
        </button>
      </div>
    </div>
  );
}
