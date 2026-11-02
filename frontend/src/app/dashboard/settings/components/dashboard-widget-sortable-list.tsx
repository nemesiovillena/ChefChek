'use client';

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/components/ui/switch';
import { DASHBOARD_WIDGETS } from '@/features/dashboard-layout/dashboard-widgets';

const LABELS = new Map<string, string>(DASHBOARD_WIDGETS.map((w) => [w.id, w.label]));

/**
 * Cards de una pantalla: arriba las visibles, en el orden en que se pintan
 * (se arrastran por el asa); debajo las ocultas. Al activar una, entra al
 * final de las visibles.
 */
export function DashboardWidgetSortableList({
  widgets,
  onChange,
}: {
  widgets: string[];
  onChange: (widgets: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const hidden = DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => !widgets.includes(id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = widgets.indexOf(String(active.id));
    const to = widgets.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onChange(arrayMove(widgets, from, to));
  };

  return (
    <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-[var(--outline-variant)]">
      <p className="bg-[var(--surface-container-low)] px-3 py-1.5 text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
        Visibles · arrastra para ordenar
      </p>
      {widgets.length === 0 ? (
        <p className="px-3 py-3 text-sm text-[var(--on-surface-variant)]">
          Ninguna card: el inicio de este dispositivo quedará vacío.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-[var(--outline-variant)]">
              {widgets.map((id) => (
                <SortableWidgetRow key={id} id={id} onHide={() => onChange(widgets.filter((w) => w !== id))} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {hidden.length > 0 && (
        <>
          <p className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-1.5 text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
            Ocultas
          </p>
          <ul className="divide-y divide-[var(--outline-variant)]">
            {hidden.map((id) => (
              <li key={id}>
                <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-2 pl-11 pr-3 text-[var(--on-surface-variant)]">
                  {LABELS.get(id)}
                  <Switch checked={false} onCheckedChange={() => onChange([...widgets, id])} />
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SortableWidgetRow({ id, onHide }: { id: string; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      // Translate (no Transform): sin escalado, la fila no se deforma al arrastrar.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-h-[44px] items-center gap-2 bg-[var(--surface-container-lowest)] px-3 py-2 text-[var(--on-surface)] ${
        isDragging ? 'relative z-10 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${LABELS.get(id)}`}
        className="flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-[var(--on-surface-variant)] active:cursor-grabbing"
      >
        <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
      </button>
      <span className="flex-1">{LABELS.get(id)}</span>
      <Switch checked onCheckedChange={onHide} aria-label={`Ocultar ${LABELS.get(id)}`} />
    </li>
  );
}
