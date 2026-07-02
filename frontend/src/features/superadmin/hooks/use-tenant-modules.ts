'use client';

import { useState, useCallback } from 'react';
import { getTenantModules, toggleTenantModule, TenantModule } from '../api/superadmin-api';

interface UseTenantModulesResult {
  modules: TenantModule[];
  loading: boolean;
  error: string | null;
  fetchModules: (tenantId: string) => Promise<void>;
  toggle: (tenantId: string, moduleId: string, enabled: boolean) => Promise<void>;
}

export function useTenantModules(): UseTenantModulesResult {
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantModules(tenantId);
      setModules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar módulos');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (tenantId: string, moduleId: string, enabled: boolean) => {
    const previous = modules;
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, enabled } : m)));
    try {
      const updated = await toggleTenantModule(tenantId, moduleId, enabled);
      setModules((prev) => prev.map((m) => (m.id === moduleId ? updated : m)));
    } catch (err) {
      setModules(previous);
      throw err;
    }
  }, [modules]);

  return { modules, loading, error, fetchModules, toggle };
}
