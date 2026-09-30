'use client';

import { Archive, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CHECKLIST_MODE_LABELS, type ChecklistTemplate } from '@/lib/sicted-types';

interface SictedPlanTemplateRowProps {
  template: ChecklistTemplate;
  selected: boolean;
  /** false con el buscador activo: ordenar una lista filtrada movería plantillas que no se ven. */
  canReorder: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

/** Fila del listado del Plan: marcar para exportar, asa para ordenar (solo escritorio), editar y archivar. */
export function SictedPlanTemplateRow({
  template: t,
  selected,
  canReorder,
  onToggleSelected,
  onEdit,
  onArchive,
}: SictedPlanTemplateRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id,
    disabled: !canReorder,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 ${
        isDragging ? 'relative z-10 shadow-lg' : ''
      }`}
    >
      {canReorder && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="-ml-2 hidden h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] active:cursor-grabbing md:flex"
          aria-label={`Mover ${t.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <label className="-my-3 flex cursor-pointer items-center self-stretch pr-1">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Marcar ${t.name} para exportar`}
        />
      </label>
      <button type="button" onClick={onEdit} className="flex-1 text-left">
        <p className="font-medium">{t.name}</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {t.area} · {CHECKLIST_MODE_LABELS[t.mode]} · v{t.version}
          {t.usedByModules.length > 1 && ` · compartida (${t.usedByModules.join(', ')})`}
        </p>
      </button>
      <button
        type="button"
        onClick={onArchive}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--error-container)]"
        aria-label="Archivar"
      >
        <Archive className="h-4 w-4" />
      </button>
    </div>
  );
}
