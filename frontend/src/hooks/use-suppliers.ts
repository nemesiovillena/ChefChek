import { useApiQuery } from './use-api';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  isActive: boolean;
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: string;
  preferredStatus: string;
  orderMethods: string[];
}

export function useSuppliers(options?: { isActive?: boolean }) {
  const params = new URLSearchParams();
  if (options?.isActive !== undefined) {
    params.append('isActive', String(options.isActive));
  }
  const query = params.toString();
  const key = query ? `suppliers?${query}` : 'suppliers';

  return useApiQuery<Supplier[]>(
    [key],
    `/v1/products/suppliers${query ? `?${query}` : ''}`,
  );
}

export function useSuppliersStats() {
  return useApiQuery<{ count: number }>(
    ['suppliers', 'stats'],
    '/v1/products/suppliers/stats/active-count',
  );
}

export function useSupplierPriceTrend(supplierId: string) {
  return useApiQuery<any>(
    ['supplier-price-trend', supplierId],
    `/v1/products/suppliers/${supplierId}/price-trend`,
    { enabled: !!supplierId },
  );
}

export interface SupplierPriceHistoryEntry {
  id: string;
  averagePrice: number;
  recordDate: string;
}

export function useSupplierPriceHistory(supplierId: string, limit: number = 30) {
  return useApiQuery<SupplierPriceHistoryEntry[]>(
    ['supplier-price-history', supplierId],
    `/v1/products/suppliers/${supplierId}/price-history?limit=${limit}`,
    { enabled: !!supplierId },
  );
}
