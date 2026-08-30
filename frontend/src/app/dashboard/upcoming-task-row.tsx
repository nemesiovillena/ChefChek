'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';

interface UpcomingTaskRowProps {
  task: UpcomingProductionTask;
  onComplete: (e: React.MouseEvent) => void;
  completeDisabled: boolean;
  /** Row click → production detail. Omit in read-only mode (Producción hidden). */
  onNavigate?: () => void;
  /** Postpone action. Omit in read-only mode. */
  onPostpone?: (e: React.MouseEvent) => void;
  /**
   * Read-only: no drag-reorder, no navigation, no postpone — only "complete".
   * Used for the restricted role that can see prep tasks but not Producción.
   */
  readOnly?: boolean;
}

/** Shared inner content — identical in draggable and read-only rows. */
function RowBody({
  task,
  onComplete,
  onPostpone,
  completeDisabled,
  showDragHandle,
}: {
  task: UpcomingProductionTask;
  onComplete: (e: React.MouseEvent) => void;
  onPostpone?: (e: React.MouseEvent) => void;
  completeDisabled: boolean;
  showDragHandle: boolean;
}) {
  const inProgress = task.status === 'IN_PROGRESS';
  const lotDate = new Date(task.lotDate);

  return (
    <>
      <div className="flex items-center gap-stack-xs md:gap-stack-sm min-w-0 flex-1">
        {showDragHandle && (
          <span
            title="Arrastrar para reordenar"
            className="shrink-0 flex items-center text-on-surface-variant/40 -ml-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
          </span>
        )}
        <div className={`w-2 h-12 shrink-0 rounded-full ${inProgress ? 'bg-secondary' : 'bg-primary'}`}></div>
        <div className="min-w-0">
          <h4 className="font-body-lg text-body-lg text-primary truncate">{task.title}</h4>
          <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
            <span className="material-symbols-outlined text-[14px] shrink-0">person</span>
            <span className="truncate">
              {task.assignedStaffNames.length > 0 ? task.assignedStaffNames.join(', ') : 'Sin asignar'}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-stack-xs md:gap-stack-lg shrink-0">
        <div className="text-right shrink-0">
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
              <span className="font-label-md text-label-md text-secondary whitespace-nowrap">
                {lotDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )}
        </div>
        {!inProgress && onPostpone && (
          <button
            type="button"
            onClick={onPostpone}
            onPointerDown={(e) => e.stopPropagation()}
            title="Posponer o trasladar tarea a otro lote"
            className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-variant/40 hover:bg-surface-variant hover:text-primary active:scale-90 transition-all duration-150 cursor-pointer"
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
          className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-full flex items-center justify-center text-secondary bg-secondary-container/15 hover:bg-secondary-container/30 hover:text-primary active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">task_alt</span>
        </button>
      </div>
    </>
  );
}

function SortableRow({
  task,
  onNavigate,
  onComplete,
  onPostpone,
  completeDisabled,
}: Omit<UpcomingTaskRowProps, 'readOnly'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onNavigate}
      {...attributes}
      {...listeners}
      className={`p-stack-md md:p-stack-lg flex items-center gap-stack-sm hover:bg-surface-variant transition-colors cursor-grab active:cursor-grabbing select-none active:scale-[0.995] duration-100 ${
        isDragging ? 'relative z-10 opacity-90 shadow-lg bg-surface-container-high' : ''
      }`}
    >
      <RowBody
        task={task}
        onComplete={onComplete}
        onPostpone={onPostpone}
        completeDisabled={completeDisabled}
        showDragHandle
      />
    </div>
  );
}

function ReadOnlyRow({
  task,
  onComplete,
  completeDisabled,
}: Pick<UpcomingTaskRowProps, 'task' | 'onComplete' | 'completeDisabled'>) {
  return (
    <div className="p-stack-md md:p-stack-lg flex items-center gap-stack-sm select-none">
      <RowBody
        task={task}
        onComplete={onComplete}
        completeDisabled={completeDisabled}
        showDragHandle={false}
      />
    </div>
  );
}

export function UpcomingTaskRow(props: UpcomingTaskRowProps) {
  if (props.readOnly) {
    return (
      <ReadOnlyRow
        task={props.task}
        onComplete={props.onComplete}
        completeDisabled={props.completeDisabled}
      />
    );
  }
  return (
    <SortableRow
      task={props.task}
      onNavigate={props.onNavigate}
      onComplete={props.onComplete}
      onPostpone={props.onPostpone}
      completeDisabled={props.completeDisabled}
    />
  );
}
