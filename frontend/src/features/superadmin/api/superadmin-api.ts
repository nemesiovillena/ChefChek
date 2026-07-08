import { apiClient } from '@/lib/api-client';

const BASE = '/v1/superadmin';
const TENANTS = '/v1/tenants';

/** Campos de contacto del cliente (todos opcionales en BD). */
export interface TenantContact {
  contactName?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressPostalCode?: string | null;
  cifNif?: string | null;
}

export interface TenantSummary extends TenantContact {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  isActive: boolean;
  /**
   * No hay columna `plan` en BD; se mantiene opcional para no romper usos
   * previos. Derivar de módulos activos si hace falta mostrarlo.
   */
  plan?: string;
  createdAt: string;
}

export interface TrashedTenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  isActive: boolean;
  deletedAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface TenantDetail extends TenantSummary {
  users?: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt?: string;
  }>;
}

export interface TenantModule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  alwaysActive: boolean;
}

export interface CreateTenantPayload extends Partial<TenantContact> {
  name: string;
  slug: string;
  domain?: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  adminRole?: 'ADMIN' | 'USER' | 'VIEWER';
}

export type UpdateTenantPayload = Partial<
  Pick<TenantSummary, 'name' | 'slug' | 'domain' | 'isActive'>
> &
  Partial<TenantContact>;

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

export async function getTenant(id: string): Promise<TenantDetail> {
  const response = await apiClient.get<TenantDetail>(`${TENANTS}/${id}`);
  return response.data;
}

export async function createTenant(
  payload: CreateTenantPayload,
): Promise<TenantSummary> {
  const response = await apiClient.post<TenantSummary>(TENANTS, payload);
  return response.data;
}

export async function updateTenant(
  id: string,
  payload: UpdateTenantPayload,
): Promise<TenantSummary> {
  const response = await apiClient.patch<TenantSummary>(
    `${BASE}/tenants/${id}`,
    payload,
  );
  return response.data;
}

/** Baja: soft-delete (DELETE /v1/tenants/:id). */
export async function deactivateTenant(id: string): Promise<void> {
  await apiClient.delete(`${TENANTS}/${id}`);
}

export async function listTrashedTenants(): Promise<TrashedTenant[]> {
  const response = await apiClient.get<TrashedTenant[]>(`${BASE}/tenants/trashed`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function restoreTenant(id: string): Promise<void> {
  await apiClient.patch(`${BASE}/tenants/${id}/restore`);
}

/** Borrado definitivo: purga el cliente y todos sus datos (cascade). */
export async function purgeTenant(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/tenants/${id}/purge`);
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
