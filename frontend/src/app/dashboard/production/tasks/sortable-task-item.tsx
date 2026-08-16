'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GripVertical, User, CheckCircle2, CalendarClock } from 'lucide-react';
import type { UpcomingProductionTask } from '@/hooks/use-dashboard-kpis';

interface SortableTaskItemProps {
  task: UpcomingProductionTask;
  onNavigate: () => void;
  onComplete: (e: React.MouseEvent) => void;
  onPostpone: (e: React.MouseEvent) => void;
  completeDisabled: boolean;
}

export function SortableTaskItem({
  task,
  onNavigate,
  onComplete,
  onPostpone,
  completeDisabled,
}: SortableTaskItemProps) {
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
      className={`p-3 md:p-4 flex items-center gap-2 md:gap-4 hover:bg-muted/40 transition-colors cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'relative z-10 opacity-90 shadow-lg bg-background' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 md:gap-4 min-w-0 flex-1">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 -mx-1" />
        <div className={`w-2 h-10 rounded-full shrink-0 ${inProgress ? 'bg-secondary' : 'bg-primary'}`} />
        <div className="min-w-0">
          <p className="font-medium truncate">{task.title}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {task.assignedStaffNames.length > 0 ? task.assignedStaffNames.join(', ') : 'Sin asignar'}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <div className="text-right shrink-0">
          {inProgress ? (
            <Badge>En progreso</Badge>
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              {task.isPostponed && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                  Pospuesta
                </Badge>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {lotDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )}
        </div>
        {!inProgress && (
          <Button
            size="icon-sm"
            variant="outline"
            onClick={onPostpone}
            onPointerDown={(e) => e.stopPropagation()}
            title="Posponer tarea a otra fecha"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="outline"
          onClick={onComplete}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={completeDisabled}
          title="Marcar tarea como completada"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
