'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { SalaTask } from '@/hooks/use-sala-tasks';

interface SalaTaskCardProps {
  task: SalaTask;
  onClick: () => void;
}

// Arrastrable solo para moverse entre columnas (cambio de estado): el orden
// dentro de cada columna es cronológico, no manual.
export function SalaTaskCard({ task, onClick }: SalaTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const eventDate = new Date(task.eventDate);

  return (
    <div
      ref={setNodeRef}
      // Solo traslación: el transform de dnd-kit trae scaleX/scaleY = tamaño del
      // droppable bajo el cursor ÷ tamaño de la card, y aquí el droppable es la
      // columna entera → con CSS.Transform la card se estiraba al alto de la columna.
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={`tonal-layer-2 rounded-lg border border-border p-stack-md cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
        isDragging ? 'relative z-10 opacity-90 shadow-lg bg-surface-container-high' : ''
      }`}
    >
      <h4 className="font-body-lg text-body-lg text-primary truncate">{task.title}</h4>
      <div className="flex items-center gap-stack-sm mt-stack-xs text-on-surface-variant">
        <span className="font-label-sm text-label-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">event</span>
          {eventDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
        </span>
        {task.guestCount != null && (
          <span className="font-label-sm text-label-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">groups</span>
            {task.guestCount}
          </span>
        )}
      </div>
      {task.customerName && (
        <p className="font-label-sm text-label-sm text-on-surface-variant mt-stack-xs truncate flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">person</span>
          {task.customerName}
        </p>
      )}
    </div>
  );
}
