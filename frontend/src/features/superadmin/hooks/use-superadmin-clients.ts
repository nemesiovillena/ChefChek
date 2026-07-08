'use client';

import { useCallback, useState } from 'react';
import { useNotification } from '@/components/notification-system';
import {
  listTenants,
  listTrashedTenants,
  createTenant,
  updateTenant,
  deactivateTenant,
  restoreTenant,
  purgeTenant,
  type TenantSummary,
  type TrashedTenant,
  type CreateTenantPayload,
  type UpdateTenantPayload,
} from '../api/superadmin-api';

interface UseSuperadminClientsResult {
  active: TenantSummary[];
  trashed: TrashedTenant[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshActive: () => Promise<void>;
  refreshTrashed: () => Promise<void>;
  create: (payload: CreateTenantPayload) => Promise<TenantSummary>;
  update: (id: string, payload: UpdateTenantPayload) => Promise<TenantSummary>;
  deactivate: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
}

/**
 * Gestión completa de clientes (tenants) del superadmin: listado activo,
 * papelera (dados de baja) y mutaciones alta/edición/baja/reactivar/purgar.
 * Cada mutación refresca las listas afectadas y notifica el resultado.
 */
export function useSuperadminClients(): UseSuperadminClientsResult {
  const notify = useNotification();
  const [active, setActive] = useState<TenantSummary[]>([]);
  const [trashed, setTrashed] = useState<TrashedTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshActive = useCallback(async () => {
    try {
      const data = await listTenants();
      setActive(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clientes');
    }
  }, []);

  const refreshTrashed = useCallback(async () => {
    try {
      setTrashed(await listTrashedTenants());
    } catch {
      // La papelera no debe bloquear el listado activo.
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([refreshActive(), refreshTrashed()]);
    setLoading(false);
  }, [refreshActive, refreshTrashed]);

  const create = useCallback(
    async (payload: CreateTenantPayload) => {
      const t = await createTenant(payload);
      notify({ type: 'success', title: 'Cliente creado', message: t.name });
      await refreshActive();
      return t;
    },
    [notify, refreshActive],
  );

  const update = useCallback(
    async (id: string, payload: UpdateTenantPayload) => {
      const t = await updateTenant(id, payload);
      notify({ type: 'success', title: 'Cliente actualizado', message: t.name });
      await refreshActive();
      return t;
    },
    [notify, refreshActive],
  );

  const deactivate = useCallback(
    async (id: string) => {
      await deactivateTenant(id);
      notify({ type: 'success', title: 'Cliente dado de baja', message: 'Movido a la papelera' });
      await Promise.all([refreshActive(), refreshTrashed()]);
    },
    [notify, refreshActive, refreshTrashed],
  );

  const restore = useCallback(
    async (id: string) => {
      await restoreTenant(id);
      notify({ type: 'success', title: 'Cliente reactivado', message: 'Acceso restaurado' });
      await Promise.all([refreshActive(), refreshTrashed()]);
    },
    [notify, refreshActive, refreshTrashed],
  );

  const purge = useCallback(
    async (id: string) => {
      await purgeTenant(id);
      notify({ type: 'success', title: 'Cliente borrado definitivamente', message: 'No se puede deshacer' });
      await refreshTrashed();
    },
    [notify, refreshTrashed],
  );

  return {
    active,
    trashed,
    loading,
    error,
    refresh,
    refreshActive,
    refreshTrashed,
    create,
    update,
    deactivate,
    restore,
    purge,
  };
}
