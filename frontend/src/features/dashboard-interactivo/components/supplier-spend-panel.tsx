import Link from 'next/link';
import { formatEuro } from '@/lib/utils';
import { formatChange, SPEND_PERIOD_LABELS, type SpendPeriod, useSupplierSpend } from '../dashboard-interactivo-api';
import { PanelEmpty, PanelError, PanelLoading } from './panel-state';

const PERIODS = Object.keys(SPEND_PERIOD_LABELS) as SpendPeriod[];

/** Gasto por proveedor: importe sin IVA de las líneas de albaranes confirmados frente al periodo anterior de igual duración. */
export function SupplierSpendPanel({ period, onPeriodChange }: { period: SpendPeriod; onPeriodChange: (p: SpendPeriod) => void }) {
  const { data, isLoading, error } = useSupplierSpend(period);
  const max = Math.max(...(data?.suppliers.map((s) => s.amount) ?? [0]), 1);

  return (
    <section aria-labelledby="spend-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="spend-title" className="text-lg font-semibold text-primary">Compras por proveedor</h2>
          <p className="text-sm text-on-surface-variant">
            Importe sin IVA de las líneas de los albaranes confirmados, comparado con el periodo anterior de la misma duración.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          Periodo
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as SpendPeriod)}
            className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{SPEND_PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <PanelLoading what="las compras" />}
      {error && <PanelError error={error} />}
      {data && data.suppliers.length === 0 && (
        <PanelEmpty title="Sin compras confirmadas en este periodo">
          Aparecerán al confirmar albaranes en <Link href="/dashboard/albaranes" className="underline">Albaranes</Link>.
        </PanelEmpty>
      )}
      {data && data.suppliers.length > 0 && (
        <>
          <p className="text-sm text-on-surface-variant">
            Total: <span className="font-semibold text-primary">{formatEuro(data.total)}</span>
            {' · '}
            {formatChange(data.changePercent)} frente a {formatEuro(data.previousTotal)}
          </p>
          <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {data.suppliers.map((s) => (
              <li key={s.supplierId ?? 'none'} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 p-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto_auto] sm:items-center">
                <span className="truncate font-medium text-on-surface">{s.supplierName}</span>
                <span aria-hidden className="order-last col-span-2 h-1.5 rounded-full bg-surface-container-high sm:order-none sm:col-span-1">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(Math.max(s.amount, 0) / max) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-primary">{formatEuro(s.amount)}</span>
                <span
                  className={`hidden text-right text-sm tabular-nums sm:block ${s.changePercent !== null && s.changePercent > 0 ? 'text-error' : 'text-on-surface-variant'}`}
                  title={`Periodo anterior: ${formatEuro(s.previousAmount)} · ${s.albaranes} albarán(es) en este periodo`}
                >
                  {formatChange(s.changePercent)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
