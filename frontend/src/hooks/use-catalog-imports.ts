'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export type CatalogImportStatus = 'PENDIENTE' | 'APLICADO' | 'DESCARTADO';
export type CatalogLineStatus = 'PROPUESTA' | 'ACEPTADA' | 'RECHAZADA';
export type LineMatchStatus = 'NUEVO' | 'MATCH_ALTO' | 'MATCH_DUDOSO';

export interface CatalogImportLine {
  id: string;
  rawName: string;
  articleNumber: string | null;
  purchaseFormat: string | null;
  unitPrice: number;
  matchedProductId: string | null;
  matchStatus: LineMatchStatus;
  lineStatus: CatalogLineStatus;
  confidence: number;
  matchedProduct: { id: string; name: string; purchaseFormat: string | null } | null;
}

export interface CatalogImportListItem {
  id: string;
  status: CatalogImportStatus;
  aiModel: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  _count: { lines: number };
}

export interface CatalogImport {
  id: string;
  status: CatalogImportStatus;
  aiModel: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  lines: CatalogImportLine[];
}

const BASE_URL = '/v1/compras/catalogos';

export function useCatalogImports() {
  return useApiQuery<CatalogImportListItem[]>(['catalog-imports'], BASE_URL);
}

export function useCatalogImport(id: string | null) {
  return useApiQuery<CatalogImport>(['catalog-imports', id ?? ''], `${BASE_URL}/${id}`, {
    enabled: !!id,
  });
}

export function useCreateCatalogImport() {
  const queryClient = useQueryClient();
  return useMutation<
    CatalogImport,
    Error,
    { supplierId: string; file: File; aiModel: string; aiApiKey: string }
  >({
    mutationFn: async ({ supplierId, file, aiModel, aiApiKey }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplierId', supplierId);
      formData.append('ai_model', aiModel);
      formData.append('ai_api_key', aiApiKey);
      return (await apiClient.post<CatalogImport>(BASE_URL, formData)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog-imports'] }),
  });
}

export function useUpdateCatalogImportLine() {
  const queryClient = useQueryClient();
  return useMutation<
    CatalogImportLine,
    Error,
    {
      catalogImportId: string;
      lineId: string;
      lineStatus: CatalogLineStatus;
      matchedProductId?: string;
    }
  >({
    mutationFn: async ({ catalogImportId, lineId, ...data }) =>
      (
        await apiClient.patch<CatalogImportLine>(
          `${BASE_URL}/${catalogImportId}/lineas/${lineId}`,
          data,
        )
      ).data,
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ['catalog-imports', variables.catalogImportId],
      }),
  });
}

export function useApplyCatalogImport() {
  const queryClient = useQueryClient();
  return useMutation<CatalogImport, Error, string>({
    mutationFn: async (id) => (await apiClient.post<CatalogImport>(`${BASE_URL}/${id}/aplicar`)).data,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-imports'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-imports', id] });
    },
  });
}

export function useDiscardCatalogImport() {
  const queryClient = useQueryClient();
  return useMutation<CatalogImport, Error, string>({
    mutationFn: async (id) =>
      (await apiClient.post<CatalogImport>(`${BASE_URL}/${id}/descartar`)).data,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['catalog-imports'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-imports', id] });
    },
  });
}
