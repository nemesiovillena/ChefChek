'use client';

import { useState } from 'react';
import { Loader2, Verified } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import {
  useSictedCommitments,
  useSictedComplementaryGroups,
  useUpdateSictedComplementaryGroups,
  useUpdateSictedCycle,
} from '@/hooks/use-sicted-direccion';
import { CYCLE_PHASE_LABELS, type SictedCyclePhase } from '@/lib/sicted-direccion-types';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];
const fieldCls =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-900';

/**
 * Fase del ciclo de distinción y fecha del próximo comité (las fija el
 * gestor del destino en la web SICTED; aquí se copian para el panel de
 * compromisos). Se remonta vía `key` cuando llegan valores del servidor.
 */
function CycleForm({
  phase,
  phaseStartedAt,
  nextCommitteeDate,
  canManage,
}: {
  phase: SictedCyclePhase | null;
  phaseStartedAt: string | null;
  nextCommitteeDate: string | null;
  canManage: boolean;
}) {
  const notify = useNotification();
  const update = useUpdateSictedCycle();
  const [draftPhase, setDraftPhase] = useState<SictedCyclePhase | ''>(phase ?? '');
  const [start, setStart] = useState(phaseStartedAt?.slice(0, 10) ?? '');
  const [committee, setCommittee] = useState(nextCommitteeDate?.slice(0, 10) ?? '');

  async function handleSave() {
    try {
      await update.mutateAsync({
        cyclePhase: draftPhase || null,
        phaseStartedAt: start || null,
        nextCommitteeDate: committee || null,
      });
      notify({ type: 'success', title: 'Fase del distintivo guardada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="mb-6">
      <h3 className="mb-1 font-semibold">Fase del distintivo</h3>
      <p className="mb-3 text-sm text-gray-500">
        Cópialas de tu Espacio de gestión en la web SICTED. Con ellas, la portada de SICTED muestra qué compromisos te faltan
        para el próximo comité.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-500">Fase actual</span>
          <select
            value={draftPhase}
            disabled={!canManage}
            onChange={(e) => setDraftPhase(e.target.value as SictedCyclePhase | '')}
            className={fieldCls}
          >
            <option value="">Sin indicar</option>
            {(Object.keys(CYCLE_PHASE_LABELS) as SictedCyclePhase[]).map((p) => (
              <option key={p} value={p}>
                {CYCLE_PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-500">Inicio de la fase</span>
          <input type="date" value={start} disabled={!canManage} onChange={(e) => setStart(e.target.value)} className={fieldCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-500">Próximo comité de distinción</span>
          <input
            type="date"
            value={committee}
            disabled={!canManage}
            onChange={(e) => setCommittee(e.target.value)}
            className={fieldCls}
          />
        </label>
      </div>
      {canManage && (
        <button
          type="button"
          disabled={update.isPending}
          onClick={handleSave}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar fase
        </button>
      )}
    </div>
  );
}

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
  const { data: commitments } = useSictedCommitments(active);
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
      {commitments && (
        <CycleForm
          key={`${commitments.phase}-${commitments.phaseStartedAt}-${commitments.nextCommitteeDate}`}
          phase={commitments.phase}
          phaseStartedAt={commitments.phaseStartedAt}
          nextCommitteeDate={commitments.nextCommitteeDate}
          canManage={canManage}
        />
      )}
      <h3 className="mb-1 font-semibold">Módulos complementarios</h3>
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
