'use client';

import { useState, useCallback } from 'react';
import { fetchModuleStates, toggleModule, isModuleConflictError, isPermissionError } from '../api/modules-api';
import { Module } from '../types/module.types';
import { useAuth } from '@/contexts/auth.context';

interface UseModulesResult {
  modules: Module[] | null;
  loading: boolean;
  error: string | null;
  toggleEnabled: (moduleId: string, enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
  canManageModules: boolean;
  /**
   * Whether a module is enabled for the current tenant. Returns true while
   * modules are still loading (avoids hiding nav during the initial fetch)
   * and for items without a moduleId (transversal features).
   */
  isEnabled: (moduleId?: string) => boolean;
}

export function useModules(): UseModulesResult {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Los módulos son gestionados exclusivamente por SUPERADMIN desde su panel
  const canManageModules = false;

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModuleStates();
      setModules(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleEnabled = useCallback(async (moduleId: string, enabled: boolean) => {
    // Optimistic update
    const previousModules = modules;
    setModules((prev) =>
      prev?.map((m) => (m.id === moduleId ? { ...m, enabled } : m)) || null
    );

    try {
      const updated = await toggleModule(moduleId, enabled);
      // Confirm the update from server
      setModules((prev) =>
        prev?.map((m) => (m.id === moduleId ? updated : m)) || null
      );
    } catch (err: unknown) {
      // Rollback on error
      setModules(previousModules);

      if (isPermissionError(err)) {
        setError('Solo el OWNER puede gestionar módulos');
      } else if (isModuleConflictError(err)) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update module');
      }
      throw err;
    }
  }, [modules]);

  const isEnabled = useCallback(
    (moduleId?: string) => {
      if (!moduleId) return true;
      // While loading, keep items visible to avoid a flash of hidden nav.
      if (!modules) return true;
      return modules.some((m) => m.id === moduleId && m.enabled);
    },
    [modules],
  );

  return {
    modules,
    loading,
    error,
    toggleEnabled,
    refetch: fetchModules,
    canManageModules,
    isEnabled,
  };
}