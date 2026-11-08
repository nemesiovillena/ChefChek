import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import { FOOD_LABELS_KEY } from './use-food-labels';

/** Contador de raciones disponibles (módulo `raciones`). */

export type PortionState = 'ok' | 'low' | 'out';

export interface PortionDish {
  id: string;
  tipo: string;
  producto: string;
  portionsPerSale: number;
  /** Cuiner lo vende al peso: cada venta resta una pieza. */
  perPiece: boolean;
  name: string | null;
}

export interface PortionCounter {
  id: string;
  name: string;
  recipeId: string | null;
  productId: string | null;
  minPortions: number;
  /** Grupo en la pantalla (Carnes, Pescados, Platos…); null = sin categoría. */
  category: string | null;
  unlabeledPortions: number;
  active: boolean;
  available: number;
  activeLabels: number;
  state: PortionState;
  /** Lo que marca el Contador de platos de Cuiner (enlace en vivo). */
  cuinerAvailable: number | null;
  /** ChefChek y Cuiner no coinciden: hay que revisarlo. */
  cuinerMismatch: boolean;
  /** Dónde se carga: TPV = solo en Cuiner, ChefChek solo lo muestra. */
  loadSource: PortionLoadSource;
  dishes: PortionDish[];
}

export interface ExpiredPortionLabel {
  id: string;
  itemName: string;
  lotNumber: string;
  useByDate: string;
  frozenUseByDate: string | null;
  portionsRemaining: number;
  portionCounterId: string;
}

export interface PortionShortfall {
  id: string;
  counterId: string;
  counterName: string;
  quantity: number;
  createdAt: string;
}

export interface PortionOverview {
  counters: PortionCounter[];
  expiredLabels: ExpiredPortionLabel[];
  shortfalls: PortionShortfall[];
  salesReceivedUntil: string | null;
  /** Última comparación con Cuiner; null = sin enlace en vivo. */
  cuinerCheckedAt: string | null;
}

export type PortionMovementType =
  | 'LABEL_IN'
  | 'LABEL_EDIT'
  | 'SALE'
  | 'RETIRE'
  | 'UNRETIRE'
  | 'VOID'
  | 'ADJUST'
  | 'RECOUNT'
  | 'ORDER'
  | 'CUINER_LOAD';

export const MOVEMENT_LABEL: Record<PortionMovementType, string> = {
  LABEL_IN: 'Etiqueta',
  LABEL_EDIT: 'Etiqueta corregida',
  SALE: 'Venta Cuiner',
  RETIRE: 'Etiqueta retirada',
  UNRETIRE: 'Retirada deshecha',
  VOID: 'Etiqueta anulada',
  ADJUST: 'Ajuste',
  RECOUNT: 'Recuento',
  ORDER: 'Pedido Cuiner',
  CUINER_LOAD: 'Carga en Cuiner',
};

export interface PortionMovement {
  id: string;
  type: PortionMovementType;
  quantity: number;
  foodLabelId: string | null;
  shortfall: boolean;
  reason: string | null;
  userName: string | null;
  createdAt: string;
}

export interface PortionCounterLabel {
  id: string;
  lotNumber: string;
  itemName: string;
  preparedAt: string;
  useByDate: string;
  frozenUseByDate: string | null;
  portions: number | null;
  portionsRemaining: number | null;
  createdByName: string;
}

export interface PortionCounterDetail {
  id: string;
  name: string;
  available: number;
  labels: PortionCounterLabel[];
  movements: PortionMovement[];
}

export interface CuinerDishOption {
  tipo: string;
  producto: string;
  nombre: string;
  familia: string | null;
}

export const RACIONES_KEY = ['raciones'];

/** Configuración → Contador de platos: dónde se cargan las raciones. */
export type PortionLoadSource = 'CHEFCHEK' | 'TPV' | 'BOTH';

export interface PortionSettings {
  loadSource: PortionLoadSource;
  /** Lo que se aplica: sin TPV enlazado en vivo, siempre CHEFCHEK. */
  effectiveSource: PortionLoadSource;
  doubleLoadHours: number;
  /** TPV (Cuiner) enlazado en vivo. */
  live: boolean;
}

