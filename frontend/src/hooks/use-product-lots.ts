'use client';

import { useApiQuery } from './use-api';

export interface ProductLotEntry {
  productName: string;
  lotNumber: string;
  supplierName: string | null;
  albaranNumber: string | null;
  albaranInternalNumber: string | null;
  albaranDate: string | null;
  quantity: number;
  unit: string | null;
  expiryDate: string | null;
  source: 'lot_record' | 'raw_line';
}

/** Fetch received lot history for a product. */
export function useProductLots(productId: string | null) {
  return useApiQuery<ProductLotEntry[]>(
    ['product-lots', productId ?? ''],
    `/v1/products/${productId}/lots`,
    { enabled: !!productId },
  );
}
