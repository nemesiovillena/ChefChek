'use client';

import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import type { Product } from './use-products';

interface UseProductSearchReturn {
  products: Product[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  error: string | null;
}

export function useProductSearch(debounceMs: number = 300): UseProductSearchReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<Product[]>('/v1/products', {
        params: { search: query },
      });
      setProducts(response.data || []);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Error buscando productos';
      setError(message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs, searchProducts]);

  return { products, loading, search, setSearch, error };
}
