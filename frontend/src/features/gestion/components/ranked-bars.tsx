import { formatEuros } from '../gestion-format';

export interface RankedItem {
  key: string;
  label: string;
  total: number;
  /** Texto secundario a la derecha (uds., %…). */
  detail?: string;
}

/**
 * Lista ordenada con barra proporcional (un solo color: magnitud, no identidad).
 * Sirve para platos más vendidos y reparto por familia.
 */
export function RankedBars({
  items,
  emptyText,
  max: maxOverride,
}: {
  items: RankedItem[];
  emptyText: string;
  /** Máximo de referencia para las barras; al paginar, el de toda la lista (no el de la página). */
  max?: number;
}) {
  const max = maxOverride ?? Math.max(...items.map((i) => i.total), 0);
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-[var(--on-surface)]" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--on-surface)]">
              {formatEuros(i.total)}
              {i.detail && <span className="ml-2 text-xs text-[var(--on-surface-variant)]">{i.detail}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-container-high)]">
            <div
              className="h-1.5 rounded-full bg-[var(--primary)]"
              style={{ width: `${max > 0 ? Math.max((i.total / max) * 100, 1) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
