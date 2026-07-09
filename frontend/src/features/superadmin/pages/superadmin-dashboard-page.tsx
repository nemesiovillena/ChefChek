'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useSuperadminClients } from '../hooks/use-superadmin-clients';
import { TenantList } from '../components/tenant-list';
import { TrashedClientList } from '../components/trashed-client-list';
import { ClientDetailsPanel } from '../components/client-details-panel';
import { ClientFormDialog } from '../components/client-form-dialog';
import type { TenantSummary } from '../api/superadmin-api';

type View = 'active' | 'trashed';

export function SuperadminDashboardPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const {
    active,
    trashed,
    loading,
    error,
    refresh,
    update,
    deactivate,
    restore,
    purge,
  } = useSuperadminClients();
  const [view, setView] = useState<View>('active');
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
      refresh();
    }
  }, [isLoading, isAuthenticated, user, router, refresh]);

  if (isLoading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background text-foreground">
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
        {/* Sidebar: listado de clientes + papelera */}
        <aside className="w-80 shrink-0 border-r border-border bg-surface-container-low overflow-y-auto flex flex-col">
          <div className="px-stack-lg py-stack-md border-b border-border space-y-stack-md">
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Clientes
            </p>
            {/* Toggle Activos / Papelera */}
            <div role="tablist" className="flex bg-surface-container rounded-full p-1">
              <button
                role="tab"
                aria-selected={view === 'active'}
                onClick={() => setView('active')}
                className={`flex-1 px-stack-md py-1.5 rounded-full font-label-sm text-label-sm cursor-pointer transition-colors ${
                  view === 'active' ? 'bg-primary text-primary-foreground' : 'text-on-surface-variant'
                }`}
              >
                Activos
              </button>
              <button
                role="tab"
                aria-selected={view === 'trashed'}
                onClick={() => setView('trashed')}
                className={`flex-1 px-stack-md py-1.5 rounded-full font-label-sm text-label-sm cursor-pointer transition-colors ${
                  view === 'trashed' ? 'bg-primary text-primary-foreground' : 'text-on-surface-variant'
                }`}
              >
                Papelera{trashed.length > 0 ? ` (${trashed.length})` : ''}
              </button>
            </div>
            {view === 'active' && (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-stack-sm px-stack-md py-stack-sm rounded-full bg-primary text-primary-foreground font-label-md text-label-md hover:opacity-90 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                Nuevo cliente
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="px-stack-lg py-stack-md text-on-surface-variant font-label-sm text-label-sm">
                Cargando...
              </p>
            )}
            {error && (
              <p className="px-stack-lg py-stack-md text-error font-label-sm text-label-sm">{error}</p>
            )}
            {!loading && !error && view === 'active' && (
              <TenantList
                tenants={active}
                selectedId={selectedTenant?.id ?? null}
                onSelect={setSelectedTenant}
              />
            )}
            {!loading && !error && view === 'trashed' && (
              <TrashedClientList clients={trashed} onRestore={restore} onPurge={purge} />
            )}
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto">
          {view === 'active' && selectedTenant ? (
            <ClientDetailsPanel
              tenant={selectedTenant}
              update={update}
              deactivate={deactivate}
              onDeactivated={() => setSelectedTenant(null)}
            />
          ) : view === 'trashed' ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant py-24">
              <span className="material-symbols-outlined text-5xl">delete_sweep</span>
              <p className="font-label-md text-label-md">
                Selecciona un cliente en la papelera para reactivarlo o borrarlo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant py-24">
              <span className="material-symbols-outlined text-5xl">store</span>
              <p className="font-label-md text-label-md">
                Selecciona un cliente para ver y editar sus datos.
              </p>
            </div>
          )}
        </main>
      </div>

      <ClientFormDialog
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />
    </div>
  );
}
