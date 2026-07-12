import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';

export interface CostingConfig {
  targetCostPercentage: number;
  theoreticalPriceMultiplier: number;
}

const COSTING_CONFIG_KEY = ['costing-config'];

export function useCostingConfig() {
  return useApiQuery<CostingConfig>(COSTING_CONFIG_KEY, '/v1/costing-config');
}

export function useUpdateCostingConfig() {
  const invalidateQueries = useInvalidateQueries();

  return useApiMutation<CostingConfig, Partial<CostingConfig>>(
    '/v1/costing-config',
    'PATCH',
    {
      onSuccess: () => {
        invalidateQueries([COSTING_CONFIG_KEY]);
      },
    },
  );
}
