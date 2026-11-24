'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChartColumn, CircleAlert, LayoutGrid, Percent, Truck, type LucideIcon } from 'lucide-react';
import { formatEuro } from '@/lib/utils';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import {
  formatChange,
  formatPercent,
  SPEND_PERIOD_LABELS,
  type SpendPeriod,
  useDashboardAlerts,
  useRecipeMargins,
  useSupplierSpend,
} from '@/features/dashboard-interactivo/dashboard-interactivo-api';
import { SupplierSpendPanel } from '@/features/dashboard-interactivo/components/supplier-spend-panel';
import { RecipeMarginsPanel } from '@/features/dashboard-interactivo/components/recipe-margins-panel';
import { AlertsPanel } from '@/features/dashboard-interactivo/components/alerts-panel';
import { MenuEngineeringSummary } from '@/features/dashboard-interactivo/components/menu-engineering-summary';

export const dynamic = 'force-dynamic';

type TabId = 'resumen' | 'compras' | 'margenes' | 'alertas' | 'menu';

/**
 * Dashboard interactivo: visión de dirección con datos reales de la app
 * (albaranes confirmados, escandallos con PVP, alertas registradas y la
 * ingeniería de menú de Gestión). Las cifras de coste exigen `recipes.cost`.
 */
export default function DashboardInteractivoPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canSee } = useSectionAccess();
  const { isEnabled } = useModules();
  const canViewCost = canSee('recipes.cost');
  const [period, setPeriod] = useState<SpendPeriod>('MONTH');

  const tabs: { id: TabId; label: string; icon: LucideIcon; visible: boolean }[] = [
    { id: 'resumen', label: 'Resumen', icon: LayoutGrid, visible: true },
    { id: 'compras', label: 'Compras', icon: Truck, visible: canViewCost },
    { id: 'margenes', label: 'Márgenes', icon: Percent, visible: canViewCost },
    { id: 'alertas', label: 'Alertas', icon: CircleAlert, visible: true },
    { id: 'menu', label: 'Ingeniería de menú', icon: ChartColumn, visible: true },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);
  const requested = searchParams.get('tab');
  const active: TabId = visibleTabs.find((t) => t.id === requested)?.id ?? 'resumen';
  const selectTab = (id: TabId) => router.replace(`${pathname}?tab=${id}`, { scroll: false });

  return (
    <div className="content-container space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Dashboard interactivo</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Compras, márgenes de la carta, alertas y rendimiento de los platos, con los datos que ya registra ChefChek.</p>
      </div>

      <div role="tablist" aria-label="Secciones del dashboard" className="flex gap-1 overflow-x-auto border-b border-outline-variant">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls={`panel-${id}`}
            onClick={() => selectTab(id)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active === id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {active === 'resumen' && <SummaryPanel canViewCost={canViewCost} onOpen={selectTab} />}
        {active === 'compras' && <SupplierSpendPanel period={period} onPeriodChange={setPeriod} />}
        {active === 'margenes' && <RecipeMarginsPanel />}
        {active === 'alertas' && <AlertsPanel />}
        {active === 'menu' && <MenuEngineeringSummary gestionEnabled={isEnabled('gestion')} />}
      </div>
    </div>
  );
}

/** Una cifra por sección; cada tarjeta abre su pestaña con el detalle. */
function SummaryPanel({ canViewCost, onOpen }: { canViewCost: boolean; onOpen: (id: TabId) => void }) {
  const spend = useSupplierSpend('MONTH', canViewCost);
  const margins = useRecipeMargins(canViewCost);
  const alerts = useDashboardAlerts();
  const openAlerts = alerts.data?.filter((a) => !a.isResolved).length;
  const dash = (loading: boolean) => (loading ? 'Cargando…' : 'Sin datos');

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {canViewCost && (
        <SummaryCard
          label={`Compras · ${SPEND_PERIOD_LABELS.MONTH.toLowerCase()}`}
          value={spend.data ? formatEuro(spend.data.total) : dash(spend.isLoading)}
          detail={spend.data ? `${formatChange(spend.data.changePercent)} frente a los 30 días anteriores` : spend.error?.message}
          onClick={() => onOpen('compras')}
        />
      )}
      {canViewCost && (
        <SummaryCard
          label="Coste medio de la carta"
          value={margins.data ? formatPercent(margins.data.averageCostPercentage) : dash(margins.isLoading)}
          detail={margins.data ? `Objetivo ${formatPercent(margins.data.targetCostPercentage)} · ${margins.data.pricedCount} recetas con PVP` : margins.error?.message}
          onClick={() => onOpen('margenes')}
        />
      )}
      {canViewCost && (
        <SummaryCard
          label="Recetas por encima del objetivo"
          value={margins.data ? String(margins.data.overTargetCount) : dash(margins.isLoading)}
          detail={margins.data ? `de ${margins.data.pricedCount} con PVP` : undefined}
          alert={(margins.data?.overTargetCount ?? 0) > 0}
          onClick={() => onOpen('margenes')}
        />
      )}
      <SummaryCard
        label="Alertas abiertas"
        value={openAlerts !== undefined ? String(openAlerts) : dash(alerts.isLoading)}
        detail={alerts.error?.message}
        alert={(openAlerts ?? 0) > 0}
        onClick={() => onOpen('alertas')}
      />
    </div>
  );
}

function SummaryCard({ label, value, detail, alert = false, onClick }: { label: string; value: string; detail?: string; alert?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="block text-sm text-on-surface-variant">{label}</span>
      <span className={`mt-2 block text-2xl font-semibold tabular-nums ${alert ? 'text-error' : 'text-primary'}`}>{value}</span>
      {detail && <span className="mt-1 block text-xs text-on-surface-variant">{detail}</span>}
    </button>
  );
}
