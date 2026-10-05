'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type {
  CheckInReadiness,
  CheckInSettings,
  CheckInSettingsResponse,
  Employee,
  EmployeeInput,
  LegalTextKind,
  LegalTextState,
  LegalTextVersion,
  LinkableUser,
  WorkCenter,
  WorkCenterGeofenceInput,
} from '@/lib/check-in-types';

const BASE = '/v1/check-in';

const KEYS = {
  employees: ['check-in', 'employees'],
  linkableUsers: ['check-in', 'linkable-users'],
  settings: ['check-in', 'settings'],
  workCenters: ['check-in', 'work-centers'],
  legalTexts: ['check-in', 'legal-texts'],
  readiness: ['check-in', 'readiness'],
};

// El interceptor de apiClient desenvuelve { success, data }: `.data` ya es la entidad.

// ─────────────────────────────────────────────────────────── Empleados

export function useEmployees(includeInactive: boolean) {
  return useApiQuery<Employee[]>(
    [...KEYS.employees, includeInactive ? 'all' : 'active'],
    `${BASE}/employees?includeInactive=${includeInactive}`,
  );
}

export function useLinkableUsers() {
  return useApiQuery<LinkableUser[]>(KEYS.linkableUsers, `${BASE}/employees/linkable-users`);
}

function useInvalidateEmployees() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.employees });
    qc.invalidateQueries({ queryKey: KEYS.linkableUsers });
  };
}

export function useCreateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation<Employee, Error, EmployeeInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/employees`, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateEmployee() {
  const invalidate = useInvalidateEmployees();
  return useMutation<Employee, Error, { id: string; data: Partial<EmployeeInput> }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE}/employees/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useSetEmployeePin() {
  const invalidate = useInvalidateEmployees();
  return useMutation<void, Error, { id: string; pin: string }>({
    mutationFn: async ({ id, pin }) => {
      await apiClient.put(`${BASE}/employees/${id}/pin`, { pin });
    },
    onSuccess: invalidate,
  });
}

export function useClearEmployeePin() {
  const invalidate = useInvalidateEmployees();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/employees/${id}/pin`);
    },
    onSuccess: invalidate,
  });
}

// ──────────────────────────────────────────────────── Convenio y jornada

export function useCheckInSettings() {
  return useApiQuery<CheckInSettingsResponse>(KEYS.settings, `${BASE}/settings`);
}

export function useUpdateCheckInSettings() {
  const qc = useQueryClient();
  return useMutation<CheckInSettings, Error, Partial<CheckInSettings>>({
    mutationFn: async (data) => (await apiClient.patch(`${BASE}/settings`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.settings }),
  });
}

export function useApplyAgreementPreset() {
  const qc = useQueryClient();
  return useMutation<CheckInSettings, Error, string>({
    mutationFn: async (agreementKey) =>
      (await apiClient.post(`${BASE}/settings/agreement`, { agreementKey })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.settings }),
  });
}

// ──────────────────────────────────────────────────── Centros de trabajo

export function useWorkCenters() {
  return useApiQuery<WorkCenter[]>(KEYS.workCenters, `${BASE}/work-centers`);
}

export function useCreateWorkCenter() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { name: string; address?: string }>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/work-centers`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

export function useUpdateWorkCenter() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { id: string; data: { name?: string; address?: string; isActive?: boolean } }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE}/work-centers/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

export function useUpdateWorkCenterGeofence() {
  const qc = useQueryClient();
  return useMutation<WorkCenter, Error, { id: string; data: WorkCenterGeofenceInput }>({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE}/work-centers/${id}/geofence`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.workCenters }),
  });
}

// ──────────────────────────────────────────────────────── Textos legales

export function useLegalTexts() {
  return useApiQuery<LegalTextState[]>(KEYS.legalTexts, `${BASE}/legal-texts`);
}

function useInvalidateLegalTexts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.legalTexts });
    qc.invalidateQueries({ queryKey: KEYS.readiness });
  };
}

export function useSaveLegalText() {
  const invalidate = useInvalidateLegalTexts();
  return useMutation<LegalTextVersion, Error, { kind: LegalTextKind; content: string }>({
    mutationFn: async ({ kind, content }) =>
      (await apiClient.put(`${BASE}/legal-texts/${kind}`, { content })).data,
    onSuccess: invalidate,
  });
}

export function useValidateLegalText() {
  const invalidate = useInvalidateLegalTexts();
  return useMutation<LegalTextVersion, Error, LegalTextKind>({
    mutationFn: async (kind) => (await apiClient.post(`${BASE}/legal-texts/${kind}/validate`)).data,
    onSuccess: invalidate,
  });
}

/** ¿Están validados los textos legales? Sin eso no se puede fichar. */
export function useCheckInReadiness() {
  return useApiQuery<CheckInReadiness>(KEYS.readiness, `${BASE}/readiness`);
}
