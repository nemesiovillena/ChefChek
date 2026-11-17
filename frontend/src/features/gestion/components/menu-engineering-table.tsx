'use client';

import Link from 'next/link';
import { MENU_CLASS_INFO, type MenuEngineeringAnalysis } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`);
const th = 'px-2 py-2 text-right font-medium';
const td = 'px-2 py-1.5 text-right tabular-nums';

/**
 * Tabla completa de la familia, como la hoja de estudio del curso: coste,
 * precio, margen, ventas, totales, medias y categorías de cada plato.
 */
export function MenuEngineeringTable({ data, canOpenRecipes }: { data: MenuEngineeringAnalysis; canOpenRecipes: boolean }) {
  const { rows, totals, simpleMeans, weightedMeans, thresholds, withoutCost } = data.matrix;
  const level = (high: boolean) => (high ? 'Alta' : 'Baja');
  const nameCell = (name: string, recipeId: string | null) =>
    canOpenRecipes && recipeId ? (
      <Link href={`/dashboard/recipes?recipe=${recipeId}&view=cost`} className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]">
        {name}
      </Link>
    ) : (
      name
    );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm text-[var(--on-surface)]">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              <th className="px-2 py-2 text-left font-medium">Plato</th>
              <th className={th}>Coste</th>
              <th className={th}>PVP s/IVA</th>
              <th className={th}>Margen ud.</th>
              <th className={th}>% coste</th>
              <th className={th}>Ventas</th>
              <th className={th}>Coste total</th>
              <th className={th}>Ingreso total</th>
              <th className={th}>Margen total</th>
              <th className={th}>Popularidad</th>
              <th className="px-2 py-2 text-left font-medium">Rentab.</th>
              <th className="px-2 py-2 text-left font-medium">Popul.</th>
              <th className="px-2 py-2 text-left font-medium">Clasificación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[var(--outline-variant)]">
                <td className="px-2 py-1.5">{nameCell(r.name, r.recipeId)}</td>
                <td className={td}>{formatEuros(r.cost)}</td>
                <td className={td}>{formatEuros(r.price)}</td>
                <td className={td}>{formatEuros(r.margin)}</td>
                <td className={td}>{pct(r.costPct)}</td>
                <td className={td}>{formatQty(r.units)}</td>
                <td className={td}>{formatEuros(r.totalCost)}</td>
                <td className={td}>{formatEuros(r.revenue)}</td>
                <td className={td}>{formatEuros(r.totalMargin)}</td>
                <td className={td}>{pct(r.popularity)}</td>
                <td className="px-2 py-1.5">{level(r.profitable)}</td>
                <td className="px-2 py-1.5">{level(r.popular)}</td>
                <td className="px-2 py-1.5 font-semibold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: MENU_CLASS_INFO[r.menuClass].color }} aria-hidden />
                  {MENU_CLASS_INFO[r.menuClass].label}
                </td>
              </tr>
            ))}
            <tr className="border-b border-[var(--outline-variant)] font-semibold">
              <td className="px-2 py-1.5">Total ({rows.length} platos)</td>
              <td className={td} colSpan={4} />
              <td className={td}>{formatQty(totals.units)}</td>
              <td className={td}>{formatEuros(totals.totalCost)}</td>
              <td className={td}>{formatEuros(totals.revenue)}</td>
              <td className={td}>{formatEuros(totals.totalMargin)}</td>
              <td className={td}>100 %</td>
              <td colSpan={3} className="px-2 py-1.5 text-xs font-normal text-[var(--on-surface-variant)]">
                Coste sobre venta {pct(totals.costPct)}
              </td>
            </tr>
            <tr className="text-[var(--on-surface-variant)]">
              <td className="px-2 py-1.5">Media por plato</td>
              <td className={td}>{formatEuros(simpleMeans.cost)}</td>
              <td className={td}>{formatEuros(simpleMeans.price)}</td>
              <td className={td}>{formatEuros(simpleMeans.margin)}</td>
              <td colSpan={9} />
            </tr>
            <tr className="text-[var(--on-surface-variant)]">
              <td className="px-2 py-1.5">Media ponderada (por ud. vendida)</td>
              <td className={td}>{formatEuros(weightedMeans.cost)}</td>
              <td className={td}>{formatEuros(weightedMeans.price)}</td>
              <td className={`${td} font-semibold text-[var(--on-surface)]`}>{formatEuros(weightedMeans.margin)}</td>
              <td colSpan={5} />
              <td className={`${td} font-semibold text-[var(--on-surface)]`}>{pct(thresholds.popularity)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Rentabilidad alta si el margen por unidad llega a {formatEuros(thresholds.margin)} (media ponderada). Popularidad alta desde el{' '}
        {pct(thresholds.popularity)}. Precios sin IVA y coste de los escandallos actuales.
      </p>

      {withoutCost.length > 0 && (
        <div className="rounded-lg bg-[var(--surface-container-high)] p-3 text-sm text-[var(--on-surface-variant)]">
          <span className="font-medium text-[var(--on-surface)]">{withoutCost.length} plato(s) vendidos sin escandallo o sin coste</span> no entran en
          la matriz:{' '}
          {withoutCost.map((d, i) => (
            <span key={d.key}>
              {i > 0 && ', '}
              {nameCell(d.name, d.recipeId)} ({formatQty(d.units)} uds.)
            </span>
          ))}
          . {canOpenRecipes ? 'Completa su escandallo en Recetas o enlázalos en Cuiner.' : 'Pide a gerencia que completen su escandallo.'}
        </div>
      )}
    </div>
  );
}
