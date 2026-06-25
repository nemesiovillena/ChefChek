'use client';

import { useState, useCallback } from 'react';
import { fetchModuleStates, toggleModule, isModuleConflictError } from '../api/modules-api';
import { Module } from '../types/module.types';

interface UseModulesResult {
  modules: Module[] | null;
  loading: boolean;
  error: string | null;
  toggleEnabled: (moduleId: string, enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useModules(): UseModulesResult {
  const [modules, setModules] = useState<Module[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      if (isModuleConflictError(err)) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update module');
      }
      throw err;
    }
  }, [modules]);

  return {
    modules,
    loading,
    error,
    toggleEnabled,
    refetch: fetchModules,
  };
}