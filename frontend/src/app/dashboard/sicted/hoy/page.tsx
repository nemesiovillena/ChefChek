'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useSictedRunsToday } from '@/hooks/use-sicted';
import { CHECKLIST_MODE_LABELS } from '@/lib/sicted-types';
import { SictedRunChecklist } from '../components/sicted-run-checklist';

export const dynamic = 'force-dynamic';

/** "Hoy": lista de hojas del día por área → checklist en la misma página (maestro-detalle, sin ruta extra). */
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
        <SictedRunChecklist runId={selectedRunId} />
      </div>
    );
  }

  const byArea = (runs ?? []).reduce<Record<string, typeof runs>>((acc, run) => {
    const area = run.template.area;
    (acc[area] ??= []).push(run);
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
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Hojas de hoy</h2>

      {!runs || runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          No hay hojas generadas para hoy.
        </div>
      ) : (
        Object.entries(byArea).map(([area, areaRuns]) => (
          <section key={area} className="mb-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
              {area}
            </h3>
            <div className="space-y-2">
              {(areaRuns ?? []).map((run) => {
                const total = run.snapshot.items.length;
                const done = run.entriesCount;
                const complete = run.status !== 'OPEN';
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
                  >
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{run.template.name}</p>
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        {CHECKLIST_MODE_LABELS[run.template.mode]} · {done}/{total}
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
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
