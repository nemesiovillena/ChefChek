'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { type CompareMode, type DateRange, useGestionDashboard } from '../api/gestion-api';
import { formatDay, formatEuros, formatQty } from '../gestion-format';
import { KpiCard } from './kpi-card';
import { PeriodPicker } from './period-picker';
import { PagedRankedBars } from './paged-ranked-bars';
import { SalesEvolutionChart } from './sales-evolution-chart';

/** Cada familia por separado (sin las de 0 €), con su % del total. */
function familyRows(families: { family: string; total: number; share: number }[]) {
  return families
    .filter((f) => f.total > 0)
    .map((f) => ({ key: f.family, label: f.family, total: f.total, detail: `${f.share.toLocaleString('es-ES')} %` }));
}

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';
const sectionTitle = 'mb-3 text-sm font-semibold text-[var(--on-surface)]';

/** Panel de Gestión: KPIs del periodo frente a la comparación, evolución, platos y familias. */
export function GestionDashboardView() {
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth'));
  const [compare, setCompare] = useState<CompareMode>('year');
  const valid = range.from <= range.to;
  // Al cambiar de periodo, los rankings vuelven a su página 1.
  const rangeKey = `${range.from}_${range.to}`;
  const { data, isLoading, isFetching, error } = useGestionDashboard(range, compare, valid);

  const compareLabel = compare === 'year' ? 'Año anterior' : 'Periodo anterior';
  const compareText = (text: string) => `${compareLabel.toLowerCase()}: ${text}`;

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <PeriodPicker
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
          compare={compare}
          onCompareChange={setCompare}
        />
        {data && (
          <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
            Comparando con {formatDay(data.compare.range.from)} – {formatDay(data.compare.range.to)}
            {compare === 'year' && ' (mismos días de la semana)'}
            {isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-label="Actualizando" />}
          </p>
        )}
      </div>

      {!valid && <p className="text-sm text-[var(--error)]">La fecha «Desde» es posterior a «Hasta».</p>}
      {error && <p className="text-sm text-[var(--error)]">No se pudo cargar el panel: {error.message}</p>}
      {isLoading && (
        <div className="flex justify-center py-16 text-[var(--on-surface-variant)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard
              label="Ventas con IVA"
              value={formatEuros(data.kpis.total)}
              delta={data.deltas.total}
              compareText={compareText(formatEuros(data.compareKpis.total))}
            />
            <KpiCard
              label="Ventas sin IVA"
              value={formatEuros(data.kpis.base)}
              delta={data.deltas.base}
              compareText={compareText(formatEuros(data.compareKpis.base))}
            />
            <KpiCard
              label="Tickets"
              value={data.kpis.tickets.toLocaleString('es-ES')}
              delta={data.deltas.tickets}
              compareText={compareText(data.compareKpis.tickets.toLocaleString('es-ES'))}
            />
            <KpiCard
              label="Ticket medio"
              value={formatEuros(data.kpis.avgTicket)}
              delta={data.deltas.avgTicket}
              compareText={compareText(formatEuros(data.compareKpis.avgTicket))}
            />
            <KpiCard
              label="Anulado"
              value={formatEuros(data.kpis.voidedTotal)}
              delta={data.deltas.voidedTotal}
              compareText={compareText(formatEuros(data.compareKpis.voidedTotal))}
              higherIsWorse
            />
            <KpiCard
              label="Invitaciones (uds.)"
              value={formatQty(data.kpis.invitedUnits)}
              delta={data.deltas.invitedUnits}
              compareText={compareText(formatQty(data.compareKpis.invitedUnits))}
              higherIsWorse
            />
            {data.kpis.diners > 0 && (
              <>
                <KpiCard
                  label="Comensales"
                  value={data.kpis.diners.toLocaleString('es-ES')}
                  delta={data.deltas.diners}
                  compareText={compareText(data.compareKpis.diners.toLocaleString('es-ES'))}
                />
                <KpiCard
                  label="Gasto por comensal"
                  value={formatEuros(data.kpis.avgPerDiner)}
                  delta={data.deltas.avgPerDiner}
                  compareText={compareText(formatEuros(data.compareKpis.avgPerDiner))}
                />
              </>
            )}
          </div>

          {data.kpis.missingAmounts > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-[var(--surface-container-high)] p-3 text-xs text-[var(--on-surface-variant)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {data.kpis.missingAmounts} líneas de venta sin importe no cuentan: son tickets que Cuiner volvió a numerar al
              reimportar la caja y que ya no existen allí.
            </p>
          )}

          <div className={cardCls}>
            <div className={sectionTitle}>Evolución de ventas (con IVA)</div>
            <SalesEvolutionChart
              series={data.series}
              compareSeries={data.compareSeries}
              bucket={data.bucket}
              compareLabel={compareLabel}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cardCls}>
              <div className={sectionTitle}>Platos más vendidos</div>
              <PagedRankedBars
                key={rangeKey}
                emptyText="Sin ventas en este periodo."
                pageEmptyLabel="Sin platos"
                items={data.topDishes.map((d) => ({
                  key: d.key,
                  label: d.name,
                  total: d.total,
                  detail: `${formatQty(d.units)} uds.`,
                }))}
              />
            </div>
            <div className={cardCls}>
              <div className={sectionTitle}>Ventas por familia</div>
              <PagedRankedBars
                key={rangeKey}
                emptyText="Sin ventas en este periodo."
                pageEmptyLabel="Sin familias"
                items={familyRows(data.families)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
