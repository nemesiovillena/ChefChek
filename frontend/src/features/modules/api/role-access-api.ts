/**
 * API client for per-role, per-tenant section visibility (role-access).
 *
 * Layered on top of the module system: a section may be hidden for USER/VIEWER
 * even when its module is enabled for the tenant. ADMIN+ always get an empty
 * map from `/me` (everything allowed).
 */

import { apiClient } from '@/lib/api-client';

const BASE_URL = '/v1/role-access';

/** Flat `{ 'recipes': true, 'recipes.cost': false, ... }` for the current user. */
export type SectionAccessMap = Record<string, boolean>;

export interface RoleAccessSection {
  key: string;
  label: string;
  parent?: string;
  moduleId?: string;
}

export interface RoleAccessConfig {
  sections: RoleAccessSection[];
  USER: SectionAccessMap;
  VIEWER: SectionAccessMap;
}

/** Effective section map for the authenticated user (empty ⇒ all allowed). */
export async function fetchMySectionAccess(): Promise<SectionAccessMap> {
  const response = await apiClient.get<SectionAccessMap>(`${BASE_URL}/me`);
  return response.data ?? {};
}

/** Full config for the settings screen (OWNER/ADMIN only). */
export async function fetchRoleAccessConfig(): Promise<RoleAccessConfig> {
  const response = await apiClient.get<RoleAccessConfig>(BASE_URL);
  return response.data;
}

/** Persist role-access changes (OWNER/ADMIN only). */
export async function saveRoleAccess(payload: {
  USER?: SectionAccessMap;
  VIEWER?: SectionAccessMap;
}): Promise<RoleAccessConfig> {
  const response = await apiClient.put<RoleAccessConfig>(BASE_URL, payload);
  return response.data;
}
