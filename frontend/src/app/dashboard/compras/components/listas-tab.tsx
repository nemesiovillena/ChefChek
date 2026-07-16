'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useSuppliers } from '@/hooks/use-suppliers';
import {
  fetchSupplierCatalogProducts,
  useCreatePurchaseList,
  useDeletePurchaseList,
  useGenerateOrderFromList,
  usePurchaseLists,
  useUpdatePurchaseList,
  type PurchaseList,
  type SupplierCatalogProduct,
} from '@/hooks/use-purchase-lists';
import { ProductSearchInput } from './product-search-input';

export function ListasTab({ canManage }: { canManage: boolean }) {
  const { data: lists, isLoading, error } = usePurchaseLists();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const createMut = useCreatePurchaseList();
  const addNotification = useNotification();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newSupplierId, setNewSupplierId] = useState('');
  const [isPrefillingCatalog, setIsPrefillingCatalog] = useState(false);
  // Catálogo del proveedor recién traído para la lista creada, aún sin
  // guardar: se muestra como propuesta sin marcar (el usuario elige qué
  // incluir). No se persiste nada hasta "Guardar checklist".
  const [pendingCatalog, setPendingCatalog] = useState<{
    listId: string;
    products: SupplierCatalogProduct[];
  } | null>(null);

  const list = (lists ?? []).find((l) => l.id === selectedId) ?? null;

  const handleCreate = async () => {
    if (!newName.trim() || !newSupplierId) return;
    setIsPrefillingCatalog(true);
    try {
      const catalog = await fetchSupplierCatalogProducts(newSupplierId);
      const created = await createMut.mutateAsync({
        name: newName.trim(),
        supplierId: newSupplierId,
      });
      setNewName('');
      setSelectedId(created.id);
      setPendingCatalog({ listId: created.id, products: catalog });
      if (catalog.length === 0) {
        addNotification({
          type: 'warning',
          title: 'Lista creada vacía',
          message: 'El proveedor no tiene artículos asignados todavía.',
        });
      } else {
        addNotification({
          type: 'success',
          title: 'Lista creada',
          message: `${catalog.length} artículos del catálogo de ${created.supplier?.name ?? 'el proveedor'}. Marca los que quieras pedir y guarda el checklist.`,
        });
      }
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo crear la lista',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    } finally {
      setIsPrefillingCatalog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando listas...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
        No se pudieron cargar las listas: {error.message}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      <aside className="space-y-4">
        {canManage && (
          <div className="space-y-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
            <h2 className="text-sm font-semibold text-[var(--on-surface)]">Nueva lista</h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre (p. ej. Semanal pescado)"
              className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
            <select
              value={newSupplierId}
              onChange={(e) => setNewSupplierId(e.target.value)}
              className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
            >
              <option value="">Proveedor...</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newSupplierId || createMut.isPending || isPrefillingCatalog}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMut.isPending || isPrefillingCatalog ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear lista
            </button>
          </div>
        )}

        <ul className="space-y-2">
          {(lists ?? []).map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setSelectedId(l.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  l.id === selectedId
                    ? 'border-[var(--primary)] bg-[var(--surface-container-low)]'
                    : 'border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)]'
                }`}
              >
                <p className="flex items-center gap-2 font-medium text-[var(--on-surface)]">
                  <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                  {l.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
                  {l.supplier?.name} · {l.items.length} artículos
                </p>
              </button>
            </li>
          ))}
          {(lists ?? []).length === 0 && (
            <li className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm text-[var(--on-surface-variant)]">
              Sin listas todavía.
            </li>
          )}
        </ul>
      </aside>

      {list ? (
        // key fuerza remontar el editor al cambiar de lista (estado limpio)
        <ListEditor
          key={list.id}
          list={list}
          canManage={canManage}
          pendingCatalog={
            pendingCatalog?.listId === list.id ? pendingCatalog.products : undefined
          }
          onSaved={() => setPendingCatalog(null)}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 text-center text-[var(--on-surface-variant)]">
          Selecciona una lista para ver su checklist o crea una nueva.
        </div>
      )}
    </div>
  );
}

interface EditorRow {
  productId: string;
  name: string;
  unitHint: string;
  quantity: number;
  checked: boolean;
}

function ListEditor({
  list,
  canManage,
  pendingCatalog,
  onSaved,
}: {
  list: PurchaseList;
  canManage: boolean;
  /** Catálogo recién traído para una lista creada sin guardar todavía. */
  pendingCatalog?: SupplierCatalogProduct[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const addNotification = useNotification();
  const updateMut = useUpdatePurchaseList();
  const deleteMut = useDeletePurchaseList();
  const generateMut = useGenerateOrderFromList();

  // Si hay catálogo pendiente (lista recién creada, sin artículos guardados
  // aún), se muestra como propuesta sin marcar: el usuario elige qué
  // incluir. Si la lista ya tiene artículos guardados, esos son la verdad y
  // aparecen marcados.
  const [rows, setRows] = useState<EditorRow[]>(
    pendingCatalog && list.items.length === 0
      ? pendingCatalog.map((p) => ({
          productId: p.id,
          name: p.name,
          unitHint: p.purchaseFormat || p.referenceUnit || '',
          quantity: 1,
          checked: false,
        }))
      : list.items.map((item) => ({
          productId: item.productId,
          name: item.product?.name ?? item.productId,
          unitHint: item.product?.purchaseFormat || item.product?.referenceUnit || '',
          quantity: item.defaultQuantity,
          checked: true,
        })),
  );

  const notifyError = (e: unknown, fallback: string) =>
    addNotification({
      type: 'error',
      title: 'Error',
      message: e instanceof Error ? e.message : fallback,
    });

  const [isSyncing, setIsSyncing] = useState(false);

  // El check determina pertenencia a la lista: solo se persiste lo marcado.
  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: list.id,
        data: {
          items: rows
            .filter((r) => r.checked)
            .map((r) => ({
              productId: r.productId,
              defaultQuantity: r.quantity,
            })),
        },
      });
      addNotification({ type: 'success', title: 'Lista guardada', message: list.name });
      onSaved();
    } catch (e) {
      notifyError(e, 'No se pudo guardar la lista');
    }
  };

  // Trae el catálogo del proveedor y añade como filas nuevas (sin marcar) los
  // artículos que aún no están en el checklist; no toca las filas existentes.
  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    try {
      const catalog = await fetchSupplierCatalogProducts(list.supplierId);
      const existingIds = new Set(rows.map((r) => r.productId));
      const missing = catalog.filter((p) => !existingIds.has(p.id));
      if (missing.length === 0) {
        addNotification({
          type: 'info',
          title: 'Sin artículos nuevos',
          message: 'El checklist ya cubre todo el catálogo del proveedor.',
        });
        return;
      }
      setRows((prev) => [
        ...prev,
        ...missing.map((p) => ({
          productId: p.id,
          name: p.name,
          unitHint: p.purchaseFormat || p.referenceUnit || '',
          quantity: 1,
          checked: false,
        })),
      ]);
      addNotification({
        type: 'success',
        title: 'Catálogo sincronizado',
        message: `${missing.length} artículo(s) nuevo(s) añadidos. Guarda el checklist para persistirlos.`,
      });
    } catch (e) {
      notifyError(e, 'No se pudo sincronizar con el catálogo del proveedor');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Eliminar la lista "${list.name}"`,
      description: 'Los pedidos ya generados no se ven afectados.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(list.id);
    } catch (e) {
      notifyError(e, 'No se pudo eliminar la lista');
    }
  };

  const generate = async (withSelection: boolean) => {
    const selection = rows.filter((r) => r.checked);
    if (withSelection && selection.length === 0) {
      addNotification({
        type: 'warning',
        title: 'Nada seleccionado',
        message: 'Marca al menos un artículo del checklist.',
      });
      return;
    }
    try {
      const order = await generateMut.mutateAsync({
        listId: list.id,
        ...(withSelection
          ? {
              items: selection.map((r) => ({
                productId: r.productId,
                quantity: r.quantity,
              })),
            }
          : {}),
      });
      addNotification({
        type: 'success',
        title: `Pedido ${order.orderNumber} creado`,
        message: 'Borrador listo para revisar y enviar.',
      });
      router.push(`/dashboard/compras/pedidos/${order.id}`);
    } catch (e) {
      notifyError(e, 'No se pudo generar el pedido');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      {/* div, no <header>: la regla global header:not(.fixed){display:none} oculta cualquier <header> que no sea el navbar fijo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">{list.name}</h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Proveedor: {list.supplier?.name}
            {list.location?.name ? ` · Local: ${list.location.name}` : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-container)]"
          >
            <Trash2 className="h-4 w-4" /> Eliminar lista
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.productId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--outline-variant)] px-3 py-2"
          >
            <input
              type="checkbox"
              checked={row.checked}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) =>
                    i === index ? { ...r, checked: e.target.checked } : r,
                  ),
                )
              }
              aria-label={`Incluir ${row.name}`}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--on-surface)]">
              {row.name}
            </span>
            <input
              type="number"
              min={0.001}
              step="any"
              value={row.quantity}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) =>
                    i === index
                      ? { ...r, quantity: Number(e.target.value) || 0 }
                      : r,
                  ),
                )
              }
              className="w-24 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1 text-right text-sm text-[var(--on-surface)]"
            />
            <span className="w-20 truncate text-xs text-[var(--on-surface-variant)]">
              {row.unitHint}
            </span>
            {canManage && (
              <button
                onClick={() =>
                  setRows((prev) => prev.filter((_, i) => i !== index))
                }
                aria-label={`Quitar ${row.name}`}
                className="rounded-lg p-1.5 text-[var(--error)] hover:bg-[var(--error-container)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--outline-variant)] p-4 text-center text-sm text-[var(--on-surface-variant)]">
            Añade artículos con el buscador.
          </li>
        )}
      </ul>

      {canManage && (
        <ProductSearchInput
          supplierId={list.supplierId}
          excludeIds={rows.map((r) => r.productId)}
          onSelect={(product) =>
            setRows((prev) => [
              ...prev,
              {
                productId: product.id,
                name: product.name,
                unitHint: product.purchaseFormat || product.referenceUnit || '',
                quantity: 1,
                checked: true,
              },
            ])
          }
        />
      )}

      {canManage && (
        <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--outline-variant)] pt-4">
          <button
            onClick={handleSave}
            disabled={updateMut.isPending}
            className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            Guardar checklist
          </button>
          <button
            onClick={handleSyncCatalog}
            disabled={isSyncing}
            title="Añade al checklist los artículos que el proveedor haya incorporado desde que se creó la lista"
            className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar con catálogo
          </button>
          <button
            onClick={() => generate(true)}
            disabled={generateMut.isPending}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {generateMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Generar pedido (selección)
          </button>
          <button
            onClick={() => generate(false)}
            disabled={generateMut.isPending}
            title="Toda la lista con cantidades sugeridas según stock mín/máx"
            className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            Con cantidades sugeridas
          </button>
        </footer>
      )}
    </section>
  );
}
