'use client';

import type { MenuEngineeringAnalysis } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

/**
 * Cuadro «¿Qué es la popularidad?»: fórmula, umbral y un ejemplo con los
 * platos de la familia que se está mirando, para leer la matriz sin dudas.
 */
export function MenuEngineeringPopularityExplainer({ data }: { data: MenuEngineeringAnalysis }) {
  const { rows, thresholds, totals } = data.matrix;
  const n = rows.length;
  const top = [...rows].sort((a, b) => b.units - a.units)[0];
  const factorText = data.popularityFactor === 1 ? '100 %' : '70 %';

  return (
    <section
      aria-labelledby="me-popularidad"
      className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low,var(--surface-container))] p-4"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5 text-[var(--primary)]" aria-hidden>
          help
        </span>
        <div className="min-w-0 flex-1 space-y-3 text-sm text-[var(--on-surface-variant)]">
          <div id="me-popularidad" className="text-base font-semibold text-[var(--on-surface)]">
            ¿Qué es la popularidad?
          </div>
          <p>
            Es <strong className="text-[var(--on-surface)]">qué parte de las ventas de su familia se lleva cada plato</strong>. No mide si un plato
            «gusta», sino cuánto se pide comparado con sus alternativas: un café no compite con un arroz, por eso se compara cada plato solo
            con los de su familia.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-[var(--surface-container-high)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide">Fórmula</div>
              <p className="mt-1 font-medium text-[var(--on-surface)]">Popularidad = uds. vendidas del plato ÷ uds. vendidas de la familia × 100</p>
            </div>
            <div className="rounded-lg bg-[var(--surface-container-high)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide">Cuándo es «alta»</div>
              <p className="mt-1 font-medium text-[var(--on-surface)]">
                Si llega al {factorText} del reparto igualitario: {factorText} × (100 % ÷ nº de platos)
              </p>
            </div>
          </div>

          {n > 0 && top ? (
            <div className="rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
              <div className="text-xs font-medium uppercase tracking-wide">En tu carta · {data.group}</div>
              <p className="mt-1">
                {n} platos con escandallo se repartieron {formatQty(totals.units)} uds. Si todos vendieran lo mismo, cada uno tendría el{' '}
                {pct(100 / n)}; con el {factorText}, un plato es popular a partir del{' '}
                <strong className="text-[var(--on-surface)]">{pct(thresholds.popularity)}</strong>. Por ejemplo, «{top.name}» vendió{' '}
                {formatQty(top.units)} uds. → {pct(top.popularity)}: popularidad {top.popular ? 'alta' : 'baja'}.
              </p>
              <p className="mt-1">
                La rentabilidad se mira igual: un plato es rentable si su margen por unidad llega al margen medio de la familia, ponderado por lo
                vendido (<strong className="text-[var(--on-surface)]">{formatEuros(thresholds.margin)}</strong>).
              </p>
            </div>
          ) : null}

          <ul className="list-disc space-y-1 pl-5">
            <li>Solo cuentan los platos cobrados en carta: ni invitaciones ni raciones dentro de un menú (van a 0 €).</li>
            <li>Con el 70 % (regla clásica de Kasavana-Smith) entran más platos como populares; con el 100 % (la hoja del curso) es más exigente.</li>
            <li>Mira al menos un mes completo y compara por temporadas: un mes suelto puede engañar.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
