'use client';

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import apiClient from '@/lib/api-client';
import { useApiQuery, useInvalidateQueries } from '@/hooks/use-api';
import type { ApiError } from '@/types/api.types';

export type TrashType =
  | 'product'
  | 'recipe'
  | 'albaran'
  | 'category'
  | 'supplier'
  | 'user'
  | 'sprint'
  | 'task'
  | 'warehouse';

export interface TrashItem {
  id: string;
  type: TrashType;
  label: string;
  secondary?: string | null;
  deletedAt: string;
}

/** Query key canónica de cada entidad, para que al recuperar/purgar se
 *  refresque también el listado de su módulo. */
const CANONICAL_KEY: Record<TrashType, string[]> = {
  product: ['products'],
  recipe: ['recipes'],
  albaran: ['albaranes'],
  category: ['categories'],
  supplier: ['suppliers'],
  user: ['users'],
  sprint: ['sprints'],
  task: ['tasks'],
  warehouse: ['warehouses'],
};

/** Mensaje legible de un error axios (los 409/400 del backend vienen aquí). */
export function trashErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/** Lista los elementos en papelera de un tipo. */
export function useTrashedItems(type: TrashType) {
  return useApiQuery<TrashItem[]>(['trash', type], `/v1/trash?type=${type}`);
}

/** Recupera un elemento (deletedAt → null). */
export function useRestoreItem() {
  const invalidate = useInvalidateQueries();
  return useMutation({
    mutationFn: async ({ type, id }: { type: TrashType; id: string }) => {
      const res = await apiClient.patch(`/v1/trash/${type}/${id}/restore`);
      return res.data;
    },
    onSuccess: (_data, { type }) => {
      invalidate([['trash', type], CANONICAL_KEY[type]]);
    },
  });
}

/** Borra definitivamente (hard-delete guardado en backend). */
export function usePurgeItem() {
  const invalidate = useInvalidateQueries();
  return useMutation({
    mutationFn: async ({ type, id }: { type: TrashType; id: string }) => {
      await apiClient.delete(`/v1/trash/${type}/${id}`);
    },
    onSuccess: (_data, { type }) => {
      invalidate([['trash', type], CANONICAL_KEY[type]]);
    },
  });
}
