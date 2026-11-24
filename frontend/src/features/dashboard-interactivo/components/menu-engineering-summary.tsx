import Link from 'next/link';
import { presetRange } from '@/lib/cuiner-sales-report-ranges';
import { MENU_CLASSES, MENU_CLASS_INFO, useGestionMenuEngineering } from '@/features/gestion/api/gestion-menu-engineering-api';
import { PanelEmpty, PanelError, PanelLoading } from './panel-state';

// Mes natural cerrado: el mismo rango con el que abre Gestión → Ingeniería de menú.
const RANGE = presetRange('lastMonth');

/**
 * Resumen de la matriz de ingeniería de menú (ventas de Cuiner × escandallo).
 * Reutiliza el análisis de Gestión; el detalle completo vive allí.
 */
export function MenuEngineeringSummary({ gestionEnabled }: { gestionEnabled: boolean }) {
  const { data, isLoading, error } = useGestionMenuEngineering(
    { ...RANGE, scope: 'comida', popularityFactor: 1 },
    gestionEnabled,
  );

  if (!gestionEnabled) {
    return (
      <PanelEmpty title="Necesita el módulo Gestión">
        La ingeniería de menú cruza las ventas de Cuiner con el escandallo. Actívalo en Configuración → Módulos.
      </PanelEmpty>
    );
  }

  const rows = data?.matrix.rows ?? [];
  return (
    <section aria-labelledby="me-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="me-title" className="text-lg font-semibold text-primary">Ingeniería de menú</h2>
          <p className="text-sm text-on-surface-variant">Platos de comida del mes pasado, según popularidad y margen.</p>
        </div>
        <Link href="/dashboard/gestion/menu-engineering" className="text-sm text-primary underline">
          Ver el análisis completo en Gestión
        </Link>
      </div>

      {isLoading && <PanelLoading what="la ingeniería de menú" />}
      {error && <PanelError error={error} />}
      {data && rows.length === 0 && (
        <PanelEmpty title="Sin ventas con escandallo en el mes pasado">
          Hace falta el conector de Cuiner con ventas y platos enlazados a recetas con coste.
        </PanelEmpty>
      )}
      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {MENU_CLASSES.map((cls) => {
            const info = MENU_CLASS_INFO[cls];
            const dishes = rows.filter((r) => r.menuClass === cls).sort((a, b) => b.units - a.units);
            return (
              <div key={cls} className="rounded-lg border border-outline-variant p-4">
                <div className="flex items-center gap-2 font-semibold text-on-surface">
                  <info.icon aria-hidden className="h-4 w-4" style={{ color: info.color }} />
                  {info.plural} · {dishes.length}
                </div>
                <p className="mt-0.5 text-sm text-on-surface-variant">{info.rule}</p>
                {dishes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-sm text-on-surface">
                    {dishes.slice(0, 3).map((d) => <li key={d.key} className="truncate">{d.name}</li>)}
                    {dishes.length > 3 && <li className="text-on-surface-variant">y {dishes.length - 3} más</li>}
                  </ul>
                )}
                <p className="mt-2 text-xs text-on-surface-variant">{info.action}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
