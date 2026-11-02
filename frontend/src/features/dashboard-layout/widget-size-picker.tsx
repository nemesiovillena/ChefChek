'use client';

import {
  DASHBOARD_MAX_COLS,
  DASHBOARD_MAX_ROWS,
  HEADER_ONLY_WIDGETS,
  WIDGET_LABELS,
  type DashboardWidgetSlot,
} from './dashboard-widgets';

const range = (max: number) => Array.from({ length: max }, (_, i) => i + 1);

/**
 * Ancho (columnas) y alto (filas) de una card, en el editor y en la vista
 * previa. El botón «Crear orden» va en la cabecera y no tiene tamaño.
 */
export function WidgetSizePicker({
  slot,
  onChange,
  className = '',
}: {
  slot: DashboardWidgetSlot;
  onChange: (slot: DashboardWidgetSlot) => void;
  className?: string;
}) {
  if (HEADER_ONLY_WIDGETS.has(slot.id)) return null;
  const label = WIDGET_LABELS.get(slot.id);
  const selectClass =
    'h-8 rounded-md border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-1 text-sm text-[var(--on-surface)] [color-scheme:light_dark]';

  return (
    <span className={`flex shrink-0 items-center gap-1 text-xs text-[var(--on-surface-variant)] ${className}`}>
      <select
        aria-label={`Ancho de ${label}`}
        value={slot.cols}
        onChange={(e) => onChange({ ...slot, cols: Number(e.target.value) })}
        // El arrastre de la vista previa no debe arrancar al tocar el selector.
        onPointerDown={(e) => e.stopPropagation()}
        className={selectClass}
      >
        {range(DASHBOARD_MAX_COLS).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      ×
      <select
        aria-label={`Alto de ${label}`}
        value={slot.rows}
        onChange={(e) => onChange({ ...slot, rows: Number(e.target.value) })}
        onPointerDown={(e) => e.stopPropagation()}
        className={selectClass}
      >
        {range(DASHBOARD_MAX_ROWS).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </span>
  );
}
