'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Plus, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useAckSictedProtocol,
  useCreateSictedProtocol,
  usePublishSictedProtocolVersion,
  useSictedPendingProtocols,
  useSictedProtocolMatrix,
  useSictedProtocols,
} from '@/hooks/use-sicted-personas';
import type { Protocol, ProtocolInput } from '@/lib/sicted-personas-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const textareaCls = `${inputCls} min-h-[120px] py-2`;
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

function ProtocolForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedProtocol();
  const [form, setForm] = useState<ProtocolInput>({ area: '', title: '', body: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.area.trim() || !form.title.trim() || !form.body?.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Área, título y contenido son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: 'Protocolo creado', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <input value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} placeholder="Área (ej. Sala, Cocina)" className={inputCls} />
      <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título" className={inputCls} />
      <textarea
        value={form.body ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
        placeholder="Contenido del protocolo"
        className={textareaCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear protocolo
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PublishVersionForm({ protocol, onDone }: { protocol: Protocol; onDone: () => void }) {
  const notify = useNotification();
  const publish = usePublishSictedProtocolVersion();
  const [body, setBody] = useState(protocol.body ?? '');

  async function handlePublish() {
    if (!body.trim()) {
      notify({ type: 'error', title: 'Falta contenido', message: '' });
      return;
    }
    try {
      await publish.mutateAsync({ id: protocol.id, body });
      notify({ type: 'success', title: 'Nueva versión publicada', message: 'El equipo tendrá que volver a acusar.' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className={textareaCls} />
      <button
        type="button"
        disabled={publish.isPending}
        onClick={handlePublish}
        className="flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
        Publicar nueva versión (invalida acuses)
      </button>
    </div>
  );
}

function PendingProtocols() {
  const notify = useNotification();
  const { data: pending, isLoading } = useSictedPendingProtocols();
  const ack = useAckSictedProtocol();

  async function handleAck(id: string) {
    try {
      await ack.mutateAsync(id);
      notify({ type: 'success', title: 'Acusado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  if (isLoading) return null;
  if (!pending || pending.length === 0) {
    return (
      <p className="mb-6 flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
        <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" /> Sin protocolos pendientes de acusar.
      </p>
    );
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-[var(--error)]">
        <AlertTriangle className="h-4 w-4" /> Mis protocolos pendientes ({pending.length})
      </h3>
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] p-3 text-[var(--on-error-container)]">
            <p className="font-medium">{p.title}</p>
            <p className="text-sm">{p.area} · v{p.version}</p>
            {p.body && <p className="mt-2 text-sm">{p.body}</p>}
            <button
              type="button"
              disabled={ack.isPending}
              onClick={() => handleAck(p.id)}
              className="mt-2 flex min-h-[40px] items-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {ack.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              He leído y entendido
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AckMatrix() {
  const { data: matrix, isLoading } = useSictedProtocolMatrix();
  if (isLoading || !matrix || matrix.length === 0) return null;
  return (
    <section className="mb-6 overflow-x-auto">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">Matriz protocolo × empleado</h3>
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left">Protocolo</th>
            {matrix[0].employees.map((e) => (
              <th key={e.userId} className="p-2 text-center">
                {e.userName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.protocolId} className="border-t border-[var(--outline-variant)]">
              <td className="p-2">
                {row.title} <span className="text-[var(--on-surface-variant)]">v{row.version}</span>
              </td>
              {row.employees.map((e) => (
                <td key={e.userId} className="p-2 text-center">
                  {e.acked ? (
                    <CheckCircle2 className="mx-auto h-4 w-4 text-[var(--primary)]" />
                  ) : (
                    <span className="text-[var(--error)]">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Protocolos con acuse versionado — imagen/higiene personal/uniformidad, bienvenida, etc. */
export function SictedPersonasProtocolsTab() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: protocols, isLoading } = useSictedProtocols();
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  return (
    <div>
      <PendingProtocols />
      {canManage && <AckMatrix />}

      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nuevo protocolo
          </button>
        </div>
      )}
      {creating && <ProtocolForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !protocols || protocols.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin protocolos creados.
        </div>
      ) : (
        <div className="space-y-2">
          {protocols.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
              <p className="font-medium">
                {p.title} <span className="text-sm text-[var(--on-surface-variant)]">v{p.version}</span>
              </p>
              <p className="text-sm text-[var(--on-surface-variant)]">{p.area}</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setPublishingId(publishingId === p.id ? null : p.id)}
                  className="mt-2 text-xs font-medium text-[var(--primary)] underline"
                >
                  Publicar nueva versión
                </button>
              )}
              {publishingId === p.id && <PublishVersionForm protocol={p} onDone={() => setPublishingId(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
