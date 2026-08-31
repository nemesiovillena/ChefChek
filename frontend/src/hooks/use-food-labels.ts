import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export type LabelType = 'ELABORATED' | 'HANDLED';
export type StorageCondition = 'REFRIGERATED' | 'FROZEN' | 'AMBIENT';

export interface FoodLabelIngredientLot {
  id: string;
  productId: string | null;
  productName: string;
  lotId: string | null;
  lotNumber: string;
  quantityUsed: number | null;
  unit: string | null;
}

export interface FoodLabel {
  id: string;
  labelType: LabelType;
  recipeId: string | null;
  productId: string | null;
  itemName: string;
  lotNumber: string;
  sourceLotId: string | null;
  preparedAt: string;
  manufacturerExpiryDate: string | null;
  useByDate: string;
  frozenAt: string | null;
  frozenUseByDate: string | null;
  storageCondition: StorageCondition;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDaysApplied: number | null;
  quantity: number | null;
  quantityUnit: string | null;
  portions: number | null;
  allergens: number[];
  notes: string | null;
  createdByName: string;
  reprintCount: number;
  qrToken: string;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  ingredientLots: FoodLabelIngredientLot[];
  recipe: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  sourceLot: {
    id: string;
    lotNumber: string;
    receivedAt: string;
    expiryDate: string | null;
    supplier: { name: string } | null;
  } | null;
}

export interface FoodLabelListResponse {
  data: FoodLabel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FoodLabelListQuery {
  labelType?: LabelType;
  recipeId?: string;
  productId?: string;
  lotNumber?: string;
  from?: string;
  to?: string;
  includeVoided?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ConservationConfig {
  storageCondition: StorageCondition | null;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDays: number | null;
  shelfLifeFrozenDays: number | null;
}

export interface PrepContextLot {
  id: string;
  lotNumber: string;
  receivedAt: string;
  expiryDate: string | null;
  supplierName: string | null;
  quantity: number;
}

export interface RecipePrepContext {
  recipeId: string;
  name: string;
  allergens: number[];
  portions: number;
  conservation: ConservationConfig;
  ingredients: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    lastKnownLot: string | null;
    availableLots: PrepContextLot[];
  }>;
  subRecipes: Array<{ subRecipeId: string; name: string }>;
}

export interface ProductPrepContext {
  productId: string;
  name: string;
  allergens: number[];
  conservation: ConservationConfig;
  lots: PrepContextLot[];
  manufacturerExpiryCandidate: string | null;
}

export interface CreateFoodLabelInput {
  labelType: LabelType;
  recipeId?: string;
  productId?: string;
  sourceLotId?: string;
  lotNumber?: string;
  preparedAt?: string;
  manufacturerExpiryDate?: string;
  useByDate?: string;
  freeze?: boolean;
  frozenAt?: string;
  storageCondition?: StorageCondition;
  storageTempMin?: number;
  storageTempMax?: number;
  shelfLifeDays?: number;
  shelfLifeFrozenDays?: number;
  quantity?: number;
  quantityUnit?: string;
  portions?: number;
  notes?: string;
  ingredientLots?: Array<{
    productId?: string;
    productName: string;
    lotId?: string;
    lotNumber: string;
    quantityUsed?: number;
    unit?: string;
  }>;
}

export const FOOD_LABELS_KEY = ['food-labels'];

export function useFoodLabels(query: FoodLabelListQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return useApiQuery<FoodLabelListResponse>(
    [...FOOD_LABELS_KEY, 'list', qs],
    `/v1/etiquetado/labels${qs ? `?${qs}` : ''}`,
  );
}

export function useFoodLabel(id: string | null) {
  return useApiQuery<FoodLabel>(
    [...FOOD_LABELS_KEY, 'detail', id ?? ''],
    `/v1/etiquetado/labels/${id}`,
    { enabled: Boolean(id) },
  );
}

export function useRecipePrepContext(recipeId: string | null) {
  return useApiQuery<RecipePrepContext>(
    ['etiquetado-prep-context', 'recipe', recipeId ?? ''],
    `/v1/etiquetado/prep-context?recipeId=${recipeId}`,
    { enabled: Boolean(recipeId) },
  );
}

export function useProductPrepContext(productId: string | null) {
  return useApiQuery<ProductPrepContext>(
    ['etiquetado-prep-context', 'product', productId ?? ''],
    `/v1/etiquetado/prep-context?productId=${productId}`,
    { enabled: Boolean(productId) },
  );
}

export function useCreateFoodLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFoodLabelInput) => {
      const res = await apiClient.post<FoodLabel>('/v1/etiquetado/labels', input);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOD_LABELS_KEY }),
  });
}

export function useVoidFoodLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<FoodLabel>(
        `/v1/etiquetado/labels/${id}/void`,
        { reason },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOOD_LABELS_KEY }),
  });
}

/** `thermal:<profileId>` (perfil del tenant) o `a4-70x37` / `a4-63x38` (built-in). */
export type LabelPdfFormat = string;

export interface ThermalProfile {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface EtiquetadoConfig {
  thermalProfiles: ThermalProfile[];
  a4Presets: Array<{ id: string; name: string }>;
}

export function useEtiquetadoConfig() {
  return useApiQuery<EtiquetadoConfig>(
    ['etiquetado-config'],
    '/v1/etiquetado/config',
  );
}

export function useUpdateEtiquetadoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (thermalProfiles: ThermalProfile[]) => {
      const res = await apiClient.put<{ thermalProfiles: ThermalProfile[] }>(
        '/v1/etiquetado/config',
        { thermalProfiles },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['etiquetado-config'] }),
  });
}

/** Opciones de formato para los selectores de impresión (perfiles + A4). */
export function labelFormatOptions(
  config: EtiquetadoConfig | undefined,
): Array<{ value: string; label: string }> {
  if (!config) return [];
  return [
    ...config.thermalProfiles.map((p) => ({
      value: `thermal:${p.id}`,
      label: `${p.name} (${p.widthMm}×${p.heightMm} mm)`,
    })),
    ...config.a4Presets.map((a) => ({ value: a.id, label: a.name })),
  ];
}

/**
 * Abre el PDF de una etiqueta en una pestaña nueva. La pestaña se abre
 * SÍNCRONAMENTE dentro del gesto del usuario (iOS Safari bloquea window.open
 * tras un await, de forma silenciosa) y navega al blob cuando llega.
 */
export async function openLabelPdf(
  labelId: string,
  format: LabelPdfFormat,
  copies: number,
  opts: { reprint?: boolean; onError?: (msg: string) => void } = {},
): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) {
    opts.onError?.(
      'El navegador bloqueó la ventana emergente. Permite popups e inténtalo de nuevo.',
    );
    return;
  }
  win.document.write(
    '<!doctype html><html><head><title>Generando etiqueta…</title></head>'
      + '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;'
      + 'justify-content:center;height:100vh;margin:0;color:#666">Generando etiqueta…</body></html>',
  );
  try {
    const res = await apiClient.get(`/v1/etiquetado/labels/${labelId}/pdf`, {
      params: { format, copies, ...(opts.reprint ? { reprint: 1 } : {}) },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(
      new Blob([res.data], { type: 'application/pdf' }),
    );
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    win.close();
    opts.onError?.('No se pudo generar la etiqueta');
  }
}
