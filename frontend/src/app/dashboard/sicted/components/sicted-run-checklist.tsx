'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useAddSictedEntries, useSictedRun, useSuperviseSictedRun } from '@/hooks/use-sicted';
import type { ChecklistEntryInput } from '@/lib/sicted-types';
import { SictedChecklistItemRow, type ChecklistItemDraft } from './sicted-checklist-item-row';
import { SictedPerformerPicker, type SictedPerformer } from './sicted-performer-picker';

const SUPERVISOR_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

interface SictedRunChecklistProps {
  runId: string;
  readOnly?: boolean;
}

/** Checklist de una hoja: marcar por ítem (adaptado al modo), corregir, validar. Orquesta las filas de ítems. */
export function SictedRunChecklist({ runId, readOnly }: SictedRunChecklistProps) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const notify = useNotification();
  const { data: run, isLoading } = useSictedRun(runId);
  const addEntries = useAddSictedEntries();
  const supervise = useSuperviseSictedRun();

  const [performer, setPerformer] = useState<SictedPerformer | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ChecklistItemDraft>>({});
  const [correctingItemId, setCorrectingItemId] = useState<string | null>(null);

  if (isLoading || !run) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const canSupervise = SUPERVISOR_ROLES.includes(user?.role ?? '');
  const doneCount = Object.keys(run.currentByItem).length;
  const totalCount = run.snapshot.items.length;
  // Una vez validada, el backend rechaza cualquier marca/corrección nueva
  // (ConflictException) — bloquear también en cliente para no ofrecer
  // controles que el servidor va a rechazar.
  const locked = !!readOnly || !!run.supervisedAt;
  const canValidate =
    !locked && run.snapshot.requiresSupervisor && run.status === 'COMPLETED' && canSupervise;

  function buildEntry(itemId: string, draft: ChecklistItemDraft): ChecklistEntryInput | null {
    if (!performer) return null;
    const isCorrecting = correctingItemId === itemId;
    if (isCorrecting && !draft.note?.trim()) return null;

    const base: ChecklistEntryInput = {
      itemId,
      performedByName: performer.name,
      performedByUserId: performer.userId,
      note: draft.note?.trim() || undefined,
      correctsEntryId: isCorrecting ? run!.currentByItem[itemId]?.id : undefined,
    };

    if (run!.snapshot.mode === 'EXECUTION') {
      if (draft.outcome !== 'DONE' && draft.outcome !== 'NOT_DONE') return null;
      if (draft.outcome === 'NOT_DONE' && !draft.reason?.trim()) return null;
      return { ...base, outcome: draft.outcome, reason: draft.reason?.trim() || undefined };
    }
    if (run!.snapshot.mode === 'INSPECTION') {
      if (draft.outcome !== 'OK' && draft.outcome !== 'BAD') return null;
      if (draft.outcome === 'BAD' && !draft.observation?.trim()) return null;
      return { ...base, outcome: draft.outcome, observation: draft.observation?.trim() || undefined };
    }
    // MEASUREMENT
    const value = draft.value !== undefined && draft.value !== '' ? Number(draft.value) : undefined;
    if (value === undefined || Number.isNaN(value)) return null;
    const item = run!.snapshot.items.find((i) => i.id === itemId);
    const outOfRange =
      !!item &&
      ((item.expectedRangeMin !== null && value < item.expectedRangeMin) ||
        (item.expectedRangeMax !== null && value > item.expectedRangeMax));
    if (outOfRange && !draft.correctiveAction?.trim()) return null;
    return { ...base, value, correctiveAction: draft.correctiveAction?.trim() || undefined };
  }

  async function handleSave() {
    if (!performer) {
      notify({ type: 'error', title: 'Falta el "quién"', message: 'Elige tu nombre antes de guardar.' });
      return;
    }
    const entries = Object.entries(drafts)
      .map(([itemId, draft]) => buildEntry(itemId, draft))
      .filter((e): e is ChecklistEntryInput => e !== null);
    if (entries.length === 0) {
      notify({ type: 'error', title: 'Nada que guardar', message: 'Marca al menos un ítem completo.' });
      return;
    }
    try {
      await addEntries.mutateAsync({ runId, entries });
      setDrafts({});
      setCorrectingItemId(null);
      notify({ type: 'success', title: 'Guardado', message: `${entries.length} marca(s) registradas.` });
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function handleValidate() {
    if (!performer) {
      notify({ type: 'error', title: 'Falta el "quién"', message: 'Elige tu nombre para validar.' });
      return;
    }
    const ok = await confirm({
      title: 'Validar hoja',
      description: 'Al validar no podrá modificarse. ¿Confirmas que revisaste todos los ítems?',
      confirmText: 'Validar',
      onConfirm: async () => {
        await supervise.mutateAsync({ runId, supervisorName: performer.name });
        notify({ type: 'success', title: 'Hoja validada', message: run!.snapshot.templateName });
      },
    });
    if (!ok) return;
  }

  const pendingEntries = Object.keys(drafts).some((itemId) => buildEntry(itemId, drafts[itemId]) !== null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-container)] p-3">
        <div>
          <h3 className="font-semibold">{run.snapshot.templateName}</h3>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {doneCount}/{totalCount} marcados
            {run.supervisedAt && (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--primary)]">
                <ShieldCheck className="h-3.5 w-3.5" /> Validada por {run.supervisorName}
              </span>
            )}
          </p>
        </div>
        {!locked && <SictedPerformerPicker value={performer} onChange={setPerformer} />}
      </div>

      <div className="space-y-2">
        {run.snapshot.items.map((item) => (
          <SictedChecklistItemRow
            key={item.id}
            item={item}
            mode={run.snapshot.mode}
            currentEntry={run.currentByItem[item.id]}
            history={run.entries.filter((e) => e.itemId === item.id && e.id !== run.currentByItem[item.id]?.id)}
            draft={drafts[item.id]}
            isCorrecting={correctingItemId === item.id}
            readOnly={locked}
            onDraftChange={(draft) => setDrafts((prev) => ({ ...prev, [item.id]: draft }))}
            onStartCorrect={() => {
              setCorrectingItemId(item.id);
              setDrafts((prev) => ({ ...prev, [item.id]: {} }));
            }}
            onCancelCorrect={() => {
              setCorrectingItemId(null);
              setDrafts((prev) => {
                const { [item.id]: _drop, ...rest } = prev;
                return rest;
              });
            }}
          />
        ))}
      </div>

      {!locked && (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={!pendingEntries || addEntries.isPending}
            onClick={handleSave}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
          >
            {addEntries.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Guardar
          </button>
          {canValidate && (
            <button
              type="button"
              disabled={supervise.isPending}
              onClick={handleValidate}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--primary)] px-4 font-medium text-[var(--primary)] disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4" />
              Validar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
