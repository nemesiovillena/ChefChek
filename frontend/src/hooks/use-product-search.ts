'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { Product } from './use-products';

interface UseProductSearchReturn {
  products: Product[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  error: string | null;
}

export interface ProductSearchFilters {
  /** Restringe la búsqueda a artículos cuyo proveedor principal sea este. */
  supplierId?: string;
}

export function useProductSearch(
  debounceMs: number = 300,
  filters?: ProductSearchFilters,
): UseProductSearchReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supplierId = filters?.supplierId;

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // El interceptor global de apiClient desenvuelve el envelope paginado
      // { success, data, meta } del backend en { data, total, page, ... }.
      const response = await apiClient.get<{ data: Product[] }>('/v1/products', {
        params: { search: query, ...(supplierId ? { supplier: supplierId } : {}) },
      });
      setProducts(response.data?.data || []);
    } catch (err: unknown) {
      let message = 'Error buscando productos';
      if (axios.isAxiosError<{ message?: string }>(err)) {
        message = err.response?.data?.message || err.message || message;
      } else if (err instanceof Error) {
        message = err.message || message;
      }
      setError(message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs, searchProducts]);

  return { products, loading, search, setSearch, error };
}
