'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { fetchRoleAccessConfig, type RoleAccessSection } from '@/features/modules/api/role-access-api';

/**
 * Puestos de trabajo (Cocina, Barra, Sala 2…) gestionados desde Equipo. Son los
 * mismos que las fichas de puesto de SICTED. `access` guarda lo que el puesto
 * oculta: sin clave = lo ve (siempre dentro de lo que permita el rol).
 */
export interface TeamPosition {
  id: string;
  title: string;
  users: { id: string; name: string }[];
  access: Record<string, boolean>;
}

const BASE_URL = '/v1/team/positions';
const POSITIONS_KEY = 'team-positions';

export function useTeamPositions() {
  return useQuery<TeamPosition[], Error>({
    queryKey: [POSITIONS_KEY],
    queryFn: async () => (await apiClient.get(BASE_URL)).data,
  });
}

/** Apartados configurables (los mismos que en Accesos por rol). */
export function useAccessSections() {
  return useQuery<RoleAccessSection[], Error>({
    queryKey: ['role-access-sections'],
    queryFn: async () => (await fetchRoleAccessConfig()).sections,
  });
}

/** Refresca puestos y fichas de Fichar (la ficha muestra el puesto vigente). */
function useInvalidatePositions() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [POSITIONS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ['check-in'] }),
    ]);
}

export function useCreateTeamPosition() {
  const invalidate = useInvalidatePositions();
  return useMutation<unknown, Error, { title: string; copyFromId?: string }>({
    mutationFn: async ({ title, copyFromId }) =>
      (await apiClient.post(BASE_URL, { title, ...(copyFromId ? { copyFromId } : {}) })).data,
    onSuccess: invalidate,
  });
}

export function useRenameTeamPosition() {
  const invalidate = useInvalidatePositions();
  return useMutation<unknown, Error, { id: string; title: string }>({
    mutationFn: async ({ id, title }) => (await apiClient.patch(`${BASE_URL}/${id}`, { title })).data,
    onSuccess: invalidate,
  });
}

export function useArchiveTeamPosition() {
  const invalidate = useInvalidatePositions();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

export function useUpdatePositionAccess() {
  const invalidate = useInvalidatePositions();
  return useMutation<unknown, Error, { id: string; access: Record<string, boolean> }>({
    mutationFn: async ({ id, access }) => (await apiClient.put(`${BASE_URL}/${id}/access`, { access })).data,
    onSuccess: invalidate,
  });
}

export function useSetUserPosition() {
  const invalidate = useInvalidatePositions();
  return useMutation<unknown, Error, { userId: string; positionId: string | null }>({
    mutationFn: async ({ userId, positionId }) =>
      (await apiClient.put(`${BASE_URL}/users/${userId}`, { positionId })).data,
    onSuccess: invalidate,
  });
}
