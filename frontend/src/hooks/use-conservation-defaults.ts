import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export interface ConservationConditionDefaults {
  tempMin: number;
  tempMax: number;
  shelfLifeDays: number;
}

export interface ConservationDefaults {
  refrigerated: ConservationConditionDefaults;
  frozen: ConservationConditionDefaults;
}

export interface UpdateConservationDefaultsInput {
  refrigeratedTempMin?: number;
  refrigeratedTempMax?: number;
  refrigeratedShelfLifeDays?: number;
  frozenTempMin?: number;
  frozenTempMax?: number;
  frozenShelfLifeDays?: number;
}

const CONSERVATION_DEFAULTS_KEY = ['conservation-defaults'];

/**
 * Defaults de conservación/vida útil por tenant (refrigerado/congelado).
 * Alimentan el autorrelleno de ConservationFieldset, compartido por los
 * modales de Receta y Artículo.
 */
export function useConservationDefaults() {
  return useApiQuery<ConservationDefaults>(
    CONSERVATION_DEFAULTS_KEY,
    '/v1/conservation-defaults',
  );
}

export function useUpdateConservationDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateConservationDefaultsInput) => {
      const res = await apiClient.put<ConservationDefaults>(
        '/v1/conservation-defaults',
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONSERVATION_DEFAULTS_KEY }),
  });
}
