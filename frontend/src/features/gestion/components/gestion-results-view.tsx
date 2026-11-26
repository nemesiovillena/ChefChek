'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import { useGestionResults } from '../api/gestion-results-api';
import { formatEuros } from '../gestion-format';
import { ExpensesManager } from './expenses-manager';
import { GestionReportTable } from './gestion-report-table';
import { KpiCard } from './kpi-card';

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';
const titleCls = 'mb-3 text-sm font-semibold text-[var(--on-surface)]';
const pctText = (p: number | null) => (p === null ? '—' : `${p.toLocaleString('es-ES')} %`);

/**
 * Resultados del año: cuenta de explotación por meses (ventas − compras −
 * personal − gastos generales = EBITDA), punto de equilibrio y los gastos
 * generales, que se introducen aquí.
 */
export function GestionResultsView() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, isLoading, isFetching, error } = useGestionResults(year);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <label className="flex min-w-[9rem] flex-col">
          <span className={labelCls}>Año</span>
          <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3 pb-3 text-sm">
          <Link href="/dashboard/gestion/informes/cuenta-explotacion" className="text-[var(--primary)] underline">
            Exportar cuenta de explotación
          </Link>
          <Link href="/dashboard/gestion/informes/flujo-caja" className="text-[var(--primary)] underline">
            Flujo de caja
          </Link>
        </div>
        {isFetching && <Loader2 className="mb-3 h-4 w-4 animate-spin text-[var(--on-surface-variant)]" aria-label="Actualizando" />}
      </div>

      {error && <p className="text-sm text-[var(--error)]">No se pudo calcular: {error.message}</p>}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Ventas sin IVA" value={formatEuros(data.totals.sales)} />
            <KpiCard
              label="EBITDA"
              value={formatEuros(data.totals.ebitda)}
              compareText={`${pctText(data.totals.ebitdaPct)} de las ventas`}
            />
            <KpiCard
              label="Margen bruto"
              value={formatEuros(data.totals.grossMargin)}
              compareText={`compras ${pctText(data.breakEven.variablePct)} de las ventas (meses cerrados con albaranes)`}
            />
            <KpiCard label="Personal" value={formatEuros(data.totals.labor)} compareText={laborText(data.totals.realLaborMonths, data.months.length)} />
            <KpiCard label="Gastos generales" value={formatEuros(data.totals.overheads)} compareText="introducidos abajo" />
            <KpiCard
              label="Resultado"
              value={formatEuros(data.totals.result)}
              compareText={`${pctText(data.totals.resultPct)} de las ventas, tras ${formatEuros(data.totals.financial)} de gastos financieros`}
            />
            <KpiCard
              label="Punto de equilibrio"
              value={data.breakEven.monthly === null ? '—' : `${formatEuros(data.breakEven.monthly)}/mes`}
              compareText={
                data.breakEven.daily === null
                  ? 'faltan gastos o ventas para calcularlo'
                  : `${formatEuros(data.breakEven.daily)} por día abierto, sin IVA (meses cerrados)`
              }
            />
          </div>

          {(data.warnings.laborWithoutCost > 0 ||
            data.warnings.unconfirmedAlbaranes > 0 ||
            data.warnings.monthsWithoutOverheads > 0 ||
            data.warnings.monthsWithoutPurchases > 0) && (
            <div className="space-y-2">
              {data.warnings.laborWithoutCost > 0 && (
                <Warning text={`${data.warnings.laborWithoutCost} persona(s) con fichajes no tienen coste/hora: el personal sale bajo.`} />
              )}
              {data.warnings.unconfirmedAlbaranes > 0 && (
                <Warning
                  text={`${data.warnings.unconfirmedAlbaranes} albarán(es) de ${data.year} sin confirmar: sus compras aún no cuentan y el margen sale más alto.`}
                />
              )}
              {data.warnings.monthsWithoutPurchases > 0 && (
                <Warning
                  text={`${data.warnings.monthsWithoutPurchases} mes(es) con ventas pero sin albaranes: sus compras salen a 0 y el margen inflado.`}
                />
              )}
              {data.warnings.monthsWithoutOverheads > 0 && (
                <Warning text={`${data.warnings.monthsWithoutOverheads} mes(es) sin gastos generales: el EBITDA de esos meses sale alto.`} />
              )}
            </div>
          )}

          <div className={cardCls}>
            <div className={titleCls}>Cuenta de explotación {data.year} (sin IVA)</div>
            <GestionReportTable
              table={{
                key: 'cuenta-explotacion',
                title: '',
                subtitle: '',
                columns: [
                  { key: 'label', label: 'Mes', kind: 'text' },
                  { key: 'sales', label: 'Ventas', kind: 'euros' },
                  { key: 'purchases', label: 'Compras', kind: 'euros' },
                  { key: 'labor', label: 'Personal', kind: 'euros' },
                  { key: 'overheads', label: 'Gastos generales', kind: 'euros' },
                  { key: 'ebitda', label: 'EBITDA', kind: 'euros' },
                  { key: 'ebitdaPct', label: '% EBITDA', kind: 'percent' },
                  { key: 'financial', label: 'Financieros', kind: 'euros' },
                  { key: 'result', label: 'Resultado', kind: 'euros' },
                  { key: 'resultPct', label: '% Resultado', kind: 'percent' },
                ],
                rows: data.months.map((m) => ({ ...m, label: m.laborSource === 'real' ? m.label : `${m.label} *` })),
                totals: { label: 'Total', ...data.totals },
                notes: [
                  'Compras = albaranes recibidos en el mes. Una compra grande (o un albarán mal leído) se nota en su mes.',
                  ...(data.totals.realLaborMonths < data.months.length
                    ? ['* Personal estimado por horas fichadas × coste/hora: añade abajo «Personal: nóminas + Seguridad Social» del mes para usar el real.']
                    : []),
                ],
              }}
            />
          </div>

        </>
      )}

      {/* Fuera del bloque de datos: si el cálculo falla, los gastos se pueden seguir gestionando. */}
      <div className={cardCls}>
        <div className={titleCls}>Gastos de {year}</div>
        <ExpensesManager key={year} year={year} />
      </div>
    </div>
  );
}

function laborText(realMonths: number, months: number) {
  if (months > 0 && realMonths === months) return 'nóminas + Seguridad Social';
  if (realMonths === 0) return 'horas fichadas × coste/hora';
  return `nóminas en ${realMonths} mes(es), fichajes en el resto`;
}

function Warning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-[var(--surface-container-high)] p-3 text-sm text-[var(--on-surface-variant)]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}
