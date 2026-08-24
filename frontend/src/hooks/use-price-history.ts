'use client';

import { usePaginatedQuery } from './use-api';

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  supplierId: string | null;
  albaranId: string | null;
  previousPrice: number;
  newPrice: number;
  previousUnitSize: number | null;
  newUnitSize: number | null;
  recordedAt: string;
  product: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  albaran: { id: string; internalNumber: string; albaranNumber: string } | null;
}

interface AllPriceHistoryFilters {
  productId?: string;
  supplierId?: string;
}

/** Historial de precios de todo el tenant (página global, no por artículo). */
export function useAllPriceHistory(page: number, limit: number, filters?: AllPriceHistoryFilters) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters?.productId) params.set('productId', filters.productId);
  if (filters?.supplierId) params.set('supplierId', filters.supplierId);

  return usePaginatedQuery<PriceHistoryEntry>(
    ['price-history-all', String(page), String(limit), filters?.productId ?? '', filters?.supplierId ?? ''],
    `/v1/products/price-history/all?${params.toString()}`,
    page,
    limit,
  );
}
