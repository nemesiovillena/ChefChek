'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedSatisfaction, useSictedSatisfactionSummary } from '@/hooks/use-sicted-cliente';
import type { CreateSatisfactionSampleInput } from '@/lib/sicted-cliente-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function SampleForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedSatisfaction();
  const [form, setForm] = useState<CreateSatisfactionSampleInput>({ score: 5, channel: 'Sala', recordedByName: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.recordedByName.trim()) {
      notify({ type: 'error', title: 'Falta quién lo registra', message: '' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: 'Muestra registrada', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setForm((p) => ({ ...p, score: n }))}
            className="p-1"
            aria-label={`${n} estrellas`}
          >
            <Star className={`h-8 w-8 ${n <= form.score ? 'fill-[var(--primary)] text-[var(--primary)]' : 'text-[var(--outline-variant)]'}`} />
          </button>
        ))}
      </div>
      <input value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} placeholder="Canal (ej. Sala, encuesta)" className={inputCls} />
      <input
        value={form.comment ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
        placeholder="Comentario (opcional)"
        className={inputCls}
      />
      <input
        value={form.recordedByName}
        onChange={(e) => setForm((p) => ({ ...p, recordedByName: e.target.value }))}
        placeholder="Quién lo registra"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Registrar
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** CLI.4 — satisfacción, muestras 1-5 con resumen mensual y tendencia. */
export function SictedClienteSatisfactionTab() {
  const { year, month } = currentYearMonth();
  const { data: summary, isLoading } = useSictedSatisfactionSummary(year, month);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Registrar muestra
        </button>
      </div>
      {creating && <SampleForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : summary ? (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 text-center">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Media de {String(month).padStart(2, '0')}/{year}
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 text-4xl font-semibold">
            {summary.averageScore != null ? summary.averageScore.toFixed(1) : '—'}
            {summary.trend === 'up' && <TrendingUp className="h-6 w-6 text-[var(--primary)]" />}
            {summary.trend === 'down' && <TrendingDown className="h-6 w-6 text-[var(--error)]" />}
          </p>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{summary.sampleCount} muestras este mes</p>
          {summary.previousAverageScore != null && (
            <p className="mt-1 text-xs text-[var(--on-surface-variant)]">Mes anterior: {summary.previousAverageScore.toFixed(1)}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
