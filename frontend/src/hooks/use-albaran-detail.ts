'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAlbaran, type Albaran } from '@/lib/api-albaran';

interface UseAlbaranDetailReturn {
  albaran: Albaran | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAlbaranDetail(id: string | null): UseAlbaranDetailReturn {
  const [albaran, setAlbaran] = useState<Albaran | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbaran = useCallback(async () => {
    if (!id) {
      setAlbaran(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getAlbaran(id);
      setAlbaran(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading albaran');
      setAlbaran(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlbaran();
  }, [fetchAlbaran]);

  const refetch = useCallback(() => {
    fetchAlbaran();
  }, [fetchAlbaran]);

  return { albaran, loading, error, refetch };
}
