'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAlbaranes, type Albaran, type AlbaranFilters, type AlbaranListResponse } from '@/lib/api-albaran';

interface UseAlbaranesReturn {
  albaranes: Albaran[];
  meta: AlbaranListResponse['meta'] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setPage: (page: number) => void;
  setFilters: (filters: Partial<AlbaranFilters>) => void;
}

export function useAlbaranes(initialFilters: AlbaranFilters = {}): UseAlbaranesReturn {
  const [filters, setFiltersState] = useState<AlbaranFilters>({ ...initialFilters, page: 1, limit: 20 });

  const { data, isLoading, error, refetch } = useQuery<AlbaranListResponse, Error>({
    queryKey: ['albaranes', filters],
    queryFn: async () => listAlbaranes(filters),
  });

  const setPage = (page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  };

  const setFilters = (newFilters: Partial<AlbaranFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  return {
    albaranes: data?.data ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Error loading albaranes') : null,
    refetch: () => {
      void refetch();
    },
    setPage,
    setFilters,
  };
}
