'use client';

import { useNotification } from '@/components/notification-system';
import { useRetireFoodLabels } from '@/hooks/use-food-labels';
import {
  fmtPortions,
  useAcknowledgeExpiredPortions,
  type ExpiredPortionLabel,
  type PortionShortfall,
} from '@/hooks/use-raciones';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));

const actionClass =
  'min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm font-medium hover:bg-[var(--surface-container-high)] disabled:opacity-50';

/**
 * Etiquetas caducadas que aún tienen raciones. La caducidad no descuenta
 * nada: alguien confirma si siguen sirviendo o las retira.
 */
export function ExpiredPortionsPanel({ labels }: { labels: ExpiredPortionLabel[] }) {
  const addNotification = useNotification();
  const acknowledge = useAcknowledgeExpiredPortions();
  const retire = useRetireFoodLabels();
  if (labels.length === 0) return null;

  const fail = (err: unknown) =>
    addNotification({ type: 'error', title: 'No se pudo guardar', message: (err as Error).message });

  return (
    <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <h3 className="font-semibold">Etiquetas caducadas con raciones: ¿siguen disponibles?</h3>
      <ul className="mt-2 space-y-2">
        {labels.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              <strong>{l.itemName}</strong> · {fmtPortions(l.portionsRemaining)} raciones · caducó{' '}
              {fmtDate(l.frozenUseByDate ?? l.useByDate)}
              <span className="ml-1 font-mono text-xs opacity-75">{l.lotNumber}</span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={actionClass}
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate(l.id, { onError: fail })}
              >
                Siguen disponibles
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={retire.isPending}
                onClick={() =>
                  retire.mutate({ ids: [l.id], disposition: 'DISCARDED' }, { onError: fail })
                }
              >
                Retirar (tirada)
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ventas sin raciones etiquetadas: se vendió más de lo que había contado. */
export function ShortfallPanel({ shortfalls }: { shortfalls: PortionShortfall[] }) {
  if (shortfalls.length === 0) return null;
  return (
    <section className="mb-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
      <h3 className="font-semibold">Vendido sin raciones (últimos 7 días)</h3>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
        Se vendió más de lo etiquetado o contado. Suele ser una etiqueta sin raciones o
        un recuento pendiente.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {shortfalls.map((s) => (
          <li key={s.id}>
            <strong>{s.counterName}</strong>: {fmtPortions(s.quantity)}{' '}
            {s.quantity === 1 ? 'ración' : 'raciones'} · {fmtDate(s.createdAt)}
          </li>
        ))}
      </ul>
    </section>
  );
}
