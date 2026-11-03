'use client';

import { fmtPortions, type PortionCounter, type PortionState } from '@/hooks/use-raciones';

const STATE_CHIP: Record<PortionState, { label: string; className: string } | null> = {
  ok: null,
  low: {
    label: 'Quedan pocas',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  out: { label: 'Agotado', className: 'bg-error text-on-error' },
};

interface Props {
  counter: PortionCounter;
  canManage: boolean;
  onOpen: () => void;
  onRecount: () => void;
  onAdjust: () => void;
}

/** Tarjeta de un plato con contador: raciones disponibles y acciones rápidas. */
export function PortionCounterCard({ counter, canManage, onOpen, onRecount, onAdjust }: Props) {
  const chip = STATE_CHIP[counter.state];
  const border =
    counter.state === 'out'
      ? 'border-error'
      : counter.state === 'low'
        ? 'border-amber-500'
        : 'border-[var(--outline-variant)]';

  return (
    <div
      className={`flex flex-col rounded-xl border-2 bg-[var(--surface-container-low)] p-4 ${border}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[44px] items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="font-semibold text-[var(--on-surface)]">{counter.name}</div>
          <div className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
            {counter.activeLabels === 1
              ? '1 etiqueta'
              : `${counter.activeLabels} etiquetas`}
            {counter.unlabeledPortions > 0 &&
              ` · ${fmtPortions(counter.unlabeledPortions)} sin etiqueta`}
            {counter.minPortions > 0 && ` · mínimo ${fmtPortions(counter.minPortions)}`}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-3xl font-bold leading-none tabular-nums ${counter.state === 'out' ? 'text-error' : 'text-[var(--on-surface)]'}`}
          >
            {fmtPortions(counter.available)}
          </div>
          <div className="mt-1 text-xs text-[var(--on-surface-variant)]">raciones</div>
        </div>
      </button>

      {chip && (
        <span
          className={`mt-2 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.className}`}
        >
          {chip.label}
        </span>
      )}

      {counter.cuinerMismatch && (
        <span className="mt-2 self-start rounded-full bg-error px-2.5 py-0.5 text-xs font-semibold text-on-error">
          No cuadra: Cuiner marca {fmtPortions(counter.cuinerAvailable ?? 0)}
        </span>
      )}

      {counter.dishes.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          Sin platos de Cuiner enlazados: las ventas no lo descuentan.
        </p>
      ) : (
        <p className="mt-2 truncate text-xs text-[var(--on-surface-variant)]">
          Cuiner: {counter.dishes.map((d) => d.name ?? d.producto).join(', ')}
        </p>
      )}

      {canManage && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRecount}
            className="min-h-[44px] flex-1 rounded-lg border border-[var(--outline-variant)] px-3 text-sm font-medium hover:bg-[var(--surface-container-high)]"
          >
            Recuento
          </button>
          <button
            type="button"
            onClick={onAdjust}
            className="min-h-[44px] flex-1 rounded-lg border border-[var(--outline-variant)] px-3 text-sm font-medium hover:bg-[var(--surface-container-high)]"
          >
            Ajustar ±
          </button>
        </div>
      )}
    </div>
  );
}
