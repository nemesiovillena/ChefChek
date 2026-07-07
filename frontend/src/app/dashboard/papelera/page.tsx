'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  ChefHat,
  FileText,
  Folder,
  Truck,
  Users,
  Flag,
  ListTodo,
  Warehouse as WarehouseIcon,
  RotateCcw,
  Trash2,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useTrashedItems,
  useRestoreItem,
  usePurgeItem,
  trashErrorMessage,
  type TrashType,
  type TrashItem,
} from '@/hooks/use-trash';

interface TypeConfig {
  id: TrashType;
  label: string;
  icon: LucideIcon;
}

const TYPES: TypeConfig[] = [
  { id: 'product', label: 'Artículos', icon: Package },
  { id: 'recipe', label: 'Recetas', icon: ChefHat },
  { id: 'albaran', label: 'Albaranes', icon: FileText },
  { id: 'category', label: 'Categorías', icon: Folder },
  { id: 'supplier', label: 'Proveedores', icon: Truck },
  { id: 'user', label: 'Usuarios', icon: Users },
  { id: 'sprint', label: 'Sprints', icon: Flag },
  { id: 'task', label: 'Tareas', icon: ListTodo },
  { id: 'warehouse', label: 'Almacenes', icon: WarehouseIcon },
];

/** "hace 3 días", "hace 2 h", "ahora mismo" — relativo y en español. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d > 1 ? 's' : ''}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
}

export default function PapeleraPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const confirm = useConfirm();

  const [type, setType] = useState<TrashType>('product');
  const { data, isLoading: itemsLoading, error } = useTrashedItems(type);
  const restoreMut = useRestoreItem();
  const purgeMut = usePurgeItem();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--on-surface-variant)]">
        Cargando papelera...
      </div>
    );
  }

  // Desempaquetado defensivo: el backend puede devolver array o {data:[...]}.
  type RawTrash = TrashItem[] | { data: TrashItem[] };
  const raw = data as RawTrash | undefined;
  const items: TrashItem[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : [];

  const activeType = TYPES.find((t) => t.id === type)!;

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreMut.mutateAsync({ type: item.type, id: item.id });
      addNotification({
        type: 'success',
        title: 'Recuperado',
        message: `"${item.label}" vuelve a estar disponible.`,
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo recuperar',
        message: trashErrorMessage(e, 'Error al recuperar el elemento.'),
      });
    }
  };

  const handlePurge = async (item: TrashItem) => {
    await confirm({
      title: 'Borrar definitivamente',
      description: `"${item.label}" se eliminará para siempre, junto con sus datos asociados. Esta acción no se puede deshacer.`,
      confirmText: 'Borrar',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await purgeMut.mutateAsync({ type: item.type, id: item.id });
          addNotification({
            type: 'success',
            title: 'Borrado definitivo',
            message: `"${item.label}" se ha eliminado permanentemente.`,
          });
        } catch (e) {
          addNotification({
            type: 'error',
            title: 'No se pudo borrar',
            message: trashErrorMessage(
              e,
              'Puede que tenga elementos que dependen de él.',
            ),
          });
          throw e; // mantiene el diálogo abierto para reintentar
        }
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl tracking-tight text-[var(--on-surface)]">
          Papelera
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Recupera elementos eliminados o bórralos definitivamente. Lo que
          borras llega aquí primero; el borrado definitivo no se puede deshacer.
        </p>
      </header>

      {/* Selector de tipo */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TYPES.map(({ id, label, icon: Icon }) => {
          const active = id === type;
          return (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-transparent bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--on-surface)]/10'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Listado */}
      <section className="overflow-hidden rounded-[28px] border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
        {error ? (
          <div className="p-8 text-center text-sm text-[var(--error)]">
            Error al cargar la papelera: {(error as Error).message}
          </div>
        ) : itemsLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <activeType.icon className="mx-auto mb-3 h-8 w-8 text-[var(--on-surface-variant)]" />
            <p className="text-sm text-[var(--on-surface-variant)]">
              La papelera de <strong>{activeType.label.toLowerCase()}</strong>{' '}
              está vacía.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--outline-variant)]">
            {items.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 px-4 py-3 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--on-surface)]">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-[var(--on-surface-variant)]">
                    {[item.secondary, `Eliminado ${relativeTime(item.deletedAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={restoreMut.isPending}
                    title="Recuperar"
                    aria-label="Recuperar"
                    className="inline-flex items-center justify-center rounded-full p-2 text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handlePurge(item)}
                    disabled={purgeMut.isPending}
                    title="Borrar definitivamente"
                    aria-label="Borrar definitivamente"
                    className="inline-flex items-center justify-center rounded-full p-2 text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
