'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSictedMaintenancePlans } from '@/hooks/use-sicted-maintenance';
import type { ChecklistMaintenancePlan } from '@/lib/sicted-maintenance-types';
import { SictedMaintenancePlanDetail } from './sicted-maintenance-plan-detail';
import { SictedMaintenancePlanEditor } from './sicted-maintenance-plan-editor';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const DUE_SOON_DAYS = 30;

type PlanStatus = 'overdue' | 'dueSoon' | 'ok';

function statusOf(plan: ChecklistMaintenancePlan): PlanStatus {
  const dueMs = new Date(plan.nextDueAt).getTime() - Date.now();
  if (dueMs < 0) return 'overdue';
  if (dueMs <= DUE_SOON_DAYS * 24 * 60 * 60 * 1000) return 'dueSoon';
  return 'ok';
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );

const STATUS_META: Record<PlanStatus, { label: string; icon: typeof Clock; cls: string }> = {
  overdue: { label: 'Vencida', icon: AlertTriangle, cls: 'text-[var(--error)]' },
  dueSoon: { label: 'Próxima', icon: Clock, cls: 'text-[var(--primary)]' },
  ok: { label: 'Al día', icon: ShieldCheck, cls: 'text-[var(--on-surface-variant)]' },
};

/** Calendario: planes agrupados por vencido/próximo/al día → ficha con histórico al elegir uno. */
export function SictedMaintenanceCalendarTab() {
  const { user } = useAuth();
  const { data: plans, isLoading } = useSictedMaintenancePlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  const grouped = useMemo(() => {
    const buckets: Record<PlanStatus, ChecklistMaintenancePlan[]> = { overdue: [], dueSoon: [], ok: [] };
    for (const plan of plans ?? []) {
      buckets[statusOf(plan)].push(plan);
    }
    return buckets;
  }, [plans]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const selectedPlan = (plans ?? []).find((p) => p.id === selectedPlanId);
  if (selectedPlan) {
    return <SictedMaintenancePlanDetail plan={selectedPlan} onBack={() => setSelectedPlanId(null)} />;
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Nuevo plan
            </button>
          )}
        </div>
      )}
      {creating && <SictedMaintenancePlanEditor onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {!plans || plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          Sin planes de revisión todavía.
        </div>
      ) : (
        (['overdue', 'dueSoon', 'ok'] as const).map((status) => {
          const items = grouped[status];
          if (items.length === 0) return null;
          const { label, icon: Icon, cls } = STATUS_META[status];
          return (
            <section key={status} className="mb-6">
              <h3 className={`mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide ${cls}`}>
                <Icon className="h-4 w-4" /> {label} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className="flex min-h-[56px] w-full items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
                  >
                    <div>
                      <p className="font-medium">{plan.title}</p>
                      <p className="text-sm text-[var(--on-surface-variant)]">{plan.asset.name}</p>
                    </div>
                    <span className="text-sm text-[var(--on-surface-variant)]">{fmtDate(plan.nextDueAt)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
