'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSictedRunsToday } from '@/hooks/use-sicted';
import { CHECKLIST_MODE_LABELS, type ChecklistRunSummary } from '@/lib/sicted-types';
import { SictedRunChecklist } from '../components/sicted-run-checklist';

export const dynamic = 'force-dynamic';

/**
 * "Hoy": hojas del día → checklist en la misma página (maestro-detalle, sin ruta extra).
 * Pendientes arriba por área; las terminadas bajan a "Hechas hoy" (siguen abribles para validar o consultar).
 */
export default function SictedHoyPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { data: runs, isLoading } = useSictedRunsToday();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (selectedRunId) {
    return (
      <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
        <button
          type="button"
          onClick={() => setSelectedRunId(null)}
          className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a las hojas de hoy
        </button>
        <SictedRunChecklist runId={selectedRunId} confirmValidate onSupervised={() => setSelectedRunId(null)} />
      </div>
    );
  }

  const pending = (runs ?? []).filter((run) => run.status === 'OPEN');
  const done = (runs ?? []).filter((run) => run.status !== 'OPEN');
  const pendingByArea = pending.reduce<Record<string, ChecklistRunSummary[]>>((acc, run) => {
    (acc[run.template.area] ??= []).push(run);
    return acc;
  }, {});

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <button
        type="button"
        onClick={() => router.push('/dashboard/sicted')}
        className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a SICTED
      </button>
      <h2 className="font-headline-lg text-headline-lg text-primary mb-1">Hojas de hoy</h2>

      {!runs || runs.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          No hay hojas generadas para hoy.
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-[var(--on-surface-variant)]">
            {pending.length > 0 ? `Te quedan ${pending.length} de ${runs.length}` : `Hechas las ${runs.length}`}
          </p>

          {pending.length === 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--primary)] bg-[var(--surface-container)] px-4 py-4 font-medium text-[var(--primary)]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Todo hecho por hoy
            </div>
          )}

          {Object.entries(pendingByArea).map(([area, areaRuns]) => (
            <section key={area} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                {area}
              </h3>
              <div className="space-y-2">
                {areaRuns.map((run) => (
                  <RunCard key={run.id} run={run} onOpen={() => setSelectedRunId(run.id)} />
                ))}
              </div>
            </section>
          ))}

          {done.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
                Hechas hoy ({done.length})
              </h3>
              <div className="space-y-2">
                {done.map((run) => (
                  <RunCard key={run.id} run={run} onOpen={() => setSelectedRunId(run.id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Tarjeta de una hoja: las terminadas salen apagadas con la etiqueta "Hecha" (y "Validada" si ya la revisó el encargado). */
function RunCard({ run, onOpen }: { run: ChecklistRunSummary; onOpen: () => void }) {
  const complete = run.status !== 'OPEN';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-[var(--outline-variant)] px-4 py-3 text-left hover:bg-[var(--surface-container)] ${
        complete ? 'bg-[var(--surface-container)] opacity-75' : 'bg-[var(--surface-container-lowest)]'
      }`}
    >
      {complete ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--primary)]" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
      )}
      <div className="flex-1">
        <p className="font-medium">
          {run.template.name}
          {complete && (
            <span className="ml-2 rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              Hecha
            </span>
          )}
        </p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {complete && `${run.template.area} · `}
          {CHECKLIST_MODE_LABELS[run.template.mode]} · {run.entriesCount}/{run.snapshot.items.length}
          {run.supervisedAt && (
            <span className="ml-2 inline-flex items-center gap-1 text-[var(--primary)]">
              <ShieldCheck className="h-3 w-3" /> Validada
            </span>
          )}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
    </button>
  );
}
