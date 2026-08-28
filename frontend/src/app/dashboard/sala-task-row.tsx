'use client';

import type { SalaTask } from '@/hooks/use-sala-tasks';

interface SalaTaskRowProps {
  task: SalaTask;
  onClick: () => void;
}

// Fila de solo lectura para el resumen del dashboard (sin drag-and-drop: la
// prioridad se reordena en el tablero Kanban de /dashboard/sala-notificaciones,
// donde sí tiene sentido porque cada columna es su propia cola de prioridad).
export function SalaTaskRow({ task, onClick }: SalaTaskRowProps) {
  const eventDate = new Date(task.eventDate);
  const inProgress = task.status === 'EN_CURSO';

  return (
    <div
      onClick={onClick}
      className="p-stack-md md:p-stack-lg flex items-center gap-stack-sm hover:bg-surface-variant transition-colors cursor-pointer select-none"
    >
      <div className="flex items-center gap-stack-xs md:gap-stack-sm min-w-0 flex-1">
        <div className={`w-2 h-12 shrink-0 rounded-full ${inProgress ? 'bg-secondary' : 'bg-primary'}`}></div>
        <div className="min-w-0">
          <h4 className="font-body-lg text-body-lg text-primary truncate">{task.title}</h4>
          {task.customerName && (
            <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[14px] shrink-0">person</span>
              <span className="truncate">{task.customerName}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-stack-sm shrink-0">
        {task.guestCount != null && (
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">groups</span>
            {task.guestCount}
          </span>
        )}
        <span className="font-label-md text-label-md text-secondary whitespace-nowrap">
          {eventDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    </div>
  );
}
