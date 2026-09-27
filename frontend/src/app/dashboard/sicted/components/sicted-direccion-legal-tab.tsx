'use client';

import { useState } from 'react';
import { AlertTriangle, FileText, Loader2, Paperclip, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useArchiveComplianceDoc,
  useCreateComplianceDoc,
  useSictedComplianceDocs,
  useUpdateComplianceDoc,
} from '@/hooks/use-sicted-direccion';
import type { SictedComplianceDoc } from '@/lib/sicted-direccion-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const inputCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm';

// Sugerencias, NO un enum rígido — el tenant puede escribir cualquier etiqueta.
const LABEL_SUGGESTIONS = [
  'Extintores',
  'OCA Industria',
  'Convenio colectivo',
  'Protección de datos',
  'Licencia de actividad',
  'Seguro de responsabilidad civil',
  'Control de plagas',
];

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const days = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= 30;
}

function isExpired(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now();
}

function DocRow({ doc }: { doc: SictedComplianceDoc }) {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const update = useUpdateComplianceDoc();
  const archive = useArchiveComplianceDoc();
  const [renewing, setRenewing] = useState(false);
  const [newExpiresAt, setNewExpiresAt] = useState('');

  async function renew() {
    if (!newExpiresAt) return;
    try {
      await update.mutateAsync({ id: doc.id, data: { expiresAt: newExpiresAt } });
      setRenewing(false);
      setNewExpiresAt('');
      notify({ type: 'success', title: 'Documento renovado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(doc.id);
      notify({ type: 'success', title: 'Documento archivado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const expired = isExpired(doc.expiresAt);
  const soon = !expired && isExpiringSoon(doc.expiresAt);

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs">{doc.label}</span>
        <span className="flex-1 font-medium">{doc.title}</span>
        {doc.attachment && <Paperclip className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />}
        {(expired || soon) && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              expired ? 'bg-[var(--error-container)] text-[var(--on-error-container)]' : 'bg-[var(--surface-container-high)]'
            }`}
          >
            <AlertTriangle className="h-3 w-3" /> {expired ? 'Caducado' : 'Próximo a caducar'}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
        {doc.holderName ? `${doc.holderName} · ` : ''}
        {doc.expiresAt ? `Caduca: ${new Date(doc.expiresAt).toLocaleDateString('es-ES')}` : 'Sin fecha de caducidad'}
      </p>
      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {renewing ? (
            <>
              <input type="date" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} className="min-h-[32px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2 text-xs" />
              <button type="button" disabled={update.isPending} onClick={renew} className="min-h-[32px] rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">
                Guardar nueva fecha
              </button>
              <button type="button" onClick={() => setRenewing(false)} className="text-xs text-[var(--on-surface-variant)]">
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setRenewing(true)} className="min-h-[32px] rounded-lg border border-[var(--outline-variant)] px-3 text-xs font-medium">
                Renovar
              </button>
              <button type="button" disabled={archive.isPending} onClick={handleArchive} className="min-h-[32px] rounded-lg border border-[var(--outline-variant)] px-3 text-xs font-medium disabled:opacity-40">
                Archivar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Documentos legales con caducidad (fase 9, sub-PR 3) — aviso automático a 30 días y al vencer (cron diario). */
export function SictedDireccionLegalTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: docs, isLoading } = useSictedComplianceDocs();
  const create = useCreateComplianceDoc();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  async function handleCreate() {
    if (!label.trim() || !title.trim()) {
      notify({ type: 'error', title: 'Falta la etiqueta o el título', message: '' });
      return;
    }
    try {
      await create.mutateAsync({ label: label.trim(), title: title.trim(), expiresAt: expiresAt || undefined });
      setLabel('');
      setTitle('');
      setExpiresAt('');
      setShowForm(false);
      notify({ type: 'success', title: 'Documento creado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo documento
          </button>
          {showForm && (
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[var(--outline-variant)] p-3 sm:grid-cols-3">
              <div>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta (ej. Extintores)" list="compliance-label-suggestions" className={inputCls} />
                <datalist id="compliance-label-suggestions">
                  {LABEL_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del documento" className={inputCls} />
              <div className="flex gap-2">
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
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
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !docs || docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin documentos legales registrados.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </div>
      )}
    </div>
  );
}
