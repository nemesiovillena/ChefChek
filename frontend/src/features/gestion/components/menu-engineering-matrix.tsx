'use client';

import Link from 'next/link';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { MenuClass } from '../api/gestion-api';
import { MENU_CLASSES, MENU_CLASS_INFO, type MenuEngineeringAnalysis, type MenuEngineeringRow } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

interface Props {
  data: MenuEngineeringAnalysis;
  /** Puede abrir Recetas: enlaza cada plato a su escandallo. */
  canOpenRecipes: boolean;
}

/**
 * Matriz popularidad × margen: cada plato es un punto, las dos líneas son los
 * cortes (popularidad mínima y margen medio). Debajo, una tarjeta por cuadrante
 * con la acción recomendada y los platos que han cambiado de clase.
 */
export function MenuEngineeringMatrix({ data, canOpenRecipes }: Props) {
  const { rows, thresholds } = data.matrix;
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">No hay platos con escandallo y ventas en esta familia.</p>;
  }
  const byClass = (c: MenuClass) => rows.filter((r) => r.menuClass === c);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--on-surface-variant)]">
        {MENU_CLASSES.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MENU_CLASS_INFO[c].color }} aria-hidden />
            {MENU_CLASS_INFO[c].plural} ({byClass(c).length})
          </span>
        ))}
      </div>
      <div className="h-80 w-full" role="img" aria-label="Matriz de popularidad y margen de los platos de la familia">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 4 }}>
            <CartesianGrid stroke="var(--outline-variant)" strokeOpacity={0.4} />
            <XAxis
              type="number"
              dataKey="popularity"
              name="Popularidad"
              unit=" %"
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              label={{ value: 'Popularidad (% de uds. de la familia)', position: 'insideBottom', offset: -14, fontSize: 11, fill: 'var(--on-surface-variant)' }}
            />
            <YAxis
              type="number"
              dataKey="margin"
              name="Margen"
              width={56}
              tickFormatter={(v: number) => `${v.toLocaleString('es-ES')} €`}
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
            />
            <ZAxis range={[90, 90]} />
            <ReferenceLine x={thresholds.popularity} stroke="var(--outline)" strokeDasharray="4 4" />
            <ReferenceLine y={thresholds.margin} stroke="var(--outline)" strokeDasharray="4 4" />
            <Tooltip cursor={false} content={<PointTooltip />} />
            {MENU_CLASSES.map((c) => (
              <Scatter key={c} name={MENU_CLASS_INFO[c].plural} data={byClass(c)} fill={MENU_CLASS_INFO[c].color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Líneas de corte: popularidad {pct(thresholds.popularity)} · margen medio ponderado {formatEuros(thresholds.margin)}. Arriba a la derecha,
        estrellas; abajo a la izquierda, perros.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {(['estrella', 'caballo', 'puzzle', 'perro'] as MenuClass[]).map((c) => (
          <QuadrantCard key={c} menuClass={c} rows={byClass(c)} canOpenRecipes={canOpenRecipes} />
        ))}
      </div>
    </div>
  );
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: MenuEngineeringRow }[] }) {
  const r = payload?.[0]?.payload;
  if (!active || !r) return null;
  return (
    <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-highest,var(--surface-container))] px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-[var(--on-surface)]">{r.name}</div>
      <div className="text-[var(--on-surface-variant)]">{MENU_CLASS_INFO[r.menuClass].label}</div>
      <div className="mt-1 tabular-nums text-[var(--on-surface)]">
        {formatQty(r.units)} uds. · {pct(r.popularity)} · margen {formatEuros(r.margin)} · coste {r.costPct === null ? '—' : pct(r.costPct)}
      </div>
    </div>
  );
}

function QuadrantCard({ menuClass, rows, canOpenRecipes }: { menuClass: MenuClass; rows: MenuEngineeringRow[]; canOpenRecipes: boolean }) {
  const info = MENU_CLASS_INFO[menuClass];
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4" style={{ borderLeft: `4px solid ${info.color}` }}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <info.icon aria-hidden className="h-4 w-4" />
        {info.plural} · {rows.length}
      </div>
      <div className="text-xs text-[var(--on-surface-variant)]">{info.rule}</div>
      <p className="mt-2 text-sm text-[var(--on-surface)]">{info.action}</p>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="min-w-0 text-[var(--on-surface)]">
                {canOpenRecipes && r.recipeId ? (
                  <Link href={`/dashboard/recipes?recipe=${r.recipeId}&view=cost`} className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {r.previousClass && r.previousClass !== r.menuClass && (
                  <span className="ml-1.5 text-xs text-[var(--on-surface-variant)]">antes {MENU_CLASS_INFO[r.previousClass].label.toLowerCase()}</span>
                )}
                {!r.previousClass && <span className="ml-1.5 text-xs text-[var(--on-surface-variant)]">sin datos antes</span>}
              </span>
              <span className="text-xs tabular-nums text-[var(--on-surface-variant)]">
                {formatQty(r.units)} uds. · {formatEuros(r.margin)}/ud.
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
