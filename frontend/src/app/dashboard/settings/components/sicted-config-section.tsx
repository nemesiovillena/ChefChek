'use client';

import { useState } from 'react';
import { Loader2, Verified } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useSictedComplementaryGroups, useUpdateSictedComplementaryGroups } from '@/hooks/use-sicted-direccion';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

/**
 * Configuración → SICTED: qué módulos complementarios del Manual de Buenas
 * Prácticas aplican al negocio (eventos, barra, aparcamiento...). Es el mismo
 * ajuste que el asesor hace al configurar el MBP en la web oficial SICTED;
 * aquí decide qué prácticas complementarias entran en la autoevaluación.
 * Solo visible con el módulo SICTED activo (lo activa el superadministrador).
 */
export function SictedConfigSection() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const notify = useNotification();
  const active = isEnabled('sicted');
  const { data: groups, isLoading } = useSictedComplementaryGroups(active);
  const update = useUpdateSictedComplementaryGroups();
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  if (!active) return null;

  const saved = new Set((groups ?? []).filter((g) => g.enabled).map((g) => g.key));
  const selected = draft ?? saved;
  const dirty = draft !== null && (draft.size !== saved.size || [...draft].some((k) => !saved.has(k)));

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft(next);
  }

  async function handleSave() {
    try {
      await update.mutateAsync([...selected]);
      setDraft(null);
      notify({ type: 'success', title: 'Módulos complementarios guardados', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="bg-white shadow rounded-lg mb-6 p-6 dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-2">
        <Verified className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold">SICTED</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Marca lo que ofrece tu establecimiento. Cada opción añade a la autoevaluación las buenas prácticas complementarias
        correspondientes, igual que al configurar tu manual en la web oficial SICTED. Las prácticas de oficio aplican siempre.
      </p>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(groups ?? []).map((g) => (
            <label
              key={g.key}
              className={`flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-zinc-700 ${canManage ? 'cursor-pointer' : 'opacity-70'}`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={selected.has(g.key)}
                disabled={!canManage}
                onChange={() => toggle(g.key)}
              />
              <span>
                <span className="block font-medium">{g.label}</span>
                <span className="block text-sm text-gray-500">{g.condition}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {canManage && (
        <button
          type="button"
          disabled={!dirty || update.isPending}
          onClick={handleSave}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
      )}
    </div>
  );
}
