'use client';

import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MenuEngineeringAnalysis, ParetoItem } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
/** Platos que se dibujan: con más, las barras no se leen. */
const CHART_MAX = 40;

/**
 * Regla 80/20: qué platos hacen el 80 % de la venta (en euros o en unidades,
 * «PLU»). Barras = cuota de cada plato; línea = % acumulado; mismo eje (%).
 */
export function MenuEngineeringPareto({ data }: { data: MenuEngineeringAnalysis }) {
  const [by, setBy] = useState<'revenue' | 'units'>('revenue');
  const p = by === 'revenue' ? data.pareto.byRevenue : data.pareto.byUnits;
  const total = data.pareto.dishes;
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">Sin ventas en carta en este periodo.</p>;
  }
  const head = p.items.slice(0, p.needed);
  const tail = p.items.slice(p.needed);
  const value = (i: ParetoItem) => (by === 'revenue' ? formatEuros(i.value) : `${formatQty(i.value)} uds.`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--on-surface)]">
          <strong>{p.needed}</strong> de {total} platos de {data.scope} ({pct((p.needed / total) * 100)}) hacen el 80 % de{' '}
          {by === 'revenue' ? 'la venta en euros' : 'las unidades vendidas'}.
        </p>
        <div role="group" aria-label="Medir por" className="flex rounded-lg bg-[var(--surface-container-high)] p-0.5 text-sm">
          {(['revenue', 'units'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={by === k}
              onClick={() => setBy(k)}
              className={`rounded-md px-3 py-1 ${by === k ? 'bg-[var(--primary)] text-primary-foreground' : 'text-[var(--on-surface-variant)]'}`}
            >
              {k === 'revenue' ? 'Euros' : 'Unidades (PLU)'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full" role="img" aria-label="Curva 80/20 de los platos">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={p.items.slice(0, CHART_MAX)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--outline-variant)" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="name" tick={false} height={8} />
            <YAxis domain={[0, 100]} unit=" %" width={44} tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
            <ReferenceLine y={80} stroke="var(--outline)" strokeDasharray="4 4" />
            <Tooltip
              formatter={(v, k) => [pct(Number(v)), k === 'share' ? 'Cuota' : 'Acumulado']}
              labelStyle={{ color: 'var(--on-surface)' }}
              contentStyle={{ background: 'var(--surface-container-highest, var(--surface-container))', border: '1px solid var(--outline-variant)', fontSize: 12 }}
            />
            <Bar dataKey="share" fill="var(--me-estrella)" radius={[4, 4, 0, 0]} />
            <Line dataKey="cumulative" stroke="var(--me-caballo)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {p.items.length > CHART_MAX && <p className="text-xs text-[var(--on-surface-variant)]">La gráfica muestra los {CHART_MAX} primeros.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <DishList title={`El 20 % que vende: ${head.length} platos`} items={head} value={value} />
        <DishList
          title={`La cola: ${tail.length} platos con el 20 % restante`}
          hint="Candidatos a revisar: ocupan carta, cámara y compras para vender poco."
          items={tail}
          value={value}
        />
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Correspondencia con compras: los artículos de los platos de cabeza son los que hay que negociar mejor y vigilar en recepción.
      </p>
    </div>
  );
}

function DishList({ title, hint, items, value }: { title: string; hint?: string; items: ParetoItem[]; value: (i: ParetoItem) => string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-container-high)] p-3">
      <div className="text-sm font-semibold text-[var(--on-surface)]">{title}</div>
      {hint && <div className="text-xs text-[var(--on-surface-variant)]">{hint}</div>}
      <ol className="mt-2 max-h-72 space-y-0.5 overflow-y-auto text-sm">
        {items.map((i) => (
          <li key={i.key} className="flex justify-between gap-2">
            <span className="min-w-0 truncate text-[var(--on-surface)]">
              {i.name} <span className="text-xs text-[var(--on-surface-variant)]">· {i.group}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--on-surface-variant)]">
              {value(i)} · {pct(i.share)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
