'use client';

import { AlertTriangle, Check, X } from 'lucide-react';
import type { ChecklistEntry, ChecklistMode, ChecklistRunSnapshotItem } from '@/lib/sicted-types';
import type { ChecklistItemDraft } from './sicted-checklist-item-row';

/** Controles y badge propios de cada modo — separados de la fila para mantenerla <200 líneas. */

export function LockedBadge({ entry, mode }: { entry: ChecklistEntry; mode: ChecklistMode }) {
  if (mode === 'MEASUREMENT') {
    return (
      <span
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
          entry.withinRange === false
            ? 'bg-[var(--error-container)] text-[var(--on-error-container)]'
            : 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
        }`}
      >
        {entry.withinRange === false && <AlertTriangle className="h-3.5 w-3.5" />}
        {entry.value}
      </span>
    );
  }
  const isOk = entry.outcome === 'DONE' || entry.outcome === 'OK';
  const label =
    entry.outcome === 'DONE' ? 'Hecho' : entry.outcome === 'NOT_DONE' ? 'No realizado' : entry.outcome === 'OK' ? 'Bien' : 'Mal';
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        isOk
          ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
          : 'bg-[var(--error-container)] text-[var(--on-error-container)]'
      }`}
    >
      {isOk ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

const toggleBtn = (active: boolean, tone: 'ok' | 'bad') =>
  `flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-lg border text-sm font-medium transition ${
    active
      ? tone === 'ok'
        ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
        : 'border-[var(--error)] bg-[var(--error-container)] text-[var(--on-error-container)]'
      : 'border-[var(--outline-variant)] bg-transparent hover:bg-[var(--surface-container)]'
  }`;

interface ControlsProps {
  draft: ChecklistItemDraft;
  onChange: (d: ChecklistItemDraft) => void;
}

export function ExecutionControls({ draft, onChange }: ControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className={toggleBtn(draft.outcome === 'DONE', 'ok')} onClick={() => onChange({ outcome: 'DONE' })}>
          <Check className="h-4 w-4" /> Hecho
        </button>
        <button
          type="button"
          className={toggleBtn(draft.outcome === 'NOT_DONE', 'bad')}
          onClick={() => onChange({ ...draft, outcome: 'NOT_DONE' })}
        >
          <X className="h-4 w-4" /> No realizado
        </button>
      </div>
      {draft.outcome === 'NOT_DONE' && (
        <textarea
          value={draft.reason ?? ''}
          onChange={(e) => onChange({ ...draft, reason: e.target.value })}
          placeholder="Motivo (obligatorio)…"
          className="min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 text-base"
        />
      )}
    </div>
  );
}

export function InspectionControls({ draft, onChange }: ControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className={toggleBtn(draft.outcome === 'OK', 'ok')} onClick={() => onChange({ outcome: 'OK' })}>
          <Check className="h-4 w-4" /> Bien
        </button>
        <button type="button" className={toggleBtn(draft.outcome === 'BAD', 'bad')} onClick={() => onChange({ ...draft, outcome: 'BAD' })}>
          <X className="h-4 w-4" /> Mal
        </button>
      </div>
      {draft.outcome === 'BAD' && (
        <textarea
          value={draft.observation ?? ''}
          onChange={(e) => onChange({ ...draft, observation: e.target.value })}
          placeholder="Observación (obligatoria)…"
          className="min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-2 text-base"
        />
      )}
    </div>
  );
}

export function MeasurementControls({
  item,
  draft,
  onChange,
}: ControlsProps & { item: ChecklistRunSnapshotItem }) {
  const numeric = draft.value !== undefined && draft.value !== '' ? Number(draft.value) : undefined;
  const outOfRange =
    numeric !== undefined &&
    !Number.isNaN(numeric) &&
    ((item.expectedRangeMin !== null && numeric < item.expectedRangeMin) ||
      (item.expectedRangeMax !== null && numeric > item.expectedRangeMax));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={draft.value ?? ''}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          placeholder="Valor"
          className={`min-h-[48px] w-32 rounded-lg border bg-[var(--surface-container-lowest)] px-3 text-base ${
            outOfRange ? 'border-[var(--error)]' : 'border-[var(--outline-variant)]'
          }`}
        />
        <span className="text-sm text-[var(--on-surface-variant)]">
          Rango: {item.expectedRangeMin ?? '—'} a {item.expectedRangeMax ?? '—'}
        </span>
      </div>
      {outOfRange && (
        <textarea
          value={draft.correctiveAction ?? ''}
          onChange={(e) => onChange({ ...draft, correctiveAction: e.target.value })}
          placeholder="Fuera de rango: acción correctiva (obligatoria)…"
          className="min-h-[48px] w-full rounded-lg border border-[var(--error)] bg-[var(--surface-container-lowest)] p-2 text-base"
        />
      )}
    </div>
  );
}
