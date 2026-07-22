'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export type CatalogImportStatus = 'PROCESANDO' | 'PENDIENTE' | 'APLICADO' | 'DESCARTADO' | 'ERROR';
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
  matchedProduct: {
    id: string;
    name: string;
    purchaseFormat: string | null;
    purchasePrice: number;
    unitSize: number;
    referenceUnit: string;
  } | null;
}

export interface CatalogImportListItem {
  id: string;
  status: CatalogImportStatus;
  aiModel: string | null;
  errorMessage: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  _count: { lines: number };
}

export interface CatalogImport {
  id: string;
  status: CatalogImportStatus;
  aiModel: string | null;
  errorMessage: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  lines: CatalogImportLine[];
}

const BASE_URL = '/v1/compras/catalogos';

/** Catálogos grandes tardan minutos en background: refresca la lista sola
 * mientras alguno siga en PROCESANDO, para que el badge de estado se ponga
 * al día sin recargar la página. */
export function useCatalogImports() {
  return useApiQuery<CatalogImportListItem[]>(['catalog-imports'], BASE_URL, {
    refetchInterval: (query) =>
      query.state.data?.some((imp) => imp.status === 'PROCESANDO') ? 4000 : false,
  });
}

export function useCatalogImport(id: string | null) {
  return useApiQuery<CatalogImport>(['catalog-imports', id ?? ''], `${BASE_URL}/${id}`, {
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === 'PROCESANDO' ? 3000 : false),
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
      // La extracción real corre en background (processInBackground en el
      // backend); esta llamada solo crea el registro en PROCESANDO y
      // devuelve al instante, así que el timeout por defecto sobra.
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

export function useDeleteCatalogImport() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE_URL}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog-imports'] }),
  });
}
