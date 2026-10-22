'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  type TeamPosition,
  useAccessSections,
  useArchiveTeamPosition,
  useCreateTeamPosition,
  useRenameTeamPosition,
  useTeamPositions,
  useUpdatePositionAccess,
} from '@/hooks/use-team-positions';
import type { RoleAccessSection } from '@/features/modules/api/role-access-api';

const inputCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base text-[var(--on-surface)]';

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Casillas «qué ve este puesto», agrupadas como en Accesos por rol. */
function PositionAccessEditor({ position, sections }: { position: TeamPosition; sections: RoleAccessSection[] }) {
  const notify = useNotification();
  const update = useUpdatePositionAccess();
  const parents = sections.filter((s) => !s.parent);
  const childrenOf = (key: string) => sections.filter((s) => s.parent === key);
  const sees = (key: string) => position.access[key] !== false;

  async function toggle(key: string, value: boolean) {
    try {
      await update.mutateAsync({ id: position.id, access: { [key]: value } });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo guardar', message: errorMessage(err, '') });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--on-surface-variant)]">
        Desmarca lo que este puesto no debe ver. Nunca verá más de lo que permita su rol en Ajustes → Accesos por rol.
        Administración y propietario lo ven todo.
      </p>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {parents.map((parent) => (
          <li key={parent.key}>
            <label className="flex min-h-[32px] items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={sees(parent.key)}
                disabled={update.isPending}
                onChange={(e) => toggle(parent.key, e.target.checked)}
              />
              {parent.label}
            </label>
            {childrenOf(parent.key).length > 0 && (
              <ul className="ml-6 mt-1 space-y-1">
                {childrenOf(parent.key).map((child) => (
                  <li key={child.key}>
                    <label className="flex min-h-[28px] items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={sees(parent.key) && sees(child.key)}
                        disabled={update.isPending || !sees(parent.key)}
                        onChange={(e) => toggle(child.key, e.target.checked)}
                      />
                      {child.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PositionCard({ position, sections }: { position: TeamPosition; sections: RoleAccessSection[] }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const rename = useRenameTeamPosition();
  const archive = useArchiveTeamPosition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(position.title);
  const hidden = Object.values(position.access).filter((v) => v === false).length;

  async function saveTitle() {
    try {
      await rename.mutateAsync({ id: position.id, title });
      setEditing(false);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo renombrar', message: errorMessage(err, '') });
    }
  }

  async function handleArchive() {
    const ok = await confirm({
      title: `Archivar «${position.title}»`,
      description:
        position.users.length > 0
          ? `${position.users.length} persona(s) se quedarán sin puesto y verán lo que permita su rol.`
          : 'El puesto dejará de aparecer en Equipo y en SICTED.',
      confirmText: 'Archivar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await archive.mutateAsync(position.id);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo archivar', message: errorMessage(err, '') });
    }
  }

  return (
    <li className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              className={inputCls}
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <button type="button" aria-label="Guardar nombre" onClick={saveTitle} className="p-2 text-[var(--on-surface-variant)] hover:text-indigo-600">
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Cancelar"
              onClick={() => {
                setTitle(position.title);
                setEditing(false);
              }}
              className="p-2 text-[var(--on-surface-variant)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex flex-1 items-center gap-2 text-left"
          >
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="min-w-0">
              <span className="block font-medium text-[var(--on-surface)]">{position.title}</span>
              <span className="block text-sm text-[var(--on-surface-variant)]">
                {position.users.length === 0
                  ? 'Sin personas'
                  : position.users.map((u) => u.name).join(', ')}
                {hidden > 0 && ` · oculta ${hidden} apartado${hidden === 1 ? '' : 's'}`}
              </span>
            </span>
          </button>
        )}
        {!editing && (
          <div className="flex items-center gap-1">
            <button type="button" title="Renombrar" aria-label="Renombrar" onClick={() => setEditing(true)} className="p-2 text-[var(--on-surface-variant)] hover:text-indigo-600">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" title="Archivar" aria-label="Archivar" onClick={handleArchive} className="p-2 text-[var(--on-surface-variant)] hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-4 border-t border-[var(--outline-variant)] pt-4">
          <PositionAccessEditor position={position} sections={sections} />
        </div>
      )}
    </li>
  );
}

/**
 * Puestos de trabajo del establecimiento y qué apartados ve cada uno. La
 * persona se asigna a un puesto desde la pestaña Personas.
 */
export function TeamPositionsTab() {
  const notify = useNotification();
  const positions = useTeamPositions();
  const sections = useAccessSections();
  const create = useCreateTeamPosition();
  const [newTitle, setNewTitle] = useState('');
  // «Igual que…»: el puesto nuevo copia lo que ve y sus áreas de hojas, así
  // sale en el «Quién» de la misma cuenta compartida (Cocina, Sala…).
  const [copyFromId, setCopyFromId] = useState('');

  async function handleCreate() {
    if (!newTitle.trim()) return;
    try {
      await create.mutateAsync({ title: newTitle, copyFromId: copyFromId || undefined });
      setNewTitle('');
      setCopyFromId('');
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo crear el puesto', message: errorMessage(err, '') });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--on-surface-variant)]">
        Crea los puestos del local (Ayudante de cocina, Freganchín, Barra…) y elige qué ve cada uno. Todas las personas
        y cuentas compartidas necesitan un puesto; si no encaja ninguno, crea uno (p. ej. Administración). «Igual que»
        copia lo que ve otro puesto y sus áreas, y así aparece en el «Quién» de la misma cuenta compartida. Son los
        mismos puestos que usa SICTED.
      </p>
      <div className="flex max-w-2xl flex-wrap gap-2">
        <input
          className={inputCls}
          placeholder="Nuevo puesto (p. ej. Barra)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <select
          aria-label="Igual que"
          className={`${inputCls} sm:max-w-[220px]`}
          value={copyFromId}
          onChange={(e) => setCopyFromId(e.target.value)}
        >
          <option value="">Empezar vacío</option>
          {positions.data?.map((p) => (
            <option key={p.id} value={p.id}>
              Igual que {p.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCreate}
          disabled={create.isPending || !newTitle.trim()}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-indigo-600 px-4 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Añadir
        </button>
      </div>

      {(positions.isLoading || sections.isLoading) && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
      {positions.error && <p className="text-sm text-red-600">{positions.error.message}</p>}
      {positions.data && sections.data && (
        <ul className="space-y-3">
          {positions.data.map((p) => (
            <PositionCard key={p.id} position={p} sections={sections.data} />
          ))}
          {positions.data.length === 0 && (
            <li className="py-6 text-center text-sm text-[var(--on-surface-variant)]">Todavía no hay puestos.</li>
          )}
        </ul>
      )}
    </div>
  );
}
