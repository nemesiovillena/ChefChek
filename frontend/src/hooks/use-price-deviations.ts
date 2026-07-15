'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export type PriceDeviationStatus = 'PENDIENTE' | 'RECLAMADA' | 'RESUELTA';

export interface PriceDeviation {
  id: string;
  agreedPrice: number;
  receivedPrice: number;
  deviationPercent: number;
  status: PriceDeviationStatus;
  note: string | null;
  createdAt: string;
  offer: {
    id: string;
    agreedPrice: number | null;
    product: { id: string; name: string };
    supplier: { id: string; name: string };
  };
  albaran: { id: string; internalNumber: string; albaranNumber: string | null } | null;
  purchaseOrder: { id: string; orderNumber: string } | null;
}

export interface PriceDeviationsFilters {
  supplierId?: string;
  status?: PriceDeviationStatus | '';
  dateFrom?: string;
  dateTo?: string;
}

const BASE_URL = '/v1/compras/desviaciones';

export function usePriceDeviations(filters: PriceDeviationsFilters) {
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v != null),
  ) as Record<string, string>;
  return useApiQuery<PriceDeviation[]>(
    ['price-deviations', JSON.stringify(clean)],
    `${BASE_URL}?${new URLSearchParams(clean).toString()}`,
  );
}

export function useUpdatePriceDeviation() {
  const queryClient = useQueryClient();
  return useMutation<
    PriceDeviation,
    Error,
    { id: string; status: PriceDeviationStatus; note?: string }
  >({
    mutationFn: async ({ id, ...data }) =>
      (await apiClient.patch(`${BASE_URL}/${id}`, data)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['price-deviations'] }),
  });
}

export function usePriceTolerance() {
  return useQuery<{ tolerancePercent: number }, Error>({
    queryKey: ['price-tolerance'],
    queryFn: async () => (await apiClient.get('/v1/compras/tolerancia')).data,
  });
}

export function useSetPriceTolerance() {
  const queryClient = useQueryClient();
  return useMutation<{ tolerancePercent: number }, Error, number>({
    mutationFn: async (tolerancePercent) =>
      (await apiClient.put('/v1/compras/tolerancia', { tolerancePercent })).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['price-tolerance'] }),
  });
}
