'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CuinerAlbaranExport,
  CuinerCatalogHit,
  CuinerDishRow,
  CuinerDishTipo,
  CuinerExportPreview,
  CuinerPage,
  CuinerProductRow,
  CuinerSalesPreview,
  CuinerStatus,
  CuinerSupplierRow,
  UpdateCuinerConfigInput,
} from '@/lib/cuiner-types';

const BASE_URL = '/v1/cuiner';
const ROOT_KEY = 'cuiner';

const keys = {
  status: [ROOT_KEY, 'status'] as const,
  suppliers: [ROOT_KEY, 'suppliers'] as const,
  products: (q: object) => [ROOT_KEY, 'products', q] as const,
  dishes: (q: object) => [ROOT_KEY, 'dishes', q] as const,
  exports: [ROOT_KEY, 'exports'] as const,
  salesPreview: [ROOT_KEY, 'sales-preview'] as const,
  albaran: (albaranId: string) => [ROOT_KEY, 'albaran', albaranId] as const,
};

// ─── Configuración ──────────────────────────────────────────────────────────

export function useCuinerStatus(enabled = true) {
  return useQuery<CuinerStatus, Error>({
    queryKey: keys.status,
    queryFn: async () => (await apiClient.get(`${BASE_URL}/config`)).data,
    enabled,
  });
}

export function useUpdateCuinerConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCuinerConfigInput) =>
      (await apiClient.put(`${BASE_URL}/config`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.status }),
  });
}

export function useRegenerateCuinerToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ token: string }> =>
      (await apiClient.post(`${BASE_URL}/config/connector-token`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.status }),
  });
}

// ─── Enlaces ────────────────────────────────────────────────────────────────

export function useCuinerSuppliers() {
  return useQuery<CuinerSupplierRow[], Error>({
    queryKey: keys.suppliers,
    queryFn: async () => (await apiClient.get(`${BASE_URL}/overview/suppliers`)).data,
  });
}

export interface CuinerListQuery {
  search: string;
  onlyUnmapped: boolean;
  page: number;
}

export function useCuinerProducts(query: CuinerListQuery) {
  return useQuery<CuinerPage<CuinerProductRow>, Error>({
    queryKey: keys.products(query),
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/overview/products`, { params: query })).data,
    placeholderData: keepPreviousData,
  });
}

export function useCuinerDishes(query: CuinerListQuery & { tipo: CuinerDishTipo }) {
  return useQuery<CuinerPage<CuinerDishRow>, Error>({
    queryKey: keys.dishes(query),
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/overview/dishes`, { params: query })).data,
    placeholderData: keepPreviousData,
  });
}

export async function searchCuinerCatalog(
  kind: 'supplier' | 'article',
  q: string,
): Promise<CuinerCatalogHit[]> {
  return (await apiClient.get(`${BASE_URL}/catalog/search`, { params: { kind, q } })).data;
}

/** Tras cambiar un enlace se refrescan las vistas que lo muestran. */
function useInvalidateMaps() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [ROOT_KEY] });
}

export function useSetCuinerSupplierMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async (input: { supplierId: string; codigo: string }) =>
      (await apiClient.put(`${BASE_URL}/maps/suppliers`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCuinerSupplierMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async (supplierId: string) =>
      (await apiClient.delete(`${BASE_URL}/maps/suppliers/${supplierId}`)).data,
    onSuccess: invalidate,
  });
}

export function useSetCuinerProductMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async (input: { productId: string; articulo: string }) =>
      (await apiClient.put(`${BASE_URL}/maps/products`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCuinerProductMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async (productId: string) =>
      (await apiClient.delete(`${BASE_URL}/maps/products/${productId}`)).data,
    onSuccess: invalidate,
  });
}

export function useSetCuinerDishMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async (input: {
      tipo: CuinerDishTipo;
      producto: string;
      recipeId?: string | null;
      productId?: string | null;
    }) => (await apiClient.put(`${BASE_URL}/maps/dishes`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCuinerDishMap() {
  const invalidate = useInvalidateMaps();
  return useMutation({
    mutationFn: async ({ tipo, producto }: { tipo: CuinerDishTipo; producto: string }) =>
      (await apiClient.delete(`${BASE_URL}/maps/dishes/${tipo}/${producto}`)).data,
    onSuccess: invalidate,
  });
}

// ─── Envío de albaranes ─────────────────────────────────────────────────────

export function useCuinerExports() {
  return useQuery<CuinerAlbaranExport[], Error>({
    queryKey: keys.exports,
    queryFn: async () => (await apiClient.get(`${BASE_URL}/exports`)).data,
  });
}

export function useCuinerAlbaranExport(albaranId: string, enabled: boolean) {
  return useQuery<{ preview: CuinerExportPreview; export: CuinerAlbaranExport | null }, Error>({
    queryKey: keys.albaran(albaranId),
    queryFn: async () => {
      const [preview, existing] = await Promise.all([
        apiClient.get(`${BASE_URL}/albaranes/${albaranId}/preview`),
        apiClient.get(`${BASE_URL}/albaranes/${albaranId}/export`),
      ]);
      return { preview: preview.data, export: existing.data || null };
    },
    enabled,
  });
}

export function useSendAlbaranToCuiner(albaranId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<CuinerAlbaranExport> =>
      (await apiClient.post(`${BASE_URL}/albaranes/${albaranId}/send`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.albaran(albaranId) });
      qc.invalidateQueries({ queryKey: keys.exports });
    },
  });
}

// ─── Ventas → stock ─────────────────────────────────────────────────────────

export function useCuinerSalesPreview() {
  return useQuery<CuinerSalesPreview, Error>({
    queryKey: keys.salesPreview,
    queryFn: async () => (await apiClient.get(`${BASE_URL}/sales/preview`)).data,
  });
}

export function useApplyCuinerSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ applied: number; unmapped: number; movements: number }> =>
      (await apiClient.post(`${BASE_URL}/sales/apply`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROOT_KEY] }),
  });
}

export function useRequeueCuinerSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ requeued: number }> =>
      (await apiClient.post(`${BASE_URL}/sales/requeue-unmapped`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROOT_KEY] }),
  });
}
