import { useState } from 'react';
import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { useDashboardAlerts, useResolveAlert, type DashboardAlert } from '../dashboard-interactivo-api';
import { PanelEmpty, PanelError, PanelLoading } from './panel-state';

const SEVERITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

/** Alertas que la app ha registrado (Sala, APPCC…): abiertas primero, con opción de marcarlas resueltas. */
export function AlertsPanel() {
  const { data, isLoading, error } = useDashboardAlerts();
  const [showResolved, setShowResolved] = useState(false);
  const open = data?.filter((a) => !a.isResolved) ?? [];
  const resolved = data?.filter((a) => a.isResolved) ?? [];

  return (
    <section aria-labelledby="alerts-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="alerts-title" className="text-lg font-semibold text-primary">Alertas</h2>
          <p className="text-sm text-on-surface-variant">Avisos que han generado otros módulos. Márcalos como resueltos cuando estén atendidos.</p>
        </div>
        {resolved.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Ver resueltas ({resolved.length})
          </label>
        )}
      </div>

      {isLoading && <PanelLoading what="las alertas" />}
      {error && <PanelError error={error} />}
      {data && open.length === 0 && !showResolved && (
        <PanelEmpty title="No hay alertas abiertas">Cuando un módulo registre un aviso aparecerá aquí.</PanelEmpty>
      )}
      <ul className="space-y-2">
        {open.map((a) => <AlertRow key={a.id} alert={a} />)}
        {showResolved && resolved.map((a) => <AlertRow key={a.id} alert={a} />)}
      </ul>
    </section>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const resolve = useResolveAlert();
  const serious = alert.severity === 'HIGH' || alert.severity === 'CRITICAL';
  const Icon = serious ? CircleAlert : TriangleAlert;
  return (
    <li className={`flex items-start gap-3 rounded-lg border p-3 ${alert.isResolved ? 'border-outline-variant opacity-70' : serious ? 'border-error/40 bg-error/10' : 'border-outline-variant'}`}>
      <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${serious && !alert.isResolved ? 'text-error' : 'text-on-surface-variant'}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-on-surface">{alert.title}</p>
        <p className="text-sm text-on-surface-variant">{alert.description}</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Prioridad {SEVERITY_LABEL[alert.severity]?.toLowerCase() ?? alert.severity} · {dateFormat.format(new Date(alert.createdAt))}
          {alert.isResolved && ' · Resuelta'}
        </p>
        {resolve.error && <p role="alert" className="mt-1 text-xs text-error">No se pudo marcar como resuelta. Inténtalo de nuevo.</p>}
      </div>
      {!alert.isResolved && (
        <button
          type="button"
          onClick={() => resolve.mutate(alert.id)}
          disabled={resolve.isPending}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Check aria-hidden className="h-4 w-4" />
          {resolve.isPending ? 'Guardando…' : 'Marcar resuelta'}
        </button>
      )}
    </li>
  );
}
