'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type { PurchaseOrder } from './use-purchase-orders';

export interface PurchaseListItem {
  id: string;
  productId: string;
  defaultQuantity: number;
  sortOrder: number;
  product?: {
    id: string;
    name: string;
    referenceUnit: string;
    purchaseFormat: string;
  };
}

export interface PurchaseList {
  id: string;
  name: string;
  supplierId: string;
  locationId?: string | null;
  supplier?: { id: string; name: string };
  location?: { id: string; name: string } | null;
  items: PurchaseListItem[];
}

export interface PurchaseListItemInput {
  productId: string;
  defaultQuantity?: number;
}

export interface SupplierCatalogProduct {
  id: string;
  name: string;
  referenceUnit?: string;
  purchaseFormat?: string;
}

const BASE_URL = '/v1/compras/listas';
const QUERY_KEY = ['purchase-lists'];

/**
 * Catálogo completo (sin paginar) de artículos de un proveedor — principal o
 * con oferta activa en ProductSupplierOffer. Mismo patrón que el export CSV
 * de Artículos (`?export=true`).
 */
export async function fetchSupplierCatalogProducts(
  supplierId: string,
): Promise<SupplierCatalogProduct[]> {
  const response = await apiClient.get<{ data: SupplierCatalogProduct[] }>('/v1/products', {
    params: { supplier: supplierId, isActive: true, export: 'true' },
  });
  return response.data?.data ?? [];
}

export function usePurchaseLists() {
  return useApiQuery<PurchaseList[]>(QUERY_KEY, BASE_URL);
}

function useInvalidateLists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}

export function useCreatePurchaseList() {
  const invalidate = useInvalidateLists();
  return useMutation<
    PurchaseList,
    Error,
    {
      name: string;
      supplierId: string;
      locationId?: string;
      items?: PurchaseListItemInput[];
    }
  >({
    mutationFn: async (data) => (await apiClient.post(BASE_URL, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdatePurchaseList() {
  const invalidate = useInvalidateLists();
  return useMutation<
    PurchaseList,
    Error,
    {
      id: string;
      data: { name?: string; locationId?: string; items?: PurchaseListItemInput[] };
    }
  >({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE_URL}/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useDeletePurchaseList() {
  const invalidate = useInvalidateLists();
  return useMutation<PurchaseList, Error, string>({
    mutationFn: async (id) => (await apiClient.delete(`${BASE_URL}/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useGenerateOrderFromList() {
  const queryClient = useQueryClient();
  return useMutation<
    PurchaseOrder,
    Error,
    {
      listId: string;
      locationId?: string;
      items?: { productId: string; quantity: number }[];
    }
  >({
    mutationFn: async ({ listId, ...data }) =>
      (await apiClient.post(`${BASE_URL}/${listId}/generar-pedido`, data)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}
