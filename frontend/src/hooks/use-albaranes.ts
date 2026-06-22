'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [meta, setMeta] = useState<AlbaranListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AlbaranFilters>({ ...initialFilters, page: 1, limit: 20 });

  const fetchAlbaranes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAlbaranes(filters);
      setAlbaranes(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading albaranes');
      setAlbaranes([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAlbaranes();
  }, [fetchAlbaranes]);

  const refetch = useCallback(() => {
    fetchAlbaranes();
  }, [fetchAlbaranes]);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<AlbaranFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  return { albaranes, meta, loading, error, refetch, setPage, setFilters };
}
