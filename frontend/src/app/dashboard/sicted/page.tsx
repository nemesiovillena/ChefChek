'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ClipboardCheck, ClipboardList, Loader2, NotebookPen, ShieldAlert, Truck, Users, Verified, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSictedRuns, useSictedRunsToday } from '@/hooks/use-sicted';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/** Hub SICTED: progreso de hoy por área, hojas pendientes de validar y hojas vencidas de los últimos 7 días. */
export default function SictedHubPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  const { data: runsToday, isLoading: loadingToday } = useSictedRunsToday();

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const { data: overdue, isLoading: loadingOverdue } = useSictedRuns({ status: 'INCOMPLETE', from: sevenDaysAgo });

  if (authLoading || loadingToday || loadingOverdue) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const byArea = (runsToday ?? []).reduce<Record<string, { done: number; total: number }>>((acc, run) => {
    const area = run.template.area;
    const bucket = (acc[area] ??= { done: 0, total: 0 });
    bucket.total += run.snapshot.items.length;
    bucket.done += run.entriesCount;
    return acc;
  }, {});

  const pendingValidation = (runsToday ?? []).filter(
    (r) => r.snapshot.requiresSupervisor && r.status === 'COMPLETED' && !r.supervisedAt,
  );

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al dashboard
      </button>

      <header className="mb-6">
        <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Calidad</span>
        <h1 className="font-headline-lg text-headline-lg text-primary mt-stack-xs flex items-center gap-2">
          <Verified className="h-7 w-7 text-[var(--primary)]" />
          SICTED
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Registros digitales inalterables: limpieza, apertura/cierre, confort y mantenimiento.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/hoy')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <ClipboardList className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Hojas de hoy</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/registros')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <NotebookPen className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Registros (matriz mensual)</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/mantenimiento')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <Wrench className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Mantenimiento</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/auditoria')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <ClipboardCheck className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Auditoría</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/proveedores')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <Truck className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Proveedores y aprovisionamiento</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/sicted/personas')}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
        >
          <Users className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <span className="font-medium">Personas</span>
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => router.push('/dashboard/sicted/plan')}
            className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)] sm:col-span-2"
          >
            <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--primary)]" />
            <span className="font-medium">Editar el Plan (plantillas)</span>
          </button>
        )}
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
          Progreso de hoy por área
        </h3>
        {Object.keys(byArea).length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">Sin hojas generadas para hoy.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(byArea).map(([area, { done, total }]) => (
              <div key={area} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
                <p className="text-sm font-medium">{area}</p>
                <p className="text-2xl font-semibold text-[var(--primary)]">
                  {done}/{total}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingValidation.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
            <ShieldAlert className="h-4 w-4" /> Pendientes de validar ({pendingValidation.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {pendingValidation.map((r) => (
              <li key={r.id} className="rounded-lg bg-[var(--surface-container)] px-3 py-2">
                {r.template.name} — {r.template.area}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(overdue?.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-[var(--error)]">
            <AlertTriangle className="h-4 w-4" /> Hojas vencidas sin completar ({overdue!.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {overdue!.map((r) => (
              <li key={r.id} className="rounded-lg bg-[var(--error-container)] px-3 py-2 text-[var(--on-error-container)]">
                {r.template.name} — {r.periodKey}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
