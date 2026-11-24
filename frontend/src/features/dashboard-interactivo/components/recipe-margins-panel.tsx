import Link from 'next/link';
import { formatEuro } from '@/lib/utils';
import { formatPercent, useRecipeMargins } from '../dashboard-interactivo-api';
import { PanelEmpty, PanelError, PanelLoading } from './panel-state';

/** Coste de la carta: cada receta con PVP frente al % de coste objetivo de Configuración. */
export function RecipeMarginsPanel() {
  const { data, isLoading, error } = useRecipeMargins();

  return (
    <section aria-labelledby="margins-title" className="space-y-4">
      <div>
        <h2 id="margins-title" className="text-lg font-semibold text-primary">Márgenes de la carta</h2>
        <p className="text-sm text-on-surface-variant">
          Coste por ración con los precios de hoy, sobre el PVP sin IVA. El objetivo se cambia en Configuración → Costeo de recetas.
        </p>
      </div>

      {isLoading && <PanelLoading what="los escandallos" />}
      {error && <PanelError error={error} />}
      {data && data.pricedCount === 0 && (
        <PanelEmpty title="Ninguna receta activa tiene PVP">
          Pon el PVP en la pestaña de escandallo de cada receta para ver aquí su margen.
        </PanelEmpty>
      )}
      {data && data.pricedCount > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Coste objetivo" value={formatPercent(data.targetCostPercentage)} />
            <Stat label="Coste medio" value={formatPercent(data.averageCostPercentage)} />
            <Stat label="Por encima del objetivo" value={`${data.overTargetCount} de ${data.pricedCount}`} alert={data.overTargetCount > 0} />
            <Stat label="Activas sin PVP" value={String(data.withoutPriceCount)} />
          </dl>
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm">
              <caption className="sr-only">Recetas ordenadas de mayor a menor % de coste</caption>
              <thead className="bg-surface-container-low text-left text-on-surface-variant">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Receta</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Coste/ración</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">PVP sin IVA</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">% coste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.recipes.map((r) => (
                  <tr key={r.recipeId}>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/recipes?recipe=${r.recipeId}&view=cost`} className="text-on-surface hover:underline">
                        {r.name}
                      </Link>
                      {r.isDrink && <span className="ml-2 text-xs text-on-surface-variant">Bebida</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatEuro(r.costPerPortion)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatEuro(r.sellingPrice)}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.overTarget ? 'text-error' : 'text-primary'}`}>
                      {formatPercent(r.costPercentage)}
                      {r.overTarget && <span className="sr-only"> (por encima del objetivo)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-outline-variant p-3">
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${alert ? 'text-error' : 'text-primary'}`}>{value}</dd>
    </div>
  );
}
