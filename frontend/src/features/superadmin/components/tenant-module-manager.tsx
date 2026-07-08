'use client';

import { useEffect, useState } from 'react';
import { useTenantModules } from '../hooks/use-tenant-modules';
import { TenantSummary } from '../api/superadmin-api';

interface TenantModuleManagerProps {
  tenant: TenantSummary;
}

export function TenantModuleManager({ tenant }: TenantModuleManagerProps) {
  const { modules, loading, error, fetchModules, toggle } = useTenantModules();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules(tenant.id);
  }, [tenant.id, fetchModules]);

  const handleToggle = async (moduleId: string, enabled: boolean) => {
    setTogglingId(moduleId);
    setToggleError(null);
    try {
      await toggle(tenant.id, moduleId, enabled);
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Error al actualizar módulo');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-on-surface-variant font-label-md text-label-md">
        Cargando módulos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-error font-label-md text-label-md">{error}</div>
    );
  }

  return (
    <div>
      <div className="px-stack-lg py-stack-md border-b border-border">
        <h3 className="font-headline-md text-headline-md text-primary">{tenant.name}</h3>
        <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
          {tenant.slug}
        </p>
      </div>

      {toggleError && (
        <div className="mx-stack-lg mt-stack-md p-stack-sm bg-error/10 border border-error/20 rounded text-error font-label-sm text-label-sm">
          {toggleError}
        </div>
      )}

      <ul className="divide-y divide-border">
        {modules.map((mod) => (
          <li key={mod.id} className="flex items-start justify-between px-stack-lg py-stack-md">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-label-md text-label-md text-primary">{mod.name}</span>
                {mod.alwaysActive && (
                  <span className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full">
                    Siempre activo
                  </span>
                )}
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                {mod.description}
              </p>
            </div>
            <button
              onClick={() => handleToggle(mod.id, !mod.enabled)}
              disabled={mod.alwaysActive || togglingId === mod.id}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                mod.enabled ? 'bg-secondary' : 'bg-surface-variant'
              }`}
              title={mod.alwaysActive ? 'Este módulo no se puede desactivar' : undefined}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  mod.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      {modules.length === 0 && !loading && (
        <p className="px-stack-lg py-stack-md text-on-surface-variant font-label-md text-label-md">
          No hay módulos configurados para este tenant.
        </p>
      )}
    </div>
  );
}
