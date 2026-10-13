'use client';

import { usePlanVsActual } from '@/hooks/use-turnos';
import type { PlanVsActualRow } from '@/lib/turnos-types';
import { cardCls } from '../../check-in/components/check-in-form-styles';
import { PlanVsActualStatus } from './plan-vs-actual-status';
import { formatEuros, formatHours, formatWeekday } from './week-utils';

const range = (start: string | null, end: string | null) => (start ? `${start}–${end ?? '…'}` : '—');
const cost = (amount: number | null) => (amount === null ? '—' : formatEuros(amount));
const cellCls = 'border-t border-[var(--outline-variant)] p-2 max-md:border-0 max-md:p-0';

function DayRows({ date, rows }: { date: string; rows: PlanVsActualRow[] }) {
  return (
    <>
      <tr className="max-md:block">
        <th
          colSpan={6}
          className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-variant)] max-md:block"
        >
          {formatWeekday(date)}
        </th>
      </tr>
      {rows.map((row) => (
        // En móvil cada fila se apila como una ficha con sus etiquetas.
        <tr
          key={`${row.employeeId}-${row.date}`}
          className="max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 max-md:border-t max-md:border-[var(--outline-variant)] max-md:p-2"
        >
          <th className={`${cellCls} text-left font-medium max-md:col-span-2`}>{row.employeeName}</th>
          <td className={cellCls}>
            <span className="text-xs text-[var(--on-surface-variant)] md:hidden">Turno </span>
            {range(row.plannedStart, row.plannedEnd)}
          </td>
          <td className={cellCls}>
            <span className="text-xs text-[var(--on-surface-variant)] md:hidden">Fichado </span>
            {range(row.actualStart, row.actualEnd)}
          </td>
          <td className={cellCls}>
            <span className="text-xs text-[var(--on-surface-variant)] md:hidden">Horas </span>
            {formatHours(row.workedMinutes)} / {formatHours(row.plannedMinutes)}
          </td>
          <td className={cellCls}>
            <span className="text-xs text-[var(--on-surface-variant)] md:hidden">Coste </span>
            {cost(row.actualCost)} / {cost(row.plannedCost)}
          </td>
          <td className={`${cellCls} max-md:col-span-2`}>
            <PlanVsActualStatus row={row} />
          </td>
        </tr>
      ))}
    </>
  );
}

/** Turnos publicados de la semana frente a lo que se fichó, día a día. */
export function PlanVsActualView({ locationId, weekStart }: { locationId: string; weekStart: string }) {
  const { data, isLoading } = usePlanVsActual(locationId, weekStart);
  if (isLoading || !data) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (data.rows.length === 0) {
    return (
      <p className="text-[var(--on-surface-variant)]">
        No hay turnos publicados ni fichajes esta semana. Los turnos en borrador no se comparan.
      </p>
    );
  }

  const dates = [...new Set(data.rows.map((row) => row.date))].sort();
  const { totals } = data;
  return (
    <div className="space-y-3">
      <div className={`${cardCls} flex flex-wrap gap-x-8 gap-y-2 text-sm`}>
        <span>
          Horas fichadas: <strong>{formatHours(totals.workedMinutes)}</strong> de {formatHours(totals.plannedMinutes)}{' '}
          planificadas
        </span>
        <span>
          Coste estimado: <strong>{formatEuros(totals.actualCost)}</strong> de {formatEuros(totals.plannedCost)}{' '}
          planificados
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)]">
        <table className="w-full border-separate border-spacing-0 text-sm max-md:block">
          <thead className="max-md:hidden">
            <tr>
              {['Persona', 'Turno', 'Fichado', 'Horas (real / plan)', 'Coste (real / plan)', 'Estado'].map((label) => (
                <th key={label} className="p-2 text-left font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block">
            {dates.map((date) => (
              <DayRows key={date} date={date} rows={data.rows.filter((row) => row.date === date)} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-[var(--on-surface-variant)]">
        El coste es una estimación: horas por el coste hora de cada ficha, sin cotizaciones. El margen para señalar
        retrasos se cambia en Ajustes de fichaje.
      </p>
    </div>
  );
}
