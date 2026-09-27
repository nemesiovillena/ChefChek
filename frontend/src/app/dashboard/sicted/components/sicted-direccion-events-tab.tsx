'use client';

import { useState } from 'react';
import { Calendar, Loader2, Paperclip, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useCreateEvent, useSictedEvents } from '@/hooks/use-sicted-direccion';
import type { EventKind } from '@/lib/sicted-direccion-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const inputCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-sm';

const KIND_LABELS: Record<EventKind, string> = {
  GRUPO_MEJORA: 'Grupo de mejora',
  FORMACION_DESTINO: 'Formación del destino',
  EVALUACION_EXTERNA: 'Evaluación externa',
  OTRO: 'Otro',
};

/** Eventos SICTED (fase 9, sub-PR 3) — evidencia de participación, append-only. */
export function SictedDireccionEventsTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: eventsList, isLoading } = useSictedEvents();
  const create = useCreateEvent();
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<EventKind>('GRUPO_MEJORA');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [attended, setAttended] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  async function handleCreate() {
    if (!title.trim() || !eventDate) {
      notify({ type: 'error', title: 'Falta el título o la fecha', message: '' });
      return;
    }
    try {
      await create.mutateAsync({ kind, title: title.trim(), eventDate, attended, attachment: file ?? undefined });
      setTitle('');
      setEventDate('');
      setFile(null);
      setShowForm(false);
      notify({ type: 'success', title: 'Evento registrado', message: '' });
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
            <Plus className="h-3.5 w-3.5" /> Nuevo evento
          </button>
          {showForm && (
            <div className="mt-3 space-y-3 rounded-xl border border-[var(--outline-variant)] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputCls}>
                  {(Object.keys(KIND_LABELS) as EventKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del evento" className={inputCls} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} />
                  Asistió
                </label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={handleCreate}
                  className="ml-auto min-h-[40px] rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
                >
                  Registrar
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
      ) : !eventsList || eventsList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <Calendar className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin eventos registrados.
        </div>
      ) : (
        <div className="space-y-2">
          {eventsList.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm"
            >
              <span className="w-28 shrink-0 text-[var(--on-surface-variant)]">
                {new Date(e.eventDate).toLocaleDateString('es-ES')}
              </span>
              <span className="w-40 shrink-0 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-center text-xs">
                {KIND_LABELS[e.kind]}
              </span>
              <span className="flex-1">{e.title}</span>
              {!e.attended && (
                <span className="shrink-0 rounded-full bg-[var(--error-container)] px-2 py-0.5 text-xs text-[var(--on-error-container)]">
                  No asistió
                </span>
              )}
              {e.attachment && <Paperclip className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
