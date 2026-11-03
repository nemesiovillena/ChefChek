'use client';

import type { SalaTask } from '@/hooks/use-sala-tasks';

interface SalaTaskRowProps {
  task: SalaTask;
  onClick: () => void;
}

// Fila de solo lectura para el resumen del dashboard (sin drag-and-drop: aquí
// el orden es cronológico por fecha del evento; el Kanban de
// /dashboard/sala-notificaciones permite arrastrar entre columnas de estado).
export function SalaTaskRow({ task, onClick }: SalaTaskRowProps) {
  const eventDate = new Date(task.eventDate);

  return (
    <div
      onClick={onClick}
      className="p-stack-md @md:px-stack-lg flex flex-wrap @md:flex-nowrap items-center gap-stack-sm hover:bg-surface-variant transition-colors cursor-pointer select-none"
    >
      {/* Por ancho de la card (@container en el board), no de la pantalla: en
          una card estrecha el título ocupa la línea entera y comensales y
          fecha bajan a otra, alineados a la derecha. */}
      <div className="flex items-center gap-stack-xs @md:gap-stack-sm min-w-0 flex-1 basis-full @md:basis-auto">
        <div className="w-2 h-10 shrink-0 rounded-full bg-primary"></div>
        <div className="min-w-0">
          {/* Card estrecha: el nombre del evento puede ocupar 2 líneas antes de cortarse. */}
          <h4 className="font-body-lg text-body-lg text-primary line-clamp-2 break-words @md:line-clamp-none @md:truncate">
            {task.title}
          </h4>
          {task.customerName && (
            <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[14px] shrink-0">person</span>
              <span className="truncate">{task.customerName}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-stack-sm shrink-0 ml-auto">
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
