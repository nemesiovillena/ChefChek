'use client';

import { useApiQuery } from './use-api';

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
  supplier: { id: string; name: string } | null;
  albaran: { id: string; internalNumber: string; albaranNumber: string } | null;
}

/** Fetch price history for a product */
export function useProductPriceHistory(productId: string | null, supplierId?: string) {
  const params = new URLSearchParams();
  if (productId) params.set('productId', productId);
  if (supplierId) params.set('supplierId', supplierId);

  return useApiQuery<PriceHistoryEntry[]>(
    ['price-history', productId ?? '', supplierId ?? ''],
    `/v1/products/price-history?${params.toString()}`,
    { enabled: !!productId },
  );
}
