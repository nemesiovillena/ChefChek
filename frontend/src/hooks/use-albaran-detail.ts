'use client';

import { useQuery } from '@tanstack/react-query';
import { getAlbaran, type Albaran } from '@/lib/api-albaran';

interface UseAlbaranDetailReturn {
  albaran: Albaran | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAlbaranDetail(id: string | null): UseAlbaranDetailReturn {
  const { data, isLoading, error, refetch } = useQuery<Albaran, Error>({
    queryKey: ['albaran', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('No albaran id provided');
      }
      return getAlbaran(id);
    },
    enabled: !!id,
  });

  return {
    albaran: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Error loading albaran') : null,
    refetch: () => {
      void refetch();
    },
  };
}
