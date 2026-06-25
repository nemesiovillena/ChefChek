'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { Supplier } from './use-suppliers';

interface UseSupplierSearchReturn {
  suppliers: Supplier[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  error: string | null;
}

export function useSupplierSearch(debounceMs: number = 300): UseSupplierSearchReturn {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const searchSuppliers = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { isActive: 'true' };
      if (query.trim()) {
        params.search = query.trim();
      }
      const response = await apiClient.get<Supplier[]>('/v1/products/suppliers', { params });
      setSuppliers(response.data || []);
    } catch (err: unknown) {
      let message = 'Error buscando proveedores';
      if (axios.isAxiosError<{ message?: string }>(err)) {
        message = err.response?.data?.message || err.message || message;
      } else if (err instanceof Error) {
        message = err.message || message;
      }
      setError(message);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSuppliers(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs, searchSuppliers]);

  return { suppliers, loading, search, setSearch, error };
}
