'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { fetchModuleStates, toggleModule, isModuleConflictError, isPermissionError } from '../api/modules-api';
import { Module } from '../types/module.types';

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

/**
 * Estado de módulos del tenant compartido por todos los consumidores (mismo
 * patrón que useSectionAccess). Antes cada `useModules()` tenía su propio
 * useState y solo el layout lo cargaba: en el resto (dashboard, ajustes…)
 * `modules` quedaba en null para siempre e `isEnabled` devolvía true para
 * todo, pintando cards de módulos desactivados (y sus consultas daban 403).
 */
interface ModulesState {
  modules: Module[] | null;
  loading: boolean;
  error: string | null;
}

let state: ModulesState = { modules: null, loading: true, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<ModulesState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function load(): Promise<void> {
  if (!inflight) {
    setState({ loading: true, error: null });
    inflight = fetchModuleStates()
      .then((modules) => setState({ modules, loading: false }))
      .catch((err: unknown) =>
        setState({ loading: false, error: err instanceof Error ? err.message : 'Failed to load modules' }),
      );
  }
  return inflight;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  void load();
  return () => {
    listeners.delete(cb);
  };
}

/** Recarga (p. ej. al autenticarse otro usuario); mantiene el estado anterior visible hasta que llega el nuevo. */
async function refetchModules(): Promise<void> {
  inflight = null;
  await load();
}

const getSnapshot = () => state;

export function useModules(): UseModulesResult {
  const { modules, loading, error } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Los módulos son gestionados exclusivamente por SUPERADMIN desde su panel
  const canManageModules = false;

  const toggleEnabled = useCallback(async (moduleId: string, enabled: boolean) => {
    // Optimistic update
    const previousModules = state.modules;
    setState({ modules: previousModules?.map((m) => (m.id === moduleId ? { ...m, enabled } : m)) ?? null });

    try {
      const updated = await toggleModule(moduleId, enabled);
      // Confirm the update from server
      setState({ modules: state.modules?.map((m) => (m.id === moduleId ? updated : m)) ?? null });
    } catch (err: unknown) {
      // Rollback on error
      setState({ modules: previousModules });

      if (isPermissionError(err)) {
        setState({ error: 'Solo el OWNER puede gestionar módulos' });
      } else if (isModuleConflictError(err)) {
        setState({ error: err.message });
      } else {
        setState({ error: err instanceof Error ? err.message : 'Failed to update module' });
      }
      throw err;
    }
  }, []);

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
    refetch: refetchModules,
    canManageModules,
    isEnabled,
  };
}
