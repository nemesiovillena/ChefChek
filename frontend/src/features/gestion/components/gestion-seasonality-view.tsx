'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import { useGestionSeasonality } from '../api/gestion-seasonality-api';
import { formatDay } from '../gestion-format';
import { CalendarDatesManager } from './calendar-dates-manager';
import { RankedBars } from './ranked-bars';
import { SalesHeatmap } from './sales-heatmap';

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';
const titleCls = 'mb-3 text-sm font-semibold text-[var(--on-surface)]';
const thisYear = new Date().getFullYear();

/** Lunes de la semana ISO `week` del año `year`, para nombrar las semanas. */
function weekStart(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = Date.UTC(year, 0, 4) - ((jan4.getUTCDay() + 6) % 7) * 86_400_000;
  return new Date(monday + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
}

/** Estacionalidad: cuándo se vende más en el año y qué dan los festivos. */
export function GestionSeasonalityView() {
  const [year, setYear] = useState(thisYear);
  const { data, isLoading, isFetching, error } = useGestionSeasonality(year);

  return (
    <div className="space-y-6">
      <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <label className="flex min-w-[9rem] flex-col">
          <span className={labelCls}>Año</span>
          <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {/* El año que viene también: para cargar sus festivos antes de que empiece. */}
            {Array.from({ length: 9 }, (_, i) => thisYear + 1 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {isFetching && <Loader2 className="mb-3 h-4 w-4 animate-spin text-[var(--on-surface-variant)]" aria-label="Actualizando" />}
      </div>

      {error && <p className="text-sm text-[var(--error)]">No se pudo cargar: {error.message}</p>}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />}

      {data && (
        <>
          <div className={cardCls}>
            <div className={titleCls}>Ventas de {data.year}, día a día</div>
            <SalesHeatmap year={data.year} days={data.days} holidays={data.holidays} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cardCls}>
              <div className={titleCls}>Mejores días de {data.year}</div>
              <RankedBars
                emptyText="Sin ventas este año."
                items={data.topDays.slice(0, 10).map((d) => ({
                  key: d.date,
                  label: `${d.weekday} ${formatDay(d.date)}${d.special.length ? ` · ${d.special[0]}` : ''}`,
                  total: d.total,
                  detail: `${d.tickets} tickets`,
                }))}
              />
            </div>
            <div className={cardCls}>
              <div className={titleCls}>Media por día de la semana ({data.year})</div>
              <RankedBars
                emptyText="Sin ventas este año."
                items={data.byWeekday.map((w) => ({
                  key: w.weekday,
                  label: w.weekday,
                  total: w.avgTotal,
                  detail: `${w.daysWithSales} días abiertos`,
                }))}
              />
              <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
                Solo cuenta los días con venta: un día de cierre no baja la media, pero un día que solo abre en fiestas sale alto.
              </p>
            </div>
          </div>

          <div className={cardCls}>
            <div className={titleCls}>Semanas fuertes del año (media de todos los años)</div>
            <RankedBars
              emptyText="Sin histórico."
              items={[...data.weeks]
                .sort((a, b) => b.avgTotal - a.avgTotal)
                .slice(0, 12)
                .map((w) => ({
                  key: String(w.week),
                  label: `Semana ${w.week} · desde ${formatDay(weekStart(data.year, w.week)).slice(0, 5)}`,
                  total: w.avgTotal,
                  detail: `${w.years} años`,
                }))}
            />
          </div>

          <div className={cardCls}>
            <div className={titleCls}>Festivos y fechas señaladas de {data.year}</div>
            <CalendarDatesManager year={data.year} holidays={data.holidays} />
          </div>
        </>
      )}
    </div>
  );
}