export function usePortionSettings(enabled = true) {
  return useApiQuery<PortionSettings>([...RACIONES_KEY, 'settings'], '/v1/raciones/settings', {
    enabled,
  });
}

export function useUpdatePortionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { loadSource?: PortionLoadSource; doubleLoadHours?: number }) =>
      apiClient.put('/v1/raciones/settings', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RACIONES_KEY });
      qc.invalidateQueries({ queryKey: ['etiquetado-prep-context'] });
    },
  });
}

/** Se refresca cada minuto: las ventas de Cuiner entran solas. */
export function usePortionOverview(enabled = true) {
  return useApiQuery<PortionOverview>([...RACIONES_KEY, 'overview'], '/v1/raciones', {
    enabled,
    refetchInterval: 60_000,
  });
}

export function usePortionCounterDetail(id: string | null) {
  return useApiQuery<PortionCounterDetail>(
    [...RACIONES_KEY, 'detail', id ?? ''],
    `/v1/raciones/${id}`,
    { enabled: Boolean(id) },
  );
}

export function useCuinerDishSearch(search: string, enabled: boolean) {
  const term = search.trim();
  return useApiQuery<CuinerDishOption[]>(
    [...RACIONES_KEY, 'cuiner-dishes', term],
    `/v1/raciones/cuiner-dishes?q=${encodeURIComponent(term)}`,
    { enabled },
  );
}

/** Mutación del contador: al acabar refresca contadores y etiquetas. */
function usePortionMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RACIONES_KEY });
      qc.invalidateQueries({ queryKey: FOOD_LABELS_KEY });
      qc.invalidateQueries({ queryKey: ['etiquetado-prep-context'] });
    },
  });
}

export function useCreatePortionCounter() {
  return usePortionMutation(
    (input: { recipeId?: string; productId?: string; name?: string; minPortions?: number }) =>
      apiClient.post('/v1/raciones', input),
  );
}

export function useUpdatePortionCounter() {
  return usePortionMutation(
    ({ id, ...input }: { id: string; name?: string; minPortions?: number; active?: boolean; category?: string }) =>
      apiClient.patch(`/v1/raciones/${id}`, input),
  );
}

export function useDeletePortionCounter() {
  const qc = useQueryClient();
  return usePortionMutation(async (id: string) => {
    await apiClient.delete(`/v1/raciones/${id}`);
    // Sin esto, el refresco tras borrar vuelve a pedir su ficha → 404.
    qc.removeQueries({ queryKey: [...RACIONES_KEY, 'detail', id] });
  });
}

export function useLinkPortionDish() {
  return usePortionMutation(
    ({ id, ...input }: { id: string; tipo: string; producto: string; portionsPerSale?: number; perPiece?: boolean }) =>
      apiClient.post(`/v1/raciones/${id}/dishes`, input),
  );
}

export function useUnlinkPortionDish() {
  return usePortionMutation(({ id, dishId }: { id: string; dishId: string }) =>
    apiClient.delete(`/v1/raciones/${id}/dishes/${dishId}`),
  );
}

export function useAdjustPortions() {
  return usePortionMutation(
    ({ id, delta, reason }: { id: string; delta: number; reason: string }) =>
      apiClient.post(`/v1/raciones/${id}/adjust`, { delta, reason }),
  );
}

export function useRecountPortions() {
  return usePortionMutation(
    ({ id, actual, reason }: { id: string; actual: number; reason?: string }) =>
      apiClient.post(`/v1/raciones/${id}/recount`, { actual, reason }),
  );
}

export function useAcknowledgeExpiredPortions() {
  return usePortionMutation((labelId: string) =>
    apiClient.post(`/v1/raciones/labels/${labelId}/acknowledge-expired`),
  );
}

/** «3», «2,5»: sin ceros sobrantes, coma decimal. */
export const fmtPortions = (n: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n);
