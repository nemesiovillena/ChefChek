'use client';

import { useApiQuery, useApiMutation } from './use-api';
import { useQueryClient } from '@tanstack/react-query';

export interface UnitOfMeasure {
  id: string;
  tenantId: string;
  name: string;
  symbol: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fetch active units for the current tenant */
export function useUnits() {
  return useApiQuery<UnitOfMeasure[]>(['units'], '/v1/products/units');
}

/** Create a new unit of measure */
export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useApiMutation<UnitOfMeasure, { name: string; symbol: string }>(
    '/v1/products/units',
    'POST',
    {
      onSuccess: (data) => {
        // Optimistic cache update to avoid selection flicker
        queryClient.setQueryData<UnitOfMeasure[]>(['units'], (old) => {
          if (!old) return [data];
          if (old.some((u) => u.id === data.id || u.symbol === data.symbol)) return old;
          return [...old, data].sort((a, b) => a.name.localeCompare(b.name));
        });
        queryClient.invalidateQueries({ queryKey: ['units'] });
      },
    },
  );
}
