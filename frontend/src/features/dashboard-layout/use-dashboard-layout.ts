'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/contexts/auth.context';
import type { DashboardLayout, SharedDeviceLayout } from './dashboard-widgets';

const BASE_URL = '/v1/dashboard-layout';
const KEYS = {
  me: (userId: string | undefined) => ['dashboard-layout', 'me', userId ?? ''],
  devices: ['dashboard-layout', 'devices'],
};

/**
 * Pantalla de inicio del usuario actual. `layout` null = dashboard completo
 * (cuentas personales y dispositivos sin configurar). La clave lleva el id
 * para que al cambiar de cuenta en el mismo equipo no se arrastre la anterior.
 */
export function useMyDashboardLayout() {
  const { user } = useAuth();
  const query = useApiQuery<{ layout: DashboardLayout | null }>(
    KEYS.me(user?.id),
    `${BASE_URL}/me`,
    { enabled: Boolean(user?.id) },
  );
  return { layout: query.data?.layout ?? null, isLoading: query.isLoading };
}

/** Dispositivos compartidos con su pantalla (Configuración, OWNER/ADMIN). */
export function useSharedDeviceLayouts(enabled: boolean) {
  return useApiQuery<SharedDeviceLayout[]>(KEYS.devices, `${BASE_URL}/devices`, { enabled });
}

function useInvalidateLayouts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
}

export function useSaveDeviceLayout() {
  const invalidate = useInvalidateLayouts();
  return useMutation({
    mutationFn: async ({ userId, layout }: { userId: string; layout: DashboardLayout }) => {
      const response = await apiClient.put<DashboardLayout>(`${BASE_URL}/devices/${userId}`, layout);
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useResetDeviceLayout() {
  const invalidate = useInvalidateLayouts();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`${BASE_URL}/devices/${userId}`);
    },
    onSuccess: invalidate,
  });
}
