'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiMutation, useApiQuery, useInvalidateQueries } from '@/hooks/use-api';
import type { RoleAccessConfig, SectionAccessMap } from '../api/role-access-api';

const ROLE_ACCESS_CONFIG_KEY = ['role-access-config'];

/** Full USER×VIEWER config for the settings screen (OWNER/ADMIN only). */
export function useRoleAccessConfig(enabled: boolean) {
  return useApiQuery<RoleAccessConfig>(ROLE_ACCESS_CONFIG_KEY, '/v1/role-access', {
    enabled,
  });
}

export interface UpdateRoleAccessPayload {
  USER?: SectionAccessMap;
  VIEWER?: SectionAccessMap;
}

export function useUpdateRoleAccess() {
  const invalidateQueries = useInvalidateQueries();

  return useApiMutation<RoleAccessConfig, UpdateRoleAccessPayload>(
    '/v1/role-access',
    'PUT',
    {
      onSuccess: () => {
        invalidateQueries([ROLE_ACCESS_CONFIG_KEY]);
      },
    },
  );
}

/** Permisos concedidos a una persona: `{ 'compras-pedidos': true }`. OWNER/ADMIN. */
export function useUserAccess(userId: string | undefined, enabled: boolean) {
  return useApiQuery<SectionAccessMap>(
    ['role-access-user', userId ?? ''],
    `/v1/role-access/users/${userId}`,
    { enabled: enabled && !!userId },
  );
}

export function useUpdateUserAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, access }: { userId: string; access: SectionAccessMap }) =>
      (await apiClient.put<SectionAccessMap>(`/v1/role-access/users/${userId}`, { access })).data,
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['role-access-user', userId] });
    },
  });
}

/** Listas de compra con las que la persona puede hacer pedidos. OWNER/ADMIN. */
export function useUserPurchaseLists(userId: string | undefined, enabled: boolean) {
  return useApiQuery<{ listIds: string[] }>(
    ['role-access-user-lists', userId ?? ''],
    `/v1/role-access/users/${userId}/purchase-lists`,
    { enabled: enabled && !!userId },
  );
}

export function useUpdateUserPurchaseLists() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, listIds }: { userId: string; listIds: string[] }) =>
      (
        await apiClient.put<{ listIds: string[] }>(`/v1/role-access/users/${userId}/purchase-lists`, {
          listIds,
        })
      ).data,
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['role-access-user-lists', userId] });
    },
  });
}
