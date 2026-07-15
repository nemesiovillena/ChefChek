'use client';

import { useApiQuery } from './use-api';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
  locationId?: string;
}

export interface TopSpendRow {
  productId: string;
  productName: string;
  spend: number;
  percent: number;
  cumulativePercent: number;
}

export interface SupplierSpendRow {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalAmount: number;
  averageTicket: number;
  averageLeadTimeDays: number | null;
}

export interface DeviationPeriodRow {
  period: string;
  count: number;
  averageDeviationPercent: number;
}

export interface PriceComparisonPoint {
  supplierId: string;
  supplierName: string;
  recordedAt: string;
  price: number;
}

function toParams(filters: AnalyticsFilters & { productId?: string }): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useTopSpend(filters: AnalyticsFilters) {
  return useApiQuery<TopSpendRow[]>(
    ['purchase-analytics', 'top-gasto', JSON.stringify(filters)],
    `/v1/compras/analitica/top-gasto${toParams(filters)}`,
  );
}

export function useSpendBySupplier(filters: AnalyticsFilters) {
  return useApiQuery<SupplierSpendRow[]>(
    ['purchase-analytics', 'por-proveedor', JSON.stringify(filters)],
    `/v1/compras/analitica/por-proveedor${toParams(filters)}`,
  );
}

export function useDeviationsOverTime(filters: AnalyticsFilters) {
  return useApiQuery<DeviationPeriodRow[]>(
    ['purchase-analytics', 'desviaciones', JSON.stringify(filters)],
    `/v1/compras/analitica/desviaciones${toParams(filters)}`,
  );
}

export function usePriceComparison(productId: string | null, filters: AnalyticsFilters) {
  return useApiQuery<PriceComparisonPoint[]>(
    ['purchase-analytics', 'comparativa', productId ?? '', JSON.stringify(filters)],
    `/v1/compras/analitica/comparativa${toParams({ ...filters, productId: productId ?? undefined })}`,
    { enabled: !!productId },
  );
}
