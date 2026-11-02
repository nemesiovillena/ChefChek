'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WidgetSizePicker } from '@/features/dashboard-layout/widget-size-picker';
import { WIDGET_LABELS, type DashboardWidgetSlot } from '@/features/dashboard-layout/dashboard-widgets';

/** Sin desplazar las demás mientras se arrastra: con tamaños distintos, el hueco solo se resuelve al soltar. */
const noShiftStrategy = () => null;

/**
 * Inicio de un dispositivo configurado. Desde md: rejilla de 3 columnas que
 * ocupa el alto que le deja la página (las filas se reparten el alto, nada de
 * scroll); cada card ocupa su ancho × alto y las listas muestran lo que cabe.
 * En móvil: una columna con cada card a su tamaño natural.
 *
 * `onChange` (vista previa del administrador): las cards se arrastran para
 * ordenarlas y se les cambia el tamaño encima de la propia pantalla.
 */
export function ConfiguredDashboardGrid({
  slots,
  renderCard,
  onChange,
}: {
  slots: DashboardWidgetSlot[];
  /** fill = la card llena su celda (escritorio); false = alto natural (móvil). Falsy = no se pinta. */
  renderCard: (id: string, fill: boolean) => ReactNode;
  onChange?: (slots: DashboardWidgetSlot[]) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const cells = slots
    .map((slot) => ({ slot, card: renderCard(slot.id, true) }))
    .filter((c) => Boolean(c.card));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!onChange || !over || active.id === over.id) return;
    const ids = slots.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onChange(arrayMove(slots, from, to));
  };
  const resize = (next: DashboardWidgetSlot) =>
    onChange?.(slots.map((s) => (s.id === next.id ? next : s)));

  const grid = (
    <div className="hidden md:grid md:flex-1 md:min-h-0 mt-stack-md grid-cols-3 auto-rows-[minmax(0,1fr)] grid-flow-row-dense gap-gutter">
      {cells.map(({ slot, card }) =>
        onChange ? (
          <EditableCell key={slot.id} slot={slot} onResize={resize}>
            {card}
          </EditableCell>
        ) : (
          <div key={slot.id} className={CELL_CLASS} style={spanStyle(slot)}>
            {card}
          </div>
        ),
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-gutter mt-stack-xl md:hidden">
        {slots.map((slot) => {
          const card = renderCard(slot.id, false);
          return card ? <div key={slot.id}>{card}</div> : null;
        })}
      </div>
      {onChange ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cells.map((c) => c.slot.id)} strategy={noShiftStrategy}>
            {grid}
          </SortableContext>
        </DndContext>
      ) : (
        grid
      )}
    </>
  );
}

// La card hija llena la celda; min-h-0 (con !) anula los mínimos de las cards
// pensadas para el bento (min-h-[150px]…) para que nunca desborden su fila.
const CELL_CLASS =
  'relative min-h-0 min-w-0 flex flex-col overflow-hidden [&>*:not([data-cell-tools])]:flex-1 [&>*:not([data-cell-tools])]:min-h-0!';

const spanStyle = (slot: DashboardWidgetSlot): CSSProperties => ({
  gridColumn: `span ${slot.cols} / span ${slot.cols}`,
  gridRow: `span ${slot.rows} / span ${slot.rows}`,
});

function EditableCell({
  slot,
  onResize,
  children,
}: {
  slot: DashboardWidgetSlot;
  onResize: (slot: DashboardWidgetSlot) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({ id: slot.id });
  return (
    <div
      ref={setNodeRef}
      className={`${CELL_CLASS} rounded-xl outline-2 outline-dashed ${
        isOver && !isDragging ? 'outline-secondary' : 'outline-transparent'
      } ${isDragging ? 'z-20 opacity-80 shadow-2xl' : ''}`}
      // Translate (no Transform): la card arrastrada no se deforma.
      style={{ ...spanStyle(slot), transform: CSS.Translate.toString(transform) }}
    >
      {children}
      {/* Capa de edición: toda la card se coge para arrastrar (y no navega al pulsarla). */}
      <div
        data-cell-tools
        {...attributes}
        {...listeners}
        aria-label={`Mover ${WIDGET_LABELS.get(slot.id)}`}
        className="absolute inset-0 z-10 cursor-grab touch-none rounded-xl border-2 border-dashed border-secondary/40 active:cursor-grabbing"
      >
        <div className="absolute right-2 top-2 flex items-center gap-2 rounded-lg bg-surface-container-high/95 px-2 py-1 shadow">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">drag_indicator</span>
          <WidgetSizePicker slot={slot} onChange={onResize} />
        </div>
      </div>
    </div>
  );
}
