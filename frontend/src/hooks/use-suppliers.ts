import { useApiQuery } from './use-api';
import { PaginatedResponse } from '@/types/api.types';

export interface Supplier {
  id: string;
  name: string;
  cifNif?: string;
  address?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  sanitaryRegistry?: string;
  iban?: string;
  paymentTerms?: string;
  notes?: string;
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
  // La queryKey debe empezar por 'suppliers' como elemento propio del array:
  // invalidateQueries({queryKey:['suppliers']}) hace match por prefijo elemento
  // a elemento, no por substring, así que 'suppliers?isActive=true' como string
  // único nunca coincidía y el filtro quedaba sin refrescar tras crear/editar.
  const key = query ? ['suppliers', query] : ['suppliers'];

  return useApiQuery<Supplier[]>(
    key,
    `/v1/products/suppliers${query ? `?${query}` : ''}`,
  );
}

export function useSuppliersStats() {
  return useApiQuery<{ count: number }>(
    ['suppliers', 'stats'],
    '/v1/products/suppliers/stats/active-count',
  );
}

export interface SupplierPriceTrend {
  status: 'increased' | 'decreased' | 'stable';
  percentage: number;
  lastPrice: number;
  currentPrice: number;
}

export function useSupplierPriceTrend(supplierId: string) {
  return useApiQuery<SupplierPriceTrend>(
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

export interface SupplierProduct {
  id: string;
  name: string;
  category?: { id: string; name: string } | null;
}

export function useSupplierProducts(supplierId: string, page: number = 1, limit: number = 20) {
  return useApiQuery<PaginatedResponse<SupplierProduct>>(
    ['supplier-products', supplierId, String(page), String(limit)],
    `/v1/products/suppliers/${supplierId}/products?page=${page}&limit=${limit}`,
    { enabled: !!supplierId },
  );
}
