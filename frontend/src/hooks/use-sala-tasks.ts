import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export type SalaTaskStatus = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO';

export interface SalaTask {
  id: string;
  title: string;
  eventDate: string;
  guestCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  menuNotes: string | null;
  observations: string | null;
  allergies: string | null;
  status: SalaTaskStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalaTaskInput {
  title: string;
  eventDate: string;
  guestCount?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  menuNotes?: string | null;
  observations?: string | null;
  allergies?: string | null;
  status?: SalaTaskStatus;
}

const QUERY_KEY = ['sala-tasks'];

// Orden por cercanía a hoy: primero los eventos de hoy en adelante (el más
// próximo arriba) y después los ya pasados (el más reciente arriba), para que
// un evento antiguo sin cerrar no tape lo que viene. Empates por orden de
// creación. Rige en la card del dashboard y en las columnas del Kanban.
export function compareSalaTasksByEventDate(a: SalaTask, b: SalaTask): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const aTime = new Date(a.eventDate).getTime();
  const bTime = new Date(b.eventDate).getTime();
  const aPast = aTime < today;
  const bPast = bTime < today;

  if (aPast !== bPast) return aPast ? 1 : -1;
  const byDate = aPast ? bTime - aTime : aTime - bTime;
  return byDate !== 0
    ? byDate
    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function useSalaTasks(enabled: boolean = true) {
  return useApiQuery<SalaTask[]>(QUERY_KEY, '/v1/sala-tasks', { enabled });
}

export function useCreateSalaTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SalaTaskInput) => {
      const response = await apiClient.post<SalaTask>('/v1/sala-tasks', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateSalaTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: SalaTaskInput & { id: string }) => {
      const response = await apiClient.patch<SalaTask>(`/v1/sala-tasks/${id}`, input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteSalaTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/v1/sala-tasks/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useReorderSalaTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; status: SalaTaskStatus; sortOrder: number }[]) => {
      const response = await apiClient.patch('/v1/sala-tasks/reorder', { items });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
