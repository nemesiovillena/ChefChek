'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

/** Local del tenant (multi-local). Ver docs/pdr-modulo-compras.md §F10. */
export interface TenantLocation {
  id: string;
  name: string;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = '/v1/compras/locales';
const QUERY_KEY = ['compras-locales'];

export function useLocations() {
  // El interceptor de apiClient desenvuelve { success, data } → array directo
  return useApiQuery<TenantLocation[]>(QUERY_KEY, BASE_URL);
}

export interface LocationInput {
  name: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation<TenantLocation, Error, LocationInput>({
    mutationFn: async (data) => (await apiClient.post(BASE_URL, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation<
    TenantLocation,
    Error,
    { id: string; data: Partial<LocationInput> }
  >({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE_URL}/${id}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation<TenantLocation, Error, string>({
    // Construir la URL con el id a mano: la rama DELETE de useApiMutation
    // descarta las variables (bug conocido con useDeleteBackup)
    mutationFn: async (id) =>
      (await apiClient.delete(`${BASE_URL}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
