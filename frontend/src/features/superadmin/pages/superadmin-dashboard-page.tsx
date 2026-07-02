'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useSuperadminTenants } from '../hooks/use-superadmin-tenants';
import { TenantList } from '../components/tenant-list';
import { TenantModuleManager } from '../components/tenant-module-manager';
import { TenantSummary } from '../api/superadmin-api';

export function SuperadminDashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const { tenants, loading: tenantsLoading, error: tenantsError, fetchTenants } = useSuperadminTenants();
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      if (user?.role !== 'SUPERADMIN') {
        router.push('/dashboard');
        return;
      }
      fetchTenants();
    }
  }, [isLoading, isAuthenticated, user, router, fetchTenants]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#e5e2e1]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl animate-spin text-secondary">
            progress_activity
          </span>
          <div className="font-label-md text-label-md tracking-wider">VALIDANDO ACCESO...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'SUPERADMIN') {
    return null;
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface-container flex justify-between items-center px-margin-desktop h-stack-xl border-b border-border">
        <div className="flex items-center gap-gutter">
          <h1 className="font-display text-display tracking-tight text-primary uppercase font-extrabold">
            CHEFCHEK
          </h1>
          <span className="font-label-sm text-label-sm text-secondary px-2 py-0.5 border border-secondary rounded uppercase tracking-widest">
            Superadmin
          </span>
        </div>
        <div className="flex items-center gap-stack-md">
          <p className="font-label-sm text-label-sm text-on-surface-variant hidden sm:block">
            {user?.email}
          </p>
          <button
            onClick={logout}
            className="material-symbols-outlined text-on-surface-variant hover:text-error cursor-pointer active:scale-95 duration-200"
            title="Cerrar Sesión"
          >
            logout
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="pt-16 flex min-h-screen">
        {/* Sidebar: tenant list */}
        <aside className="w-72 shrink-0 border-r border-border bg-surface-container-low overflow-y-auto">
          <div className="px-stack-lg py-stack-md border-b border-border">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Clientes
            </p>
          </div>
          {tenantsLoading && (
            <p className="px-stack-lg py-stack-md text-on-surface-variant font-label-sm text-label-sm">
              Cargando...
            </p>
          )}
          {tenantsError && (
            <p className="px-stack-lg py-stack-md text-error font-label-sm text-label-sm">
              {tenantsError}
            </p>
          )}
          {!tenantsLoading && !tenantsError && (
            <TenantList
              tenants={tenants}
              selectedId={selectedTenant?.id ?? null}
              onSelect={setSelectedTenant}
            />
          )}
        </aside>

        {/* Main panel: module manager */}
        <main className="flex-1 overflow-y-auto">
          {selectedTenant ? (
            <TenantModuleManager tenant={selectedTenant} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant py-24">
              <span className="material-symbols-outlined text-5xl">store</span>
              <p className="font-label-md text-label-md">
                Selecciona un cliente para gestionar sus módulos
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
