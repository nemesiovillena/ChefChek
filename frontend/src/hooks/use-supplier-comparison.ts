'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export interface OfferComparisonRow {
  offerId: string;
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  purchaseFormat: string | null;
  referenceUnit: string | null;
  referencePrice: number;
  isPreferred: boolean;
  isBestPrice: boolean;
  isActiveForLocation?: boolean;
  agreedPrice: number | null;
}

export function useOfferComparison(productId: string | null, locationId?: string) {
  const params = new URLSearchParams();
  if (productId) params.set('productId', productId);
  if (locationId) params.set('locationId', locationId);

  return useApiQuery<OfferComparisonRow[]>(
    ['offer-comparison', productId ?? '', locationId ?? ''],
    `/v1/compras/comparativa?${params.toString()}`,
    { enabled: !!productId },
  );
}

export function useSetOfferLocationOverride() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { offerId: string; locationId: string; enabled: boolean }>({
    mutationFn: async ({ offerId, locationId, enabled }) => {
      await apiClient.put(`/v1/compras/ofertas/${offerId}/local/${locationId}`, { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offer-comparison'] }),
  });
}
