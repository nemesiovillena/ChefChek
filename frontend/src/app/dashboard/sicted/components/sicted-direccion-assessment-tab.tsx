'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Lock, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useCloseSictedAssessment,
  useCreateSictedAssessment,
  useGenerateImprovementActionsFromAssessment,
  useSictedAssessmentScores,
  useSictedAssessments,
  useSictedPendingMandatory,
  useUpsertSictedScore,
} from '@/hooks/use-sicted-direccion';
import type { AssessmentScoreRow, SictedAssessmentResult, SictedAxis } from '@/lib/sicted-direccion-types';
import { AXIS_LABELS, groupPracticesByAxisAndModule } from '@/lib/sicted-practice-presentation';
import { SictedPracticeBadges, SictedPracticeDetails } from './sicted-practice-details';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

const RESULT_LABELS: Record<SictedAssessmentResult, string> = { CUMPLE: 'Cumple', NO_CUMPLE: 'No cumple' };

function ScoreRow({ row, assessmentId, locked }: { row: AssessmentScoreRow; assessmentId: string; locked: boolean }) {
  const notify = useNotification();
  const upsert = useUpsertSictedScore();
  const [note, setNote] = useState(row.score?.evidenceNote ?? '');

  async function save(data: { result?: SictedAssessmentResult; notApplicable?: boolean }) {
    try {
      await upsert.mutateAsync({ assessmentId, practiceId: row.practice.id, data: { ...data, evidenceNote: note || undefined } });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const current = row.score;
  const choiceCls = (active: boolean) =>
    `min-h-[36px] rounded-lg px-3 text-xs font-semibold ${
      active ? 'bg-[var(--primary)] text-primary-foreground' : 'border border-[var(--outline-variant)]'
    }`;

  return (
    <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="w-12 shrink-0 text-[var(--on-surface-variant)]">{row.practice.code}</span>
        <span className="flex-1">{row.practice.title}</span>
        <SictedPracticeBadges practice={row.practice} />
      </div>
      <div className="pl-14">
        <SictedPracticeDetails practice={row.practice} />
      </div>
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {(['CUMPLE', 'NO_CUMPLE'] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={upsert.isPending}
              onClick={() => save({ result: r })}
              className={choiceCls(current?.result === r && !current.notApplicable)}
            >
              {RESULT_LABELS[r]}
            </button>
          ))}
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={() => save({ notApplicable: true })}
            className={choiceCls(!!current?.notApplicable)}
          >
            No aplica
          </button>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Evidencia (opcional)"
            className="min-h-[36px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-base"
          />
        </div>
      )}
      {locked && current && (
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {current.notApplicable
            ? 'No aplica'
            : current.result
              ? RESULT_LABELS[current.result]
              : `Puntuación (escala anterior): ${current.score}`}
          {current.evidenceNote ? ` · ${current.evidenceNote}` : ''}
        </p>
      )}
    </div>
  );
}

type RowFilter = 'ALL' | 'MANDATORY' | 'PENDING';

function AssessmentDetail({ assessmentId, onBack }: { assessmentId: string; onBack: () => void }) {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: assessments } = useSictedAssessments();
  const { data: rows, isLoading } = useSictedAssessmentScores(assessmentId);
  const { data: pending } = useSictedPendingMandatory(assessmentId);
  const closeAssessment = useCloseSictedAssessment();
  const generateActions = useGenerateImprovementActionsFromAssessment();
  const assessment = assessments?.find((a) => a.id === assessmentId);
  const locked = assessment?.status === 'CLOSED';

  async function handleGenerateActions() {
    try {
      const created = await generateActions.mutateAsync(assessmentId);
      notify({
        type: 'success',
        title: created.length > 0 ? `${created.length} acciones generadas` : 'Sin acciones nuevas',
        message: created.length > 0 ? 'Revísalas en la pestaña "Plan de mejora".' : 'Ya existían para esta autoevaluación.',
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const [axisFilter, setAxisFilter] = useState<SictedAxis | 'ALL'>('ALL');
  const [rowFilter, setRowFilter] = useState<RowFilter>('ALL');
  const pendingIds = useMemo(() => new Set((pending ?? []).map((p) => p.practice.id)), [pending]);
  const valued = (rows ?? []).filter((r) => r.score).length;

  const byAxis = useMemo(() => {
    const visible = (rows ?? []).filter(
      (r) =>
        (axisFilter === 'ALL' || r.practice.axis === axisFilter) &&
        (rowFilter === 'ALL' ||
          (rowFilter === 'MANDATORY' && r.practice.isMandatory) ||
          (rowFilter === 'PENDING' && pendingIds.has(r.practice.id))),
    );
    return groupPracticesByAxisAndModule(visible, (r) => r.practice);
  }, [rows, axisFilter, rowFilter, pendingIds]);

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
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{pending.length} obligatorias sin cumplir o sin valorar</span>
          {canManage && (
            <button
              type="button"
              disabled={generateActions.isPending}
              onClick={handleGenerateActions}
              className="min-h-[32px] shrink-0 rounded-lg bg-[var(--on-error-container)] px-3 text-xs font-semibold text-[var(--error-container)] disabled:opacity-40"
            >
              Generar acciones de mejora
            </button>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--on-surface-variant)]">
          {valued}/{rows?.length ?? 0} valoradas
        </span>
        <select
          value={axisFilter}
          onChange={(e) => setAxisFilter(e.target.value as SictedAxis | 'ALL')}
          className="min-h-[40px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 text-base"
        >
          <option value="ALL">Todos los ejes</option>
          {(Object.keys(AXIS_LABELS) as SictedAxis[]).map((a) => (
            <option key={a} value={a}>
              {AXIS_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          value={rowFilter}
          onChange={(e) => setRowFilter(e.target.value as RowFilter)}
          className="min-h-[40px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 text-base"
        >
          <option value="ALL">Todas</option>
          <option value="MANDATORY">Solo obligatorias</option>
          <option value="PENDING">Obligatorias pendientes</option>
        </select>
      </div>

      <div className="space-y-5">
        {byAxis.map((axis) => (
          <section key={axis.axis}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">{axis.label}</h3>
            <div className="space-y-3">
              {axis.modules.map((mod) => (
                <div key={mod.moduleCode}>
                  <h4 className="mb-2 text-sm font-medium">
                    {mod.moduleName}
                    {mod.complementary && <span className="text-[var(--on-surface-variant)]"> · complementario</span>}
                  </h4>
                  <div className="space-y-2">
                    {mod.items.map((r) => (
                      <ScoreRow key={r.practice.id} row={r} assessmentId={assessmentId} locked={locked} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Autoevaluación SICTED 2026: Cumple / No cumple / No aplica sobre las
 * prácticas que aplican al negocio (oficio + complementarias activadas en
 * Configuración → SICTED). Ciclo borrador→cerrado.
 */
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
