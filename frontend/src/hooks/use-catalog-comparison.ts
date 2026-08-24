'use client';

import { useApiQuery } from './use-api';

export interface CatalogComparisonEntry {
  catalogImportId: string;
  supplierName: string;
  lineId: string;
  rawName: string;
  purchaseFormat: string | null;
  unitPrice: number;
  isBestPrice: boolean;
}

export interface CatalogComparisonGroup {
  representativeName: string;
  entries: CatalogComparisonEntry[];
}

/** Compara líneas en crudo entre 2+ catálogos ya extraídos (sin aceptar/aplicar). */
export function useCatalogComparison(catalogImportIds: string[]) {
  const sortedIds = [...catalogImportIds].sort();
  return useApiQuery<CatalogComparisonGroup[]>(
    ['catalog-comparison', ...sortedIds],
    `/v1/compras/catalogos/comparar?ids=${encodeURIComponent(catalogImportIds.join(','))}`,
    { enabled: catalogImportIds.length >= 2 },
  );
}
