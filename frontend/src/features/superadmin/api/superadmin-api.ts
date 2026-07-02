import { apiClient } from '@/lib/api-client';

const BASE = '/v1/superadmin';

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: string;
  createdAt: string;
}

export interface TenantModule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  alwaysActive: boolean;
}

export async function listTenants(page = 1, limit = 20) {
  const response = await apiClient.get(`${BASE}/tenants`, {
    params: { page, limit },
  });
  // The global api-client interceptor unwraps paginated responses
  // ({ success, data, meta }) into { data: [...], total, ... }; extract the
  // tenant array so consumers always receive TenantSummary[].
  const payload = response.data as
    | TenantSummary[]
    | { data?: TenantSummary[] };
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

export async function getTenantModules(tenantId: string) {
  const response = await apiClient.get<TenantModule[]>(`${BASE}/tenants/${tenantId}/modules`);
  return response.data;
}

export async function toggleTenantModule(tenantId: string, moduleId: string, enabled: boolean) {
  const response = await apiClient.patch<TenantModule>(
    `${BASE}/tenants/${tenantId}/modules/${moduleId}`,
    { enabled },
  );
  return response.data;
}
