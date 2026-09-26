'use client';

import { useState, type FormEvent } from 'react';
import { Briefcase, Loader2, Plus, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useAssignSictedJobProfile,
  useCreateSictedJobProfile,
  useSictedJobProfiles,
  useSictedUnassignedUsers,
} from '@/hooks/use-sicted-personas';
import type { JobProfile, JobProfileInput } from '@/lib/sicted-personas-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const textareaCls = `${inputCls} min-h-[80px] py-2`;
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

function JobProfileForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedJobProfile();
  const [form, setForm] = useState<JobProfileInput>({ title: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      notify({ type: 'error', title: 'Falta el título', message: 'El puesto necesita un nombre.' });
      return;
    }
    try {
      await create.mutateAsync({
        ...form,
        responsibilities: form.responsibilities?.filter(Boolean),
        tasks: form.tasks?.filter(Boolean),
      });
      notify({ type: 'success', title: 'Ficha de puesto creada', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <input
        value={form.title}
        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        placeholder="Puesto (ej. Camarero/a)"
        className={inputCls}
      />
      <input
        value={form.reportsTo ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, reportsTo: e.target.value }))}
        placeholder="Reporta a (opcional)"
        className={inputCls}
      />
      <textarea
        value={form.mission ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, mission: e.target.value }))}
        placeholder="Misión del puesto (opcional)"
        className={textareaCls}
      />
      <textarea
        value={(form.tasks ?? []).join('\n')}
        onChange={(e) => setForm((p) => ({ ...p, tasks: e.target.value.split('\n') }))}
        placeholder="Tareas (una por línea)"
        className={textareaCls}
      />
      <textarea
        value={(form.responsibilities ?? []).join('\n')}
        onChange={(e) => setForm((p) => ({ ...p, responsibilities: e.target.value.split('\n') }))}
        placeholder="Responsabilidades (una por línea)"
        className={textareaCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear ficha
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function AssignPersonRow({ profile, canManage }: { profile: JobProfile; canManage: boolean }) {
  const notify = useNotification();
  const { data: unassigned } = useSictedUnassignedUsers();
  const assign = useAssignSictedJobProfile();
  const [selected, setSelected] = useState('');
  const active = profile.assignments.filter((a) => !a.until);

  async function handleAssign() {
    if (!selected) return;
    try {
      await assign.mutateAsync({ profileId: profile.id, userId: selected });
      notify({ type: 'success', title: 'Persona asignada', message: '' });
      setSelected('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <Users className="h-4 w-4 text-[var(--on-surface-variant)]" />
      {active.length === 0 ? (
        <span className="text-[var(--on-surface-variant)]">Sin persona asignada</span>
      ) : (
        <span>{active.map((a) => a.userName).join(', ')}</span>
      )}
      {canManage && (
        <>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-h-[36px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 text-sm"
            style={{ colorScheme: 'light dark' }}
          >
            <option value="">Asignar persona…</option>
            {(unassigned ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selected || assign.isPending}
            onClick={handleAssign}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--primary)] px-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            <UserPlus className="h-3.5 w-3.5" /> Asignar
          </button>
        </>
      )}
    </div>
  );
}

/** Fichas de puesto (Personas) — tareas y responsabilidades exactas de cada puesto. */
export function SictedPersonasJobsTab() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const { data: profiles, isLoading } = useSictedJobProfiles();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nueva ficha de puesto
          </button>
        </div>
      )}

      {creating && <JobProfileForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !profiles || profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin fichas de puesto creadas.
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
              <p className="font-medium">{p.title}</p>
              {p.mission && <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{p.mission}</p>}
              {p.tasks.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-[var(--on-surface-variant)]">
                  {p.tasks.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
              <AssignPersonRow profile={p} canManage={canManage} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
