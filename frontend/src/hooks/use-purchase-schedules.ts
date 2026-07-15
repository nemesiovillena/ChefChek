'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export interface PurchaseSchedule {
  id: string;
  supplierId: string;
  listId: string;
  locationId: string | null;
  daysOfWeek: number[];
  timeOfDay: string;
  enabled: boolean;
  lastRunAt: string | null;
  supplier: { id: string; name: string };
  list: { id: string; name: string };
  location: { id: string; name: string } | null;
}

export interface PurchaseScheduleInput {
  supplierId: string;
  listId: string;
  locationId?: string;
  daysOfWeek: number[];
  timeOfDay: string;
  enabled?: boolean;
}

const BASE_URL = '/v1/compras/programaciones';
const QUERY_KEY = ['purchase-schedules'];

export function usePurchaseSchedules() {
  return useApiQuery<PurchaseSchedule[]>(QUERY_KEY, BASE_URL);
}

function useInvalidateSchedules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}

export function useCreatePurchaseSchedule() {
  const invalidate = useInvalidateSchedules();
  return useMutation<PurchaseSchedule, Error, PurchaseScheduleInput>({
    mutationFn: async (data) => (await apiClient.post(BASE_URL, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdatePurchaseSchedule() {
  const invalidate = useInvalidateSchedules();
  return useMutation<
    PurchaseSchedule,
    Error,
    { id: string; data: Partial<PurchaseScheduleInput> }
  >({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE_URL}/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDeletePurchaseSchedule() {
  const invalidate = useInvalidateSchedules();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE_URL}/${id}`);
    },
    onSuccess: invalidate,
  });
}
