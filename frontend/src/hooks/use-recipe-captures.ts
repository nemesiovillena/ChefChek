'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type {
  PromotionResult,
  RecipeCapture,
  RecipeCaptureListItem,
} from '@/lib/recipe-capture-types';

const BASE_URL = '/v1/recipe-captures';
const LIST_KEY = ['recipe-captures'];

/** Un paso a Recetas que dura más que esto se interrumpió: el servidor lo deja retomar. */
const PROMOTE_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * ¿Hay que seguir sondeando esta captura? PROCESANDO siempre termina (el
 * servidor cierra como error las que se quedan colgadas). PASANDO solo se
 * espera mientras el paso puede seguir vivo; si se interrumpió no cambiará
 * solo y hay que reintentarlo desde la revisión.
 */
function isInProgress(capture: Pick<RecipeCaptureListItem, 'status' | 'claimedAt'>): boolean {
  if (capture.status === 'PROCESANDO') return true;
  return (
    capture.status === 'PASANDO' &&
    !!capture.claimedAt &&
    Date.now() - new Date(capture.claimedAt).getTime() < PROMOTE_TIMEOUT_MS
  );
}

export function useRecipeCaptures() {
  return useApiQuery<RecipeCaptureListItem[]>(LIST_KEY, BASE_URL, {
    refetchInterval: (query) => (query.state.data?.some(isInProgress) ? 3000 : false),
  });
}

export function useRecipeCapture(id: string | null) {
  return useApiQuery<RecipeCapture>([...LIST_KEY, id ?? ''], `${BASE_URL}/${id}`, {
    enabled: !!id,
    refetchInterval: (query) => (query.state.data && isInProgress(query.state.data) ? 3000 : false),
  });
}

/** Alta por URL o por texto pegado. Devuelve al instante en PROCESANDO. */
export function useCreateRecipeCapture() {
  const queryClient = useQueryClient();
  return useMutation<
    RecipeCaptureListItem,
    Error,
    { source: 'URL'; url: string } | { source: 'TEXTO'; text: string }
  >({
    mutationFn: async (body) => (await apiClient.post<RecipeCaptureListItem>(BASE_URL, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

/** Alta por foto o PDF. */
export function useUploadRecipeCapture() {
  const queryClient = useQueryClient();
  return useMutation<RecipeCaptureListItem, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return (await apiClient.post<RecipeCaptureListItem>(`${BASE_URL}/upload`, formData)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useDiscardRecipeCapture() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE_URL}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

/** Reintenta una captura que quedó en ERROR, desde su fuente original. */
export function useRetryRecipeCapture() {
  const queryClient = useQueryClient();
  return useMutation<RecipeCapture, Error, string>({
    mutationFn: async (id) =>
      (await apiClient.post<RecipeCapture>(`${BASE_URL}/${id}/retry`)).data,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: [...LIST_KEY, id] });
    },
  });
}

/** Cambia o quita (null) el artículo vinculado a un ingrediente. */
export function useUpdateCaptureIngredient() {
  const queryClient = useQueryClient();
  return useMutation<
    RecipeCapture,
    Error,
    { captureId: string; ingredientId: string; matchedProductId: string | null }
  >({
    mutationFn: async ({ captureId, ingredientId, matchedProductId }) =>
      (
        await apiClient.patch<RecipeCapture>(
          `${BASE_URL}/${captureId}/ingredients/${ingredientId}`,
          { matchedProductId },
        )
      ).data,
    onSuccess: (_, { captureId }) =>
      queryClient.invalidateQueries({ queryKey: [...LIST_KEY, captureId] }),
  });
}

/** Crea la receta real. Repetir la llamada devuelve la misma receta. */
export function usePromoteRecipeCapture() {
  const queryClient = useQueryClient();
  return useMutation<PromotionResult, Error, string>({
    mutationFn: async (id) =>
      (await apiClient.post<PromotionResult>(`${BASE_URL}/${id}/promote`)).data,
    // También si falla: un 409 significa que el estado cambió en el servidor.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      // El selector de subrecetas tiene su propia caché.
      queryClient.invalidateQueries({ queryKey: ['recipe-options'] });
    },
  });
}
