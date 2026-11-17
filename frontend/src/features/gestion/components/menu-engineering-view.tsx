'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import type { DateRange } from '../api/gestion-api';
import { type MenuScope, type PopularityFactor, useGestionMenuEngineering } from '../api/gestion-menu-engineering-api';
import { formatDay } from '../gestion-format';
import { PeriodPicker } from './period-picker';
import { MenuEngineeringPopularityExplainer } from './menu-engineering-popularity-explainer';
import { MenuEngineeringMatrix } from './menu-engineering-matrix';
import { MenuEngineeringTable } from './menu-engineering-table';
import { MenuEngineeringPareto } from './menu-engineering-pareto';
import { MenuEngineeringOmnes } from './menu-engineering-omnes';
import { MenuEngineeringGrayZone } from './menu-engineering-gray-zone';
import { MenuEngineeringCostRatios } from './menu-engineering-cost-ratios';

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';

const VIEWS = [
  { id: 'matriz', label: 'Matriz' },
  { id: 'tabla', label: 'Tabla' },
  { id: '80-20', label: '80/20' },
  { id: 'omnes', label: 'Omnes' },
  { id: 'zona-gris', label: 'Zona gris' },
  { id: 'ratios', label: 'Ratios de costes' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];

/** Estas vistas analizan una familia: muestran su selector. */
const PER_GROUP: ViewId[] = ['matriz', 'tabla', 'omnes'];

/**
 * Menú engineering: popularidad × rentabilidad por familia y sus aplicaciones
 * (80/20, Omnes, zona gris) más los ratios de costes. La vista va en la URL
 * (?vista=) para poder enlazarla y volver atrás.
 */
export function MenuEngineeringView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: ViewId = VIEWS.some((v) => v.id === params.get('vista')) ? (params.get('vista') as ViewId) : 'matriz';
  const setView = (id: ViewId) => router.replace(`${pathname}?vista=${id}`, { scroll: false });

  const [preset, setPreset] = useState<RangePreset>('lastMonth');
  const [range, setRange] = useState<DateRange>(() => presetRange('lastMonth'));
  const [scope, setScope] = useState<MenuScope>('comida');
  const [group, setGroup] = useState<string | undefined>();
  const [factor, setFactor] = useState<PopularityFactor>(1);
  const valid = range.from <= range.to;
  const { canEnter, canSee } = useSectionAccess();
  // Los enlaces abren el «Costo» de la receta: hace falta ver Recetas y sus costes.
  const canOpenRecipes = canEnter('recipes') && canSee('recipes.cost');

  const { data, isLoading, isFetching, error } = useGestionMenuEngineering(
    { ...range, scope, group, popularityFactor: factor },
    valid,
  );

  return (
    <div className="space-y-4">
      <div className={`${cardCls} space-y-3`}>
        <PeriodPicker
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
        />
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Carta" className="flex rounded-lg bg-[var(--surface-container-high)] p-0.5 text-sm">
            {(['comida', 'bebida'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => {
                  setScope(s);
                  setGroup(undefined);
                }}
                className={`rounded-md px-4 py-1.5 ${scope === s ? 'bg-[var(--primary)] text-primary-foreground' : 'text-[var(--on-surface-variant)]'}`}
              >
                {s === 'comida' ? 'Comida' : 'Bebida'}
              </button>
            ))}
          </div>
          {PER_GROUP.includes(view) && (
            <label className="flex min-w-[12rem] flex-1 flex-col">
              <span className={labelCls}>Familia</span>
              <select className={inputCls} value={data?.group ?? ''} onChange={(e) => setGroup(e.target.value)}>
                {(data?.groups ?? []).map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.costed} de {g.dishes} con escandallo)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-w-[12rem] flex-col">
            <span className={labelCls}>Popular desde</span>
            <select className={inputCls} value={factor} onChange={(e) => setFactor(Number(e.target.value) as PopularityFactor)}>
              <option value={1}>100 % de la media (curso)</option>
              <option value={0.7}>70 % de la media (Kasavana-Smith)</option>
            </select>
          </label>
          {isFetching && <Loader2 className="mb-2 h-4 w-4 animate-spin text-[var(--on-surface-variant)]" aria-label="Actualizando" />}
        </div>
      </div>

      <div role="tablist" aria-label="Análisis" className="flex gap-1 overflow-x-auto border-b border-[var(--outline-variant)]">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              view === v.id ? 'border-[var(--primary)] text-[var(--on-surface)]' : 'border-transparent text-[var(--on-surface-variant)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {!valid && <p className="text-sm text-[var(--error)]">La fecha «Desde» es posterior a «Hasta».</p>}
      {error && <p className="text-sm text-[var(--error)]">No se pudo calcular: {error.message}</p>}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />}

      {data && (
        <div role="tabpanel" className="space-y-4">
          {PER_GROUP.includes(view) && data.groups.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">Sin ventas de {scope} en carta en este periodo.</p>
          )}
          {view === 'matriz' && data.group && (
            <>
              <MenuEngineeringPopularityExplainer data={data} />
              <div className={cardCls}>
                <MenuEngineeringMatrix data={data} canOpenRecipes={canOpenRecipes} />
              </div>
            </>
          )}
          {view === 'tabla' && data.group && (
            <div className={cardCls}>
              <MenuEngineeringTable data={data} canOpenRecipes={canOpenRecipes} />
            </div>
          )}
          {view === '80-20' && (
            <div className={cardCls}>
              <MenuEngineeringPareto data={data} />
            </div>
          )}
          {view === 'omnes' && data.group && (
            <div className={cardCls}>
              <MenuEngineeringOmnes data={data} />
            </div>
          )}
          {view === 'zona-gris' && <MenuEngineeringGrayZone data={data} />}
          {view === 'ratios' && <MenuEngineeringCostRatios data={data} />}
          {PER_GROUP.includes(view) && data.group && (
            <p className="text-xs text-[var(--on-surface-variant)]">
              Cambio de clase frente a {formatDay(data.previousRange.from)} – {formatDay(data.previousRange.to)} (mismo número de días).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
