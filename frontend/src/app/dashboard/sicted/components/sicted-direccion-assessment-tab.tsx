'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Lock, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useCloseSictedAssessment,
  useCreateSictedAssessment,
  useSictedAssessmentScores,
  useSictedAssessments,
  useSictedPendingMandatory,
  useUpsertSictedScore,
} from '@/hooks/use-sicted-direccion';
import type { AssessmentScoreRow } from '@/lib/sicted-direccion-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

function ScoreRow({ row, assessmentId, locked }: { row: AssessmentScoreRow; assessmentId: string; locked: boolean }) {
  const notify = useNotification();
  const upsert = useUpsertSictedScore();
  const [note, setNote] = useState(row.score?.evidenceNote ?? '');

  async function setScore(score: number) {
    try {
      await upsert.mutateAsync({ assessmentId, practiceId: row.practice.id, data: { score, evidenceNote: note || undefined } });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function setNotApplicable() {
    try {
      await upsert.mutateAsync({ assessmentId, practiceId: row.practice.id, data: { notApplicable: true, evidenceNote: note || undefined } });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const current = row.score;

  return (
    <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="w-12 shrink-0 text-[var(--on-surface-variant)]">{row.practice.code}</span>
        <span className="flex-1">{row.practice.title}</span>
        {row.practice.isMandatory && (
          <span className="shrink-0 rounded-full bg-[var(--error-container)] px-2 py-0.5 text-xs font-semibold text-[var(--on-error-container)]">
            Obligatoria
          </span>
        )}
      </div>
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={upsert.isPending}
              onClick={() => setScore(n)}
              className={`min-h-[32px] min-w-[32px] rounded-lg text-xs font-semibold ${
                current?.score === n && !current.notApplicable
                  ? 'bg-[var(--primary)] text-primary-foreground'
                  : 'border border-[var(--outline-variant)]'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={setNotApplicable}
            className={`min-h-[32px] rounded-lg px-2 text-xs font-medium ${
              current?.notApplicable ? 'bg-[var(--primary)] text-primary-foreground' : 'border border-[var(--outline-variant)]'
            }`}
          >
            No aplica
          </button>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Evidencia (opcional)"
            className="min-h-[32px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-xs"
          />
        </div>
      )}
      {locked && current && (
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {current.notApplicable ? 'No aplica' : `Puntuación: ${current.score}`}
          {current.evidenceNote ? ` · ${current.evidenceNote}` : ''}
        </p>
      )}
    </div>
  );
}

function AssessmentDetail({ assessmentId, onBack }: { assessmentId: string; onBack: () => void }) {
  const notify = useNotification();
  const { data: assessments } = useSictedAssessments();
  const { data: rows, isLoading } = useSictedAssessmentScores(assessmentId);
  const { data: pending } = useSictedPendingMandatory(assessmentId);
  const closeAssessment = useCloseSictedAssessment();
  const assessment = assessments?.find((a) => a.id === assessmentId);
  const locked = assessment?.status === 'CLOSED';

  const bySection = useMemo(() => {
    const groups = new Map<number, { name: string; items: AssessmentScoreRow[] }>();
    for (const r of rows ?? []) {
      if (!groups.has(r.practice.bpSection)) groups.set(r.practice.bpSection, { name: r.practice.bpSectionName, items: [] });
      groups.get(r.practice.bpSection)!.items.push(r);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);

  async function handleClose() {
    try {
      await closeAssessment.mutateAsync(assessmentId);
      notify({ type: 'success', title: 'Autoevaluación cerrada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  if (isLoading || !assessment) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        ← Volver
      </button>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {locked && <Lock className="h-4 w-4" />} {assessment.label}
          </h3>
          <p className="text-sm text-[var(--on-surface-variant)]">{locked ? `Cerrada el ${assessment.closedAt}` : 'Borrador'}</p>
        </div>
        {!locked && (
          <button
            type="button"
            disabled={closeAssessment.isPending}
            onClick={handleClose}
            className="flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" /> Cerrar ciclo
          </button>
        )}
      </div>

      {pending && pending.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]">
          <AlertTriangle className="h-4 w-4" /> {pending.length} obligatorias sin puntuar o por debajo de 3
        </p>
      )}

      <div className="space-y-3">
        {bySection.map(([section, group]) => (
          <div key={section}>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
              BP{section} {group.name}
            </h4>
            <div className="space-y-2">
              {group.items.map((r) => (
                <ScoreRow key={r.practice.id} row={r} assessmentId={assessmentId} locked={locked} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Autoevaluación con la escala real 1-5 + No aplica. Ciclo borrador→cerrado. */
export function SictedDireccionAssessmentTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: assessmentsList, isLoading } = useSictedAssessments();
  const create = useCreateSictedAssessment();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');

  if (selectedId) {
    return <AssessmentDetail assessmentId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  async function handleCreate() {
    if (!newLabel.trim()) {
      notify({ type: 'error', title: 'Falta el nombre del ciclo', message: '' });
      return;
    }
    try {
      const created = await create.mutateAsync(newLabel.trim());
      notify({ type: 'success', title: 'Autoevaluación creada', message: '' });
      setNewLabel('');
      setSelectedId(created.id);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nombre del ciclo (ej. Ciclo 2026)"
            className={inputCls}
          />
          <button
            type="button"
            disabled={create.isPending}
            onClick={handleCreate}
            className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Nuevo ciclo
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !assessmentsList || assessmentsList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin autoevaluaciones creadas.
        </div>
      ) : (
        <div className="space-y-2">
          {assessmentsList.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
            >
              <span className="flex items-center gap-2 font-medium">
                {a.status === 'CLOSED' && <Lock className="h-4 w-4 text-[var(--on-surface-variant)]" />} {a.label}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  a.status === 'CLOSED'
                    ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                    : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                }`}
              >
                {a.status === 'CLOSED' ? 'Cerrada' : 'Borrador'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
