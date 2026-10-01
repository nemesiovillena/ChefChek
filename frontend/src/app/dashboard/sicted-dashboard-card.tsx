'use client';

import { useRouter } from 'next/navigation';
import { useSictedStatus } from '@/hooks/use-sicted';

// Hojas pendientes que se nombran en la card; el resto se resume en "+N más".
const PENDING_LIST_LIMIT = 4;

/**
 * Card SICTED del dashboard: hojas de hoy que faltan (con su nombre), y avisos
 * de hojas por validar (último mes, no solo hoy) y vencidas sin completar.
 * La card abre Hojas de hoy; los avisos abren la portada SICTED, que los lista.
 */
export function SictedDashboardCard() {
  const router = useRouter();
  const { runsToday, pendingToday, pendingValidation, overdue, isLoading } = useSictedStatus();
  const hidden = pendingToday.length - PENDING_LIST_LIMIT;

  const openHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push('/dashboard/sicted');
  };

  return (
    <div
      onClick={() => router.push('/dashboard/sicted/hoy')}
      className="group tonal-layer-2 rounded-xl p-stack-lg md:p-stack-md flex flex-col gap-stack-md border border-border cursor-pointer hover:border-secondary transition-colors h-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-stack-sm">
        <div className="flex items-center gap-stack-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary">
            <span className="material-symbols-outlined text-[22px]">verified</span>
          </span>
          <div>
            <h5 className="font-label-md text-label-md text-primary uppercase tracking-wide">SICTED</h5>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Hojas de hoy</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-stack-sm">
          {pendingValidation.length > 0 && (
            <button
              type="button"
              onClick={openHub}
              className="rounded-full border border-secondary px-3 py-1 font-label-sm text-label-sm text-secondary hover:bg-surface-container-low"
            >
              {pendingValidation.length} por validar
            </button>
          )}
          {overdue.length > 0 && (
            <button
              type="button"
              onClick={openHub}
              className="rounded-full bg-error-container px-3 py-1 font-label-sm text-label-sm text-on-error-container"
            >
              {overdue.length} {overdue.length === 1 ? 'vencida' : 'vencidas'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Cargando…</p>
      ) : runsToday.length === 0 ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Sin hojas para hoy</p>
      ) : pendingToday.length === 0 ? (
        <p className="flex items-center gap-stack-sm font-headline-md text-headline-md text-primary">
          <span className="material-symbols-outlined text-[28px]">task_alt</span>
          Todo hecho por hoy
        </p>
      ) : (
        <div className="flex flex-col gap-stack-md md:flex-row md:items-start">
          <div className="md:w-32 md:shrink-0">
            <span className="font-headline-lg text-headline-lg text-primary">{pendingToday.length}</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              de {runsToday.length} por hacer
            </p>
          </div>
          <ul className="min-w-0 flex-1 space-y-1">
            {pendingToday.slice(0, PENDING_LIST_LIMIT).map((run) => (
              <li key={run.id} className="flex min-w-0 items-center gap-stack-sm font-label-md text-label-md text-primary">
                <span className="material-symbols-outlined shrink-0 text-[16px] text-on-surface-variant">
                  radio_button_unchecked
                </span>
                <span className="truncate">
                  {run.template.name}
                  <span className="text-on-surface-variant"> · {run.template.area}</span>
                </span>
              </li>
            ))}
            {hidden > 0 && <li className="font-label-sm text-label-sm text-on-surface-variant">+{hidden} más</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
