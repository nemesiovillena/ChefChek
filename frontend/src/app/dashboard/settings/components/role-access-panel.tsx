'use client';

import { Fragment, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import type { RoleAccessConfig, SectionAccessMap } from '@/features/modules/api/role-access-api';
import { refetchSectionAccess } from '@/features/modules/hooks/use-section-access';
import {
  useRoleAccessConfig,
  useUpdateRoleAccess,
} from '@/features/modules/hooks/use-role-access-config';

const MANAGER_ROLES = ['OWNER', 'ADMIN'];
type RoleCol = 'USER' | 'VIEWER';

/**
 * Sub-capabilities that stay meaningful even when their parent section is
 * hidden — e.g. "ver tareas de preparación" with Producción off (the whole
 * point of the restricted "sala" role). Not greyed out when the parent is off.
 */
const PARENT_INDEPENDENT_SUBS = new Set(['production.tasks']);

/**
 * "Permisos por rol": lets OWNER/ADMIN choose which sections USER and VIEWER
 * see in this tenant. ADMIN and above are never affected. Absence of a row ⇒
 * allowed, so the feature only ever removes access.
 */
export function RoleAccessPanel() {
  const { user } = useAuth();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');
  const { data, isLoading } = useRoleAccessConfig(isManager);

  if (!isManager) return null;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold">Permisos por rol</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Elige qué apartados ven los roles <strong>Usuario</strong> y <strong>Visor</strong> de tu
        organización. No afecta a administradores. Los cambios se aplican la próxima vez que el
        usuario recargue.
      </p>

      {isLoading || !data ? (
        <div className="text-sm text-gray-500 py-4">Cargando…</div>
      ) : (
        <RoleAccessMatrix key={JSON.stringify({ u: data.USER, v: data.VIEWER })} config={data} />
      )}
    </div>
  );
}

function RoleAccessMatrix({ config }: { config: RoleAccessConfig }) {
  const addNotification = useNotification();
  const updateMutation = useUpdateRoleAccess();

  const [draft, setDraft] = useState<{ USER: SectionAccessMap; VIEWER: SectionAccessMap }>(() => ({
    USER: { ...config.USER },
    VIEWER: { ...config.VIEWER },
  }));

  const dirty = useMemo(
    () =>
      config.sections.some(
        (s) =>
          draft.USER[s.key] !== config.USER[s.key] ||
          draft.VIEWER[s.key] !== config.VIEWER[s.key],
      ),
    [draft, config],
  );

  const parents = config.sections.filter((s) => !s.parent);
  const childrenOf = (key: string) => config.sections.filter((s) => s.parent === key);

  const toggle = (col: RoleCol, key: string) =>
    setDraft((prev) => ({
      ...prev,
      [col]: { ...prev[col], [key]: !(prev[col][key] ?? true) },
    }));

  const handleSave = async () => {
    // Send only changed keys — avoids ~50 upserts per save and lets two admins
    // edit different sections without clobbering each other.
    const diff = (col: RoleCol): SectionAccessMap => {
      const out: SectionAccessMap = {};
      for (const s of config.sections) {
        if (draft[col][s.key] !== config[col][s.key]) out[s.key] = draft[col][s.key] ?? true;
      }
      return out;
    };
    const payload: { USER?: SectionAccessMap; VIEWER?: SectionAccessMap } = {};
    const userDiff = diff('USER');
    const viewerDiff = diff('VIEWER');
    if (Object.keys(userDiff).length) payload.USER = userDiff;
    if (Object.keys(viewerDiff).length) payload.VIEWER = viewerDiff;

    try {
      await updateMutation.mutateAsync(payload);
      await refetchSectionAccess();
      addNotification({ type: 'success', title: 'Guardado', message: 'Permisos por rol actualizados.' });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudieron guardar los permisos.',
      });
    }
  };

  const Cell = ({ col, sectionKey, disabled }: { col: RoleCol; sectionKey: string; disabled?: boolean }) => (
    <td className="px-3 py-2 text-center">
      <input
        type="checkbox"
        className="h-4 w-4 accent-indigo-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        checked={draft[col][sectionKey] ?? true}
        disabled={disabled}
        onChange={() => toggle(col, sectionKey)}
        aria-label={`${col === 'USER' ? 'Usuario' : 'Visor'} — ${sectionKey}`}
      />
    </td>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="px-3 py-2 text-left font-medium">Apartado</th>
              <th className="px-3 py-2 text-center font-medium w-24">Usuario</th>
              <th className="px-3 py-2 text-center font-medium w-24">Visor</th>
            </tr>
          </thead>
          <tbody>
            {parents.map((parent) => {
              const kids = childrenOf(parent.key);
              return (
                <Fragment key={parent.key}>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{parent.label}</td>
                    <Cell col="USER" sectionKey={parent.key} />
                    <Cell col="VIEWER" sectionKey={parent.key} />
                  </tr>
                  {kids.map((child) => {
                    // `recipes.edit` only affects USER — VIEWER is always read-only.
                    const viewerNA = child.key === 'recipes.edit';
                    const independent = PARENT_INDEPENDENT_SUBS.has(child.key);
                    return (
                      <tr key={child.key} className="border-b border-gray-100 bg-gray-50/60">
                        <td className="px-3 py-2 pl-8 text-gray-500">└ {child.label}</td>
                        <Cell
                          col="USER"
                          sectionKey={child.key}
                          disabled={!independent && !(draft.USER[parent.key] ?? true)}
                        />
                        <Cell
                          col="VIEWER"
                          sectionKey={child.key}
                          disabled={
                            viewerNA ||
                            (!independent && !(draft.VIEWER[parent.key] ?? true))
                          }
                        />
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        {dirty && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
      </div>
    </div>
  );
}
