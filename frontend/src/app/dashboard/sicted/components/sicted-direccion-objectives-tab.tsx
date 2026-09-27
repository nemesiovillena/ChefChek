'use client';

import { useState } from 'react';
import { Loader2, Plus, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useCreateObjective, useSictedObjectives, useUpdateObjective } from '@/hooks/use-sicted-direccion';
import type { ObjectiveStatus, SictedObjective } from '@/lib/sicted-direccion-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const inputCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm';

const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  IN_PROGRESS: 'En curso',
  ACHIEVED: 'Conseguido',
  MISSED: 'No conseguido',
  CANCELLED: 'Cancelado',
};

function ObjectiveRow({ objective }: { objective: SictedObjective }) {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const update = useUpdateObjective();
  const [currentValue, setCurrentValue] = useState(objective.currentValue ?? '');

  async function save() {
    try {
      await update.mutateAsync({ id: objective.id, data: { currentValue } });
      notify({ type: 'success', title: 'Progreso actualizado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function setStatus(status: ObjectiveStatus) {
    try {
      await update.mutateAsync({ id: objective.id, data: { status } });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{objective.title}</p>
          {objective.indicator && (
            <p className="text-xs text-[var(--on-surface-variant)]">
              {objective.indicator}
              {objective.target ? ` · objetivo: ${objective.target}` : ''}
            </p>
          )}
        </div>
        {canManage ? (
          <select
            value={objective.status}
            onChange={(e) => setStatus(e.target.value as ObjectiveStatus)}
            className="min-h-[32px] shrink-0 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-xs"
          >
            {(Object.keys(STATUS_LABELS) as ObjectiveStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs">
            {STATUS_LABELS[objective.status]}
          </span>
        )}
      </div>
      {canManage && (
        <div className="flex gap-2">
          <input
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="Valor actual"
            className="min-h-[36px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-xs"
          />
          <button
            type="button"
            disabled={update.isPending}
            onClick={save}
            className="min-h-[36px] shrink-0 rounded-lg bg-[var(--surface-container-high)] px-3 text-xs font-medium disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

/** Objetivos anuales (SICTED fase 9, sub-PR 2) — entidad viva, sin trigger de inalterabilidad. */
export function SictedDireccionObjectivesTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: objectives, isLoading } = useSictedObjectives(year);
  const create = useCreateObjective();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [indicator, setIndicator] = useState('');
  const [target, setTarget] = useState('');

  async function handleCreate() {
    if (!title.trim()) {
      notify({ type: 'error', title: 'Falta el título del objetivo', message: '' });
      return;
    }
    try {
      await create.mutateAsync({
        year,
        title: title.trim(),
        indicator: indicator || undefined,
        target: target || undefined,
      });
      setTitle('');
      setIndicator('');
      setTarget('');
      setShowForm(false);
      notify({ type: 'success', title: 'Objetivo creado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[40px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 1 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="ml-auto flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo objetivo
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-[var(--outline-variant)] p-3 sm:grid-cols-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del objetivo" className={inputCls} />
          <input value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Indicador (opcional)" className={inputCls} />
          <div className="flex gap-2">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta (opcional)" className={inputCls} />
            <button
              type="button"
              disabled={create.isPending}
              onClick={handleCreate}
              className="min-h-[44px] shrink-0 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !objectives || objectives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin objetivos para {year}.
        </div>
      ) : (
        <div className="space-y-2">
          {objectives.map((o) => (
            <ObjectiveRow key={o.id} objective={o} />
          ))}
        </div>
      )}
    </div>
  );
}
