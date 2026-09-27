'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquareWarning, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useCloseSictedFeedback,
  useCreateSictedFeedback,
  useRespondSictedFeedback,
  useSictedFeedback,
  useSictedFeedbackOverdue,
} from '@/hooks/use-sicted-cliente';
import {
  FEEDBACK_CHANNELS,
  FEEDBACK_CHANNEL_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  type CreateFeedbackInput,
  type Feedback,
  type FeedbackChannel,
  type FeedbackKind,
} from '@/lib/sicted-cliente-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const textareaCls = `${inputCls} min-h-[80px] py-2`;
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

function FeedbackForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedFeedback();
  const [form, setForm] = useState<CreateFeedbackInput>({
    kind: 'QUEJA',
    channel: 'SALA',
    receivedByName: '',
    summary: '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.receivedByName.trim() || !form.summary.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Quién lo recoge y el resumen son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: 'Registrado', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.kind}
          onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value as FeedbackKind }))}
          className={inputCls}
          style={{ colorScheme: 'light dark' }}
        >
          {FEEDBACK_KINDS.map((k) => (
            <option key={k} value={k}>
              {FEEDBACK_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={form.channel}
          onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value as FeedbackChannel }))}
          className={inputCls}
          style={{ colorScheme: 'light dark' }}
        >
          {FEEDBACK_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {FEEDBACK_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={form.summary}
        onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
        placeholder="Resumen (obligatorio)"
        className={textareaCls}
      />
      <input
        value={form.customerContact ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, customerContact: e.target.value }))}
        placeholder="Contacto del cliente (opcional)"
        className={inputCls}
      />
      <input
        value={form.receivedByName}
        onChange={(e) => setForm((p) => ({ ...p, receivedByName: e.target.value }))}
        placeholder="Quién lo recoge"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Registrar
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FeedbackDetail({ item, canManage, onBack }: { item: Feedback; canManage: boolean; onBack: () => void }) {
  const notify = useNotification();
  const respond = useRespondSictedFeedback();
  const close = useCloseSictedFeedback();
  const [response, setResponse] = useState('');
  const [respondedByName, setRespondedByName] = useState('');

  async function handleRespond() {
    if (!response.trim() || !respondedByName.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: '' });
      return;
    }
    try {
      await respond.mutateAsync({ id: item.id, response, respondedByName });
      notify({ type: 'success', title: 'Respondido', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function handleClose() {
    try {
      await close.mutateAsync({ id: item.id });
      notify({ type: 'success', title: 'Cerrado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        ← Volver
      </button>
      <div className="mb-4 space-y-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="font-semibold">
          {FEEDBACK_KIND_LABELS[item.kind]} · {FEEDBACK_CHANNEL_LABELS[item.channel]}
        </h3>
        <p className="text-sm text-[var(--on-surface-variant)]">{fmtDateTime(item.receivedAt)} · recogida por {item.receivedByName}</p>
        <p className="mt-2 text-sm">{item.summary}</p>
      </div>

      {item.respondedAt ? (
        <div className="mb-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
          <p className="flex items-center gap-2 font-medium text-[var(--primary)]">
            <CheckCircle2 className="h-5 w-5" /> Respondido el {fmtDateTime(item.respondedAt)} por {item.respondedByName}
          </p>
          <p className="mt-2 text-sm">{item.response}</p>
        </div>
      ) : canManage ? (
        <div className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Respuesta" className={textareaCls} />
          <input
            value={respondedByName}
            onChange={(e) => setRespondedByName(e.target.value)}
            placeholder="Quién responde"
            className={inputCls}
          />
          <button
            type="button"
            disabled={respond.isPending}
            onClick={handleRespond}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Responder
          </button>
        </div>
      ) : null}

      {item.respondedAt && !item.closedAt && canManage && (
        <button
          type="button"
          disabled={close.isPending}
          onClick={handleClose}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
        >
          <CheckCircle2 className="h-4 w-4" /> Cerrar
        </button>
      )}
      {item.closedAt && (
        <p className="text-sm text-[var(--on-surface-variant)]">Cerrado el {fmtDateTime(item.closedAt)}</p>
      )}
    </div>
  );
}

/** CLI.3 — quejas, sugerencias y felicitaciones. Captura interna, sin formulario público por QR. */
export function SictedClienteFeedbackTab() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: items, isLoading } = useSictedFeedback();
  const { data: overdue } = useSictedFeedbackOverdue();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = items?.find((i) => i.id === selectedId);
  if (selected) {
    return <FeedbackDetail item={selected} canManage={canManage} onBack={() => setSelectedId(null)} />;
  }

  const overdueIds = new Set((overdue?.items ?? []).map((i) => i.id));

  return (
    <div>
      {overdue && overdue.items.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]">
          <AlertTriangle className="h-4 w-4" /> {overdue.items.length} sin responder pasadas {overdue.slaHours}h
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Registrar
        </button>
      </div>
      {creating && <FeedbackForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? null : !items || items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <MessageSquareWarning className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin quejas/sugerencias registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setSelectedId(i.id)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
            >
              <div>
                <p className="font-medium">
                  {FEEDBACK_KIND_LABELS[i.kind]} · {FEEDBACK_CHANNEL_LABELS[i.channel]}
                </p>
                <p className="text-sm text-[var(--on-surface-variant)]">{fmtDateTime(i.receivedAt)}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  overdueIds.has(i.id)
                    ? 'bg-[var(--error-container)] text-[var(--on-error-container)]'
                    : i.status === 'CLOSED'
                      ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                      : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]'
                }`}
              >
                {i.status === 'OPEN' ? 'Abierta' : i.status === 'RESPONDED' ? 'Respondida' : 'Cerrada'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
