'use client';

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
