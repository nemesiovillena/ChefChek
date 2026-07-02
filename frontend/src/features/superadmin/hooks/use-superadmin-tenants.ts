'use client';

import { useState, useCallback } from 'react';
import { listTenants, TenantSummary } from '../api/superadmin-api';

interface UseSuperadminTenantsResult {
  tenants: TenantSummary[];
  loading: boolean;
  error: string | null;
  fetchTenants: () => Promise<void>;
}

export function useSuperadminTenants(): UseSuperadminTenantsResult {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  return { tenants, loading, error, fetchTenants };
}
