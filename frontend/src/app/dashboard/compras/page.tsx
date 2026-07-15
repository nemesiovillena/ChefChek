'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ClipboardList,
  CalendarClock,
  FileUp,
  Tags,
  BarChart3,
  MapPin,
  Plus,
  Star,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  type TenantLocation,
} from '@/hooks/use-locations';
import { PedidosTab } from './components/pedidos-tab';
import { ListasTab } from './components/listas-tab';
import { PriceDeviationPanel } from './components/price-deviation-panel';
import { CatalogosTab } from './components/catalogos-tab';
import { ProgramacionesTab } from './components/programaciones-tab';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

type TabId =
  | 'pedidos'
  | 'listas'
  | 'programaciones'
  | 'catalogos'
  | 'precios'
  | 'analitica'
  | 'locales';

const TABS: { id: TabId; label: string; icon: typeof ShoppingCart }[] = [
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
  { id: 'listas', label: 'Listas', icon: ClipboardList },
  { id: 'programaciones', label: 'Programaciones', icon: CalendarClock },
  { id: 'catalogos', label: 'Catálogos', icon: FileUp },
  { id: 'precios', label: 'Precios pactados', icon: Tags },
  { id: 'analitica', label: 'Analítica', icon: BarChart3 },
  { id: 'locales', label: 'Locales', icon: MapPin },
];

/** Qué sprint del plan activa cada pestaña aún no funcional. */
const PENDING_TABS: Partial<Record<TabId, string>> = {
  analitica: 'La analítica de compras estará disponible próximamente (Sprint 7).',
};

export default function ComprasPage() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('pedidos');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--on-surface-variant)]">
        Cargando compras...
      </div>
    );
  }

  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-[var(--on-surface)]">
          <ShoppingCart className="h-7 w-7 text-[var(--primary)]" />
          Compras
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Pedidos y compras a proveedores: listas, envío, precios y analítica.
        </p>
      </header>

      {/* Tab bar con role=tablist: globals.css oculta <nav> no-fixed, no usar <nav> */}
      <div
        role="tablist"
        aria-label="Secciones de compras"
        className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === id
                ? 'bg-[var(--primary)] text-primary-foreground'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'pedidos' ? (
        <PedidosTab />
      ) : activeTab === 'listas' ? (
        <ListasTab canManage={canManage || user?.role === 'USER'} />
      ) : activeTab === 'precios' ? (
        <PriceDeviationPanel canManage={canManage} />
      ) : activeTab === 'catalogos' ? (
        <CatalogosTab />
      ) : activeTab === 'programaciones' ? (
        <ProgramacionesTab canManage={canManage || user?.role === 'USER'} />
      ) : activeTab === 'locales' ? (
        <LocationsPanel canManage={canManage} />
      ) : (
        <PendingFeatureCard message={PENDING_TABS[activeTab] ?? ''} />
      )}
    </div>
  );
}

function PendingFeatureCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 text-center">
      <p className="text-[var(--on-surface-variant)]">{message}</p>
    </div>
  );
}

function LocationsPanel({ canManage }: { canManage: boolean }) {
  const { data: locations, isLoading, error } = useLocations();
  const createMut = useCreateLocation();
  const updateMut = useUpdateLocation();
  const deleteMut = useDeleteLocation();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const list = Array.isArray(locations) ? locations : [];

  const notifyError = (e: unknown, fallback: string) =>
    addNotification({
      type: 'error',
      title: 'Error',
      message: e instanceof Error ? e.message : fallback,
    });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createMut.mutateAsync({
        name: newName.trim(),
        address: newAddress.trim() || undefined,
      });
      setNewName('');
      setNewAddress('');
      addNotification({ type: 'success', title: 'Local creado', message: newName.trim() });
    } catch (e) {
      notifyError(e, 'No se pudo crear el local');
    }
  };

  const handleRename = async (loc: TenantLocation) => {
    if (!editName.trim() || editName.trim() === loc.name) {
      setEditingId(null);
      return;
    }
    try {
      await updateMut.mutateAsync({ id: loc.id, data: { name: editName.trim() } });
      setEditingId(null);
    } catch (e) {
      notifyError(e, 'No se pudo renombrar el local');
    }
  };

  const handleMakeDefault = async (loc: TenantLocation) => {
    try {
      await updateMut.mutateAsync({ id: loc.id, data: { isDefault: true } });
    } catch (e) {
      notifyError(e, 'No se pudo cambiar el local predeterminado');
    }
  };

  const handleToggleActive = async (loc: TenantLocation) => {
    try {
      await updateMut.mutateAsync({ id: loc.id, data: { isActive: !loc.isActive } });
    } catch (e) {
      notifyError(e, 'No se pudo cambiar el estado del local');
    }
  };

  const handleDelete = async (loc: TenantLocation) => {
    const ok = await confirm({
      title: `Eliminar el local "${loc.name}"`,
      description:
        'El local se moverá a la papelera. Los datos de compras asociados no se pierden.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(loc.id);
      addNotification({ type: 'success', title: 'Local eliminado', message: loc.name });
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el local');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando locales...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
        No se pudieron cargar los locales: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--on-surface)]">Nuevo local</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre (p. ej. Cocina central)"
              className="flex-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="Dirección (opcional)"
              className="flex-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMut.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Añadir
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {list.map((loc) => (
          <li
            key={loc.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3"
          >
            <MapPin className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
            <div className="min-w-0 flex-1">
              {editingId === loc.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(loc);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="w-full max-w-xs rounded-lg border border-[var(--primary)] bg-[var(--surface-container-lowest)] px-2 py-1 text-sm text-[var(--on-surface)] outline-none"
                  />
                  <button onClick={() => handleRename(loc)} aria-label="Guardar nombre" className="text-[var(--primary)]">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} aria-label="Cancelar" className="text-[var(--on-surface-variant)]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="truncate font-medium text-[var(--on-surface)]">
                  {loc.name}
                  {!loc.isActive && (
                    <span className="ml-2 rounded-full bg-[var(--surface-container-high)] px-2 py-0.5 text-xs text-[var(--on-surface-variant)]">
                      Inactivo
                    </span>
                  )}
                </p>
              )}
              {loc.address && (
                <p className="truncate text-xs text-[var(--on-surface-variant)]">{loc.address}</p>
              )}
            </div>

            {loc.isDefault ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-medium text-primary-foreground">
                <Star className="h-3 w-3" /> Predeterminado
              </span>
            ) : (
              canManage && (
                <button
                  onClick={() => handleMakeDefault(loc)}
                  className="rounded-full border border-[var(--outline-variant)] px-3 py-1 text-xs text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)]"
                >
                  Hacer predeterminado
                </button>
              )
            )}

            {canManage && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingId(loc.id);
                    setEditName(loc.name);
                  }}
                  aria-label={`Renombrar ${loc.name}`}
                  className="rounded-lg p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {!loc.isDefault && (
                  <>
                    <button
                      onClick={() => handleToggleActive(loc)}
                      className="rounded-lg px-2 py-2 text-xs text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)]"
                    >
                      {loc.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      aria-label={`Eliminar ${loc.name}`}
                      className="rounded-lg p-2 text-[var(--error)] transition hover:bg-[var(--error-container)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
