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

/**
 * Fila del listado GET /programaciones: la programación + el estado HOY
 * que calcula el backend. Las mutaciones (create/update) devuelven la
 * entidad cruda, sin estos campos — por eso el tipo va separado.
 */
export interface PurchaseScheduleWithStatus extends PurchaseSchedule {
  /** Estado HOY calculado server-side (Europe/Madrid, consciente de lastRunAt). */
  nextRunAt: { dateKey: string; timeOfDay: string } | null;
  runsToday: boolean;
  ranToday: boolean;
  /** BORRADOR generado por el cron de esta programación, aún sin enviar. */
  pendingDraft: {
    orderId: string;
    generatedAt: string;
    /** El draft se generó hoy (día del draft, no lastRunAt). */
    generatedToday: boolean;
  } | null;
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
  return useApiQuery<PurchaseScheduleWithStatus[]>(QUERY_KEY, BASE_URL);
}

function useInvalidateSchedules() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    // El dashboard anuncia la próxima programación en la card de pedidos;
    // crear una desde un pedido también materializa una lista de compra.
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-lists'] });
  };
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
 * sobre ella.
 */
export function useSchedulePurchaseOrder() {
  const invalidate = useInvalidateSchedules();
  return useMutation<PurchaseSchedule, Error, SchedulePurchaseOrderInput>({
    mutationFn: async ({ orderId, ...body }) =>
      (await apiClient.post(`/v1/compras/pedidos/${orderId}/programar`, body))
        .data,
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
