'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

const BASE_URL = '/v1/alerts';

export interface AlertItem {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  createdAt: string;
  tenantId: string;
  read: boolean;
}

/** Histórico de alertas de negocio (cambios de precio, etc.) para hidratar la campana de Notificaciones al cargar. */
export function useAlerts(limit = 50) {
  const queryClient = useQueryClient();

  const query = useApiQuery<AlertItem[]>(['alerts', String(limit)], `${BASE_URL}?limit=${limit}`);

  const markAsReadMutation = useMutation<AlertItem, Error, string>({
    mutationFn: async (id) => (await apiClient.patch<AlertItem>(`${BASE_URL}/${id}/read`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    markAsRead: markAsReadMutation.mutateAsync,
  };
}
