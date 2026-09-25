'use client';

import { Pencil } from 'lucide-react';
import type { ChecklistEntry, ChecklistMode, ChecklistOutcome, ChecklistRunSnapshotItem } from '@/lib/sicted-types';
import {
  ExecutionControls,
  InspectionControls,
  LockedBadge,
  MeasurementControls,
} from './sicted-checklist-mode-controls';

export interface ChecklistItemDraft {
  outcome?: ChecklistOutcome;
  reason?: string;
  observation?: string;
  value?: string;
  correctiveAction?: string;
  note?: string;
}

interface SictedChecklistItemRowProps {
  item: ChecklistRunSnapshotItem;
  mode: ChecklistMode;
  currentEntry: ChecklistEntry | undefined;
  /** Marcas anteriores a la vigente (correcciones ya sustituidas) — orden cronológico. */
  history?: ChecklistEntry[];
  draft: ChecklistItemDraft | undefined;
  isCorrecting: boolean;
  readOnly?: boolean;
  onDraftChange: (draft: ChecklistItemDraft) => void;
  onStartCorrect: () => void;
  onCancelCorrect: () => void;
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );

/** Motivo/observación/acción correctiva/nota de corrección visibles tras guardar — es lo que el auditor pide ver. */
function entryDetailText(entry: ChecklistEntry): string | null {
  return entry.reason || entry.observation || entry.correctiveAction || entry.note || null;
}

/** Fila de un ítem dentro de una hoja — se adapta al modo (EXECUTION/INSPECTION/MEASUREMENT) de fase 2. */
export function SictedChecklistItemRow({
  item,
  mode,
  currentEntry,
  history,
  draft,
  isCorrecting,
  readOnly,
  onDraftChange,
  onStartCorrect,
  onCancelCorrect,
}: SictedChecklistItemRowProps) {
  const locked = !!currentEntry && !isCorrecting;
  const d = draft ?? {};

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-medium">{item.label}</span>
        {!item.isRequired && (
          <span className="shrink-0 text-xs text-[var(--on-surface-variant)]">opcional</span>
        )}
      </div>

      {locked && currentEntry ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <LockedBadge entry={currentEntry} mode={mode} />
            <span className="text-[var(--on-surface-variant)]">
              {currentEntry.performedByName} · {fmtTime(currentEntry.recordedAt)}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={onStartCorrect}
                className="ml-auto flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-[var(--primary)] hover:bg-[var(--surface-container)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Corregir
              </button>
            )}
          </div>
          {entryDetailText(currentEntry) && (
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{entryDetailText(currentEntry)}</p>
          )}
        </div>
      ) : readOnly ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Sin marcar</p>
      ) : (
        <div className="space-y-2">
          {isCorrecting && (
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-container)] px-2 py-1 text-xs text-[var(--on-surface-variant)]">
              Corrigiendo marca anterior
              <button type="button" onClick={onCancelCorrect} className="text-[var(--primary)]">
                Cancelar
              </button>
            </div>
          )}

          {mode === 'EXECUTION' && <ExecutionControls draft={d} onChange={onDraftChange} />}
          {mode === 'INSPECTION' && <InspectionControls draft={d} onChange={onDraftChange} />}
          {mode === 'MEASUREMENT' && <MeasurementControls item={item} draft={d} onChange={onDraftChange} />}

          {isCorrecting && (
            <textarea
              value={d.note ?? ''}
              onChange={(e) => onDraftChange({ ...d, note: e.target.value })}
              placeholder="Motivo de la corrección (obligatorio)…"
              className="min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 text-base"
            />
          )}
        </div>
      )}

      {!!history?.length && (
        <details className="mt-2 text-xs text-[var(--on-surface-variant)]">
          <summary className="cursor-pointer select-none">Histórico ({history.length})</summary>
          <ul className="mt-1 space-y-1 pl-2">
            {history.map((h) => (
              <li key={h.id}>
                <LockedBadge entry={h} mode={mode} /> {h.performedByName} · {fmtTime(h.recordedAt)}
                {entryDetailText(h) && ` — ${entryDetailText(h)}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
