import { useApiQuery } from './use-api';

interface OCRExtraction {
  id: string;
  fileId: string;
  fileName: string;
  documentType: string;
  totalItems: number;
  confidence: number;
  processingTime: number;
  needsManualReview: boolean;
  processedAt: string;
  status: string;
}

interface OCRProduct {
  id: string;
  name: string;
  supplier: string;
  unitPrice: number;
  previousPrice: number;
  changePercentage: number;
  confidence: number;
  source: string;
  createdAt: string;
  status: string;
}

interface CostUpdate {
  id: string;
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  changePercentage: number;
  confidence: number;
  recalculationStatus: string;
  affectedRecipes: number;
  affectedMenus: number;
  updatedAt: string;
}

interface OCRStats {
  totalProcessed: number;
  successfulExtractions: number;
  failedExtractions: number;
  needsReview: number;
  averageConfidence: number;
  averageProcessingTime: number;
  totalProductsCreated: number;
  totalCostsUpdated: number;
  totalRecipesRecalculated: number;
  totalMenusRecalculated: number;
  documentTypes: {
    type: string;
    count: number;
    percentage: string;
  }[];
}

export function useOCRStats(tenantId: string) {
  return useApiQuery<OCRStats>(
    ['ocr-stats', tenantId],
    `/v1/ingesta/stats?tenantId=${tenantId}`,
    {
      refetchInterval: 60000,
      enabled: !!tenantId,
    },
  );
}

export function useOCRExtractions(tenantId: string) {
  return useApiQuery<OCRExtraction[]>(
    ['ocr-extractions', tenantId],
    `/v1/ingesta/extractions?tenantId=${tenantId}`,
    {
      refetchInterval: 30000,
      enabled: !!tenantId,
    },
  );
}

export function useOCRProducts(tenantId: string) {
  return useApiQuery<OCRProduct[]>(
    ['ocr-products', tenantId],
    `/v1/ingesta/products-extracted?tenantId=${tenantId}`,
    {
      refetchInterval: 30000,
      enabled: !!tenantId,
    },
  );
}

export function useOCRCostUpdates(tenantId: string) {
  return useApiQuery<CostUpdate[]>(
    ['ocr-cost-updates', tenantId],
    `/v1/ingesta/cost-updates?tenantId=${tenantId}`,
    {
      refetchInterval: 30000,
      enabled: !!tenantId,
    },
  );
}