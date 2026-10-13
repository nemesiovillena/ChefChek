'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type { EmployeeRequest, EmployeeRequestInput, OwnProfile, OwnRequestItem } from '@/lib/rrhh-types';

const BASE = '/v1/rrhh';
const ROOT = ['rrhh'];

// El interceptor de apiClient desenvuelve { success, data }: `.data` ya es la entidad.

function useInvalidateRrhh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROOT });
}

/** Mis datos. Falla (403) si la cuenta no tiene ficha de empleado. */
export function useOwnProfile(enabled = true) {
  return useApiQuery<OwnProfile>([...ROOT, 'me', 'profile'], `${BASE}/me/profile`, { enabled, retry: false });
}

/** Todas mis solicitudes: cambios de datos, correcciones de fichaje y ausencias. */
export function useOwnRequests(enabled = true) {
  return useApiQuery<OwnRequestItem[]>([...ROOT, 'me', 'requests'], `${BASE}/me/requests`, { enabled, retry: false });
}

export function useCreateOwnRequest() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeRequest, Error, EmployeeRequestInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/me/requests`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCancelOwnRequest() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeRequest, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE}/me/requests/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
}

/** Bandeja de gerencia: cambios de datos y peticiones libres pendientes. */
export function usePendingEmployeeRequests(enabled = true) {
  return useApiQuery<EmployeeRequest[]>([...ROOT, 'requests', 'pending'], `${BASE}/requests`, { enabled });
}

export function useDecideEmployeeRequest() {
  const qc = useQueryClient();
  return useMutation<EmployeeRequest, Error, { id: string; approve: boolean; note?: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE}/requests/${id}/decision`, data)).data,
    // Un cambio aprobado toca la cuenta de Equipo y la ficha de Fichar.
    onSuccess: () =>
      Promise.all([ROOT, ['check-in'], ['users']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}
