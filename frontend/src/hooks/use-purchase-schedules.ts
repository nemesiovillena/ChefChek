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

/**
 * Días de la semana en orden L-D. `value` es el índice de Date.getDay()
 * (0=domingo … 6=sábado), el mismo que espera el backend.
 */
export const PURCHASE_SCHEDULE_DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

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

export interface SchedulePurchaseOrderInput {
  orderId: string;
  daysOfWeek: number[];
  timeOfDay: string;
  listName?: string;
}

/**
 * Programa pedidos recurrentes usando un pedido existente como plantilla.
 * El backend crea una lista de compra con sus artículos y una programación
 * sobre ella, así que refrescamos ambas cachés.
 */
export function useSchedulePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation<PurchaseSchedule, Error, SchedulePurchaseOrderInput>({
    mutationFn: async ({ orderId, ...body }) =>
      (await apiClient.post(`/v1/compras/pedidos/${orderId}/programar`, body))
        .data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['purchase-lists'] });
    },
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
