'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, Target, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useCreateImprovementAction,
  useSictedImprovementActions,
  useUpdateImprovementAction,
} from '@/hooks/use-sicted-direccion';
import type {
  ImprovementActionOrigin,
  ImprovementActionStatus,
  SictedImprovementAction,
} from '@/lib/sicted-direccion-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const inputCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm';

const ORIGIN_LABELS: Record<ImprovementActionOrigin, string> = {
  ASSESSMENT: 'Autoevaluación',
  EVALUATOR: 'Evaluador externo',
  COMPLAINT: 'Queja',
  INCIDENT: 'Incidencia',
  OTHER: 'Otro',
};

const STATUS_FILTERS: { value: ImprovementActionStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'DONE', label: 'Hechas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function ActionRow({ action }: { action: SictedImprovementAction }) {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const update = useUpdateImprovementAction();
  const [expanded, setExpanded] = useState(false);
  const [actionText, setActionText] = useState(action.action ?? '');
  const [responsibleName, setResponsibleName] = useState(action.responsibleName ?? '');
  const [dueDate, setDueDate] = useState(action.dueDate ? action.dueDate.slice(0, 10) : '');

  async function save() {
    try {
      await update.mutateAsync({
        id: action.id,
        data: {
          action: actionText || undefined,
          responsibleName: responsibleName || undefined,
          dueDate: dueDate || undefined,
        },
      });
      notify({ type: 'success', title: 'Acción actualizada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function close(status: 'DONE' | 'CANCELLED') {
    try {
      await update.mutateAsync({
        id: action.id,
        data: { status, closedAt: status === 'DONE' ? new Date().toISOString() : undefined },
      });
      notify({ type: 'success', title: status === 'DONE' ? 'Acción implantada' : 'Acción cancelada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const locked = action.status !== 'OPEN';

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="w-10 shrink-0 text-sm text-[var(--on-surface-variant)]">#{action.code}</span>
        <span className="flex-1 text-sm font-medium">{action.title}</span>
        <span className="shrink-0 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs">
          {ORIGIN_LABELS[action.origin]}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            action.status === 'DONE'
              ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
              : action.status === 'CANCELLED'
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                : 'bg-[var(--error-container)] text-[var(--on-error-container)]'
          }`}
        >
          {action.status === 'OPEN' ? 'Abierta' : action.status === 'DONE' ? 'Implantada' : 'Cancelada'}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-[var(--outline-variant)] p-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Solución propuesta</label>
            <textarea
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              disabled={!canManage || locked}
              rows={2}
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] p-2 text-sm disabled:opacity-60"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Responsable</label>
              <input
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                disabled={!canManage || locked}
                className={`${inputCls} disabled:opacity-60`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--on-surface-variant)]">Fecha límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canManage || locked}
                className={`${inputCls} disabled:opacity-60`}
              />
            </div>
          </div>
          {locked && action.closedAt && (
            <p className="text-xs text-[var(--on-surface-variant)]">
              {action.status === 'DONE' ? 'Fecha de implantación' : 'Cerrada'}: {new Date(action.closedAt).toLocaleDateString('es-ES')}
            </p>
          )}
          {canManage && !locked && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={update.isPending}
                onClick={save}
                className="min-h-[36px] rounded-lg bg-[var(--surface-container-high)] px-3 text-xs font-medium disabled:opacity-40"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => close('DONE')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar implantada
              </button>
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => close('CANCELLED')}
                className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-3 text-xs font-medium disabled:opacity-40"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Plan de mejora (SICTED fase 9, sub-PR 2) — confirmado contra el documento
 * real de Warynessy "Dir.6.For_Registro aspectos críticos.doc". Acciones
 * editables (no evidencia append-only): solo la fecha de implantación es
 * un hito protegido una vez puesta.
 */
export function SictedDireccionImprovementTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const [filter, setFilter] = useState<ImprovementActionStatus | 'ALL'>('OPEN');
  const { data: actions, isLoading } = useSictedImprovementActions(filter === 'ALL' ? undefined : filter);
  const create = useCreateImprovementAction();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');

  async function handleCreate() {
    if (!title.trim()) {
      notify({ type: 'error', title: 'Falta el aspecto crítico', message: '' });
      return;
    }
    try {
      await create.mutateAsync({ origin: 'OTHER', title: title.trim() });
      setTitle('');
      setShowForm(false);
      notify({ type: 'success', title: 'Acción creada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`min-h-[36px] rounded-lg px-3 text-xs font-medium ${
              filter === f.value ? 'bg-[var(--primary)] text-primary-foreground' : 'border border-[var(--outline-variant)]'
            }`}
          >
            {f.label}
          </button>
        ))}
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="ml-auto flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva acción
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Aspecto crítico / incidencia detectada"
            className={inputCls}
          />
          <button
            type="button"
            disabled={create.isPending}
            onClick={handleCreate}
            className="min-h-[44px] shrink-0 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Crear
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !actions || actions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin acciones de mejora en este filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} />
          ))}
        </div>
      )}
    </div>
  );
}
