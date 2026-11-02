'use client';

import { useRouter } from 'next/navigation';
import { usePortionOverview, type PortionState } from '@/hooks/use-raciones';

// Platos que se nombran en la card; el resto se resume en "+N más".
const COUNTER_LIST_LIMIT = 6;

/** Agotados primero, luego los que quedan pocos (mismo orden que la página). */
const STATE_ORDER: Record<PortionState, number> = { out: 0, low: 1, ok: 2 };
const STATE_CLASS: Record<PortionState, string> = {
  out: 'text-error font-bold',
  low: 'text-error',
  ok: 'text-primary',
};

/**
 * Card Raciones del dashboard: lo que queda de cada plato con contador, para
 * que sala sepa qué puede ofrecer. Se refresca sola cada minuto (ventas de
 * Cuiner). La card abre la página de Raciones.
 */
export function RacionesDashboardCard() {
  const router = useRouter();
  const { data, isLoading } = usePortionOverview();
  const active = (data?.counters ?? [])
    .filter((c) => c.active)
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name, 'es'));
  const outCount = active.filter((c) => c.state === 'out').length;
  const hidden = active.length - COUNTER_LIST_LIMIT;

  return (
    <div
      onClick={() => router.push('/dashboard/raciones')}
      className="tonal-layer-2 rounded-xl p-stack-lg md:p-stack-md flex flex-col gap-stack-md border border-border cursor-pointer hover:border-secondary transition-colors h-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-stack-sm">
        <div className="flex items-center gap-stack-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary">
            <span className="material-symbols-outlined text-[22px]">set_meal</span>
          </span>
          <div>
            <h5 className="font-label-md text-label-md text-primary uppercase tracking-wide">Raciones</h5>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Lo que queda de cada plato</p>
          </div>
        </div>
        {outCount > 0 && (
          <span className="rounded-full bg-error-container px-3 py-1 font-label-sm text-label-sm text-on-error-container">
            {outCount} {outCount === 1 ? 'agotado' : 'agotados'}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Cargando…</p>
      ) : active.length === 0 ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Sin platos con contador</p>
      ) : (
        <ul className="space-y-1">
          {active.slice(0, COUNTER_LIST_LIMIT).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-stack-md font-label-md text-label-md">
              <span className="min-w-0 truncate text-primary">{c.name}</span>
              <span className={`shrink-0 tabular-nums ${STATE_CLASS[c.state]}`}>
                {c.state === 'out' ? 'Agotado' : c.available}
              </span>
            </li>
          ))}
          {hidden > 0 && <li className="font-label-sm text-label-sm text-on-surface-variant">+{hidden} más</li>}
        </ul>
      )}
    </div>
  );
}
