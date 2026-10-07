'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type {
  Absence,
  AbsenceInput,
  AbsenceType,
  AbsenceTypeInput,
  Holiday,
  LeaveBalance,
  LeaveBalanceInput,
} from '@/lib/turnos-types';

const BASE = '/v1/turnos';
const ROOT = ['turnos'];

// El interceptor de apiClient desenvuelve { success, data }: `.data` ya es la entidad.

/** Cualquier cambio en ausencias, saldos, tipos o festivos afecta a varias vistas. */
function useInvalidateTurnos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROOT });
}

export function useAbsenceTypes(includeInactive = false) {
  return useApiQuery<AbsenceType[]>(
    [...ROOT, 'types', includeInactive ? 'all' : 'active'],
    `${BASE}/absence-types${includeInactive ? '?all=true' : ''}`,
  );
}

export function useHolidays(year: number) {
  return useApiQuery<Holiday[]>([...ROOT, 'holidays', String(year)], `${BASE}/holidays?year=${year}`);
}

// ───────────────────────────────────────────────────────────────── Lo mío

export function useOwnAbsences(year: number, enabled = true) {
  return useApiQuery<Absence[]>([...ROOT, 'me', 'absences', String(year)], `${BASE}/me/absences?year=${year}`, {
    enabled,
  });
}

export function useOwnBalance(year: number, enabled = true) {
  return useApiQuery<LeaveBalance>([...ROOT, 'me', 'balance', String(year)], `${BASE}/me/balance?year=${year}`, {
    enabled,
    retry: false,
  });
}

export function useRequestAbsence() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Absence, Error, AbsenceInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/me/absences`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCancelOwnAbsence() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Absence, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE}/me/absences/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
}

// ─────────────────────────────────────────────────────────────── Gerencia

/** Ausencias activas del equipo que pisan un rango (calendario). */
export function useTeamAbsences(from: string, to: string) {
  return useApiQuery<Absence[]>([...ROOT, 'team', from, to], `${BASE}/absences?from=${from}&to=${to}`);
}

export function usePendingAbsences(enabled = true) {
  return useApiQuery<Absence[]>([...ROOT, 'pending'], `${BASE}/absences/pending`, {
    enabled,
    refetchInterval: 60_000,
  });
}

/** Ausencia registrada por gerencia (p. ej. una baja): queda aprobada. */
export function useCreateAbsence() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Absence, Error, AbsenceInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/absences`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDecideAbsence() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Absence, Error, { id: string; approve: boolean; note?: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE}/absences/${id}/decision`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCancelAbsence() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Absence, Error, { id: string; note?: string }>({
    mutationFn: async ({ id, note }) => (await apiClient.post(`${BASE}/absences/${id}/cancel`, { note })).data,
    onSuccess: invalidate,
  });
}

export function useBalances(year: number) {
  return useApiQuery<LeaveBalance[]>([...ROOT, 'balances', String(year)], `${BASE}/balances?year=${year}`);
}

export function useSaveBalance() {
  const invalidate = useInvalidateTurnos();
  return useMutation<LeaveBalance, Error, { employeeId: string; year: number; data: LeaveBalanceInput }>({
    mutationFn: async ({ employeeId, year, data }) =>
      (await apiClient.put(`${BASE}/balances/${employeeId}/${year}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useSaveAbsenceType() {
  const invalidate = useInvalidateTurnos();
  return useMutation<AbsenceType, Error, { id?: string; data: AbsenceTypeInput }>({
    mutationFn: async ({ id, data }) =>
      id
        ? (await apiClient.patch(`${BASE}/absence-types/${id}`, data)).data
        : (await apiClient.post(`${BASE}/absence-types`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCreateHoliday() {
  const invalidate = useInvalidateTurnos();
  return useMutation<Holiday, Error, { date: string; name: string }>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/holidays`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteHoliday() {
  const invalidate = useInvalidateTurnos();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/holidays/${id}`);
    },
    onSuccess: invalidate,
  });
}
