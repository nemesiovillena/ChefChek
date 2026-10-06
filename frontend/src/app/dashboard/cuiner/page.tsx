'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useCuinerStatus } from '@/hooks/use-cuiner';
import { CuinerConfigTab } from './components/cuiner-config-tab';
import { CuinerDishesTab } from './components/cuiner-dishes-tab';
import { CuinerProductsTab, CuinerSuppliersTab } from './components/cuiner-suppliers-products-tabs';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

const TABS = [
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'articulos', label: 'Artículos' },
  { id: 'platos', label: 'Platos' },
  { id: 'conector', label: 'Conector y envíos' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/**
 * Integración con Cuiner: enlaces entre ChefChek y los códigos de Cuiner,
 * configuración del conector y seguimiento de los albaranes enviados.
 */
export default function CuinerPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);
  const { data: status, isLoading, error } = useCuinerStatus(canManage);
  const [tab, setTab] = useState<TabId>('proveedores');

  if (!canManage) {
    return <p className="p-6 text-sm text-gray-600">Solo los administradores pueden gestionar la integración con Cuiner.</p>;
  }

  const hasCatalog = !!status && status.catalog.suppliers + status.catalog.articles > 0;
  const activeTab: TabId = status && !status.config ? 'conector' : tab;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Cuiner</h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Enlaza proveedores, artículos y platos con Cuiner para enviar albaranes y descontar del stock las ventas del TPV.
        </p>
      </div>

      {isLoading && <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {status && (
        <>
          {status.config && !hasCatalog && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Aún no se ha recibido el catálogo de Cuiner: los enlaces estarán disponibles cuando el conector lo sincronice.
            </p>
          )}
          <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-zinc-800">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                disabled={!status.config && t.id !== 'conector'}
                onClick={() => setTab(t.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium disabled:opacity-40 ${
                  activeTab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-white p-4 shadow dark:bg-zinc-950 md:p-6">
            {activeTab === 'proveedores' && <CuinerSuppliersTab />}
            {activeTab === 'articulos' && <CuinerProductsTab />}
            {activeTab === 'platos' && <CuinerDishesTab />}
            {activeTab === 'conector' && <CuinerConfigTab key={status.config?.id ?? 'nuevo'} status={status} />}
          </div>
        </>
      )}
    </div>
  );
}
