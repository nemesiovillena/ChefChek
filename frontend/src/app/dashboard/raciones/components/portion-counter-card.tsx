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

const chipClass = 'rounded-full px-2 py-0.5 text-xs font-semibold';
const actionClass =
  'min-h-[44px] flex-1 rounded-lg border border-[var(--outline-variant)] px-3 text-sm font-medium hover:bg-[var(--surface-container-high)]';

interface Props {
  counter: PortionCounter;
  canManage: boolean;
  onOpen: () => void;
  onRecount: () => void;
  onAdjust: () => void;
}

/**
 * Tarjeta de un plato con contador: raciones disponibles y acciones rápidas.
 * En móvil va compacta (nombre y cifra en una fila, avisos en línea); los
 * textos explicativos solo se muestran en pantallas grandes y en el detalle.
 */
export function PortionCounterCard({ counter, canManage, onOpen, onRecount, onAdjust }: Props) {
  const chip = STATE_CHIP[counter.state];
  const loadedInTpv = counter.loadSource === 'TPV';
  const border =
    counter.state === 'out'
      ? 'border-error'
      : counter.state === 'low'
        ? 'border-amber-500'
        : 'border-[var(--outline-variant)]';

  return (
    <div
      className={`flex flex-col rounded-xl border-2 bg-[var(--surface-container-low)] p-3 sm:p-4 ${border}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[44px] items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="line-clamp-2 font-semibold leading-snug text-[var(--on-surface)]">
            {counter.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--on-surface-variant)]">
            {chip && <span className={`${chipClass} ${chip.className}`}>{chip.label}</span>}
            {counter.cuinerMismatch && (
              <span className={`${chipClass} bg-error text-on-error`}>
                No cuadra: Cuiner {fmtPortions(counter.cuinerAvailable ?? 0)}
              </span>
            )}
            <span>
              {counter.activeLabels === 1 ? '1 etiqueta' : `${counter.activeLabels} etiquetas`}
              {counter.unlabeledPortions > 0 &&
                ` · ${fmtPortions(counter.unlabeledPortions)} sin etiqueta`}
              {counter.minPortions > 0 && ` · mín. ${fmtPortions(counter.minPortions)}`}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-2xl font-bold leading-none tabular-nums sm:text-3xl ${counter.state === 'out' ? 'text-error' : 'text-[var(--on-surface)]'}`}
          >
            {fmtPortions(counter.available)}
          </div>
          <div className="mt-1 text-xs text-[var(--on-surface-variant)]">raciones</div>
        </div>
      </button>

      {counter.dishes.length === 0 ? (
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          Sin platos de Cuiner enlazados
          <span className="hidden sm:inline">: las ventas no lo descuentan</span>.
        </p>
      ) : (
        <p className="mt-2 line-clamp-2 text-xs text-[var(--on-surface-variant)]">
          Cuiner: {counter.dishes.map((d) => d.name ?? d.producto).join(', ')}
        </p>
      )}

      {loadedInTpv ? (
        <p className="mt-3 hidden text-xs text-[var(--on-surface-variant)] sm:block">
          Se carga en el Contador de platos de Cuiner; aquí solo se muestra.
        </p>
      ) : (
        canManage && (
          <div className="mt-2 flex gap-2 sm:mt-3">
            <button type="button" onClick={onRecount} className={actionClass}>
              Recuento
            </button>
            <button type="button" onClick={onAdjust} className={actionClass}>
              Ajustar ±
            </button>
          </div>
        )
      )}
    </div>
  );
}
