import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

const BASE = '/v1/dashboard';

export type SpendPeriod = 'MONTH' | 'QUARTER' | 'YEAR';

export const SPEND_PERIOD_LABELS: Record<SpendPeriod, string> = {
  MONTH: 'Últimos 30 días',
  QUARTER: 'Últimos 90 días',
  YEAR: 'Últimos 365 días',
};

export interface SupplierSpendRow {
  supplierId: string | null;
  supplierName: string;
  amount: number;
  previousAmount: number;
  changePercent: number | null;
  albaranes: number;
}

export interface SupplierSpend {
  period: SpendPeriod;
  total: number;
  previousTotal: number;
  changePercent: number | null;
  suppliers: SupplierSpendRow[];
}

export interface RecipeMarginRow {
  recipeId: string;
  name: string;
  isDrink: boolean;
  sellingPrice: number;
  costPerPortion: number;
  costPercentage: number;
  overTarget: boolean;
}

export interface RecipeMargins {
  targetCostPercentage: number;
  averageCostPercentage: number | null;
  pricedCount: number;
  withoutPriceCount: number;
  overTargetCount: number;
  recipes: RecipeMarginRow[];
}

export interface DashboardAlert {
  id: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  title: string;
  description: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

/** Gasto por proveedor (importe sin IVA de las líneas de albaranes confirmados) frente al periodo anterior. */
export function useSupplierSpend(period: SpendPeriod, enabled = true) {
  return useQuery<SupplierSpend, Error>({
    queryKey: ['dashboard-interactivo', 'supplier-spend', period],
    enabled,
    queryFn: async () => (await apiClient.get(`${BASE}/supplier-spend`, { params: { period } })).data,
    placeholderData: keepPreviousData,
  });
}

/** Coste de la carta: % de coste de cada receta con PVP frente al objetivo de Configuración. */
export function useRecipeMargins(enabled = true) {
  return useQuery<RecipeMargins, Error>({
    queryKey: ['dashboard-interactivo', 'recipe-margins'],
    enabled,
    queryFn: async () => (await apiClient.get(`${BASE}/recipe-margins`)).data,
  });
}

export function useDashboardAlerts() {
  return useQuery<DashboardAlert[], Error>({
    queryKey: ['dashboard-interactivo', 'alerts'],
    queryFn: async () => (await apiClient.get(`${BASE}/alerts`)).data,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.put(`${BASE}/alerts/${id}/resolve`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-interactivo', 'alerts'] }),
  });
}

const percentFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** «31,4 %»; «sin dato» cuando no hay valor. */
export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? 'sin dato' : `${percentFormat.format(value)} %`;
}

/** «+12,5 %» / «−3 %» para variaciones. */
export function formatChange(value: number | null): string {
  if (value === null) return 'sin periodo anterior';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${percentFormat.format(Math.abs(value))} %`;
}
