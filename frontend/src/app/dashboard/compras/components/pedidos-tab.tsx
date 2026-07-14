'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useSuppliers } from '@/hooks/use-suppliers';
import {
  ORDER_STATUS_META,
  usePurchaseOrders,
  type PurchaseOrderStatus,
} from '@/hooks/use-purchase-orders';

const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

export function PedidosTab() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('');
  const [supplierId, setSupplierId] = useState('');
  const [search, setSearch] = useState('');

  const { data: suppliers } = useSuppliers({ isActive: true });
  const { data, isLoading, error } = usePurchaseOrders({
    page,
    limit: 25,
    status,
    supplierId,
    search: search.trim() || undefined,
  });

  const orders = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Buscar por número (PED-...)"
            className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-2 pl-9 pr-3 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PurchaseOrderStatus | '');
            resetPage();
          }}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ORDER_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            resetPage();
          }}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
        >
          <option value="">Todos los proveedores</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando pedidos...
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
          No se pudieron cargar los pedidos: {error.message}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 text-center text-[var(--on-surface-variant)]">
          No hay pedidos todavía. Crea una lista de compra y genera tu primer
          pedido desde la pestaña Listas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--outline-variant)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[var(--surface-container)] text-left text-[var(--on-surface-variant)]">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Local</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Líneas</th>
                <th className="px-4 py-3 text-right font-medium">Total est.</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const meta = ORDER_STATUS_META[order.status];
                return (
                  <tr
                    key={order.id}
                    onClick={() =>
                      router.push(`/dashboard/compras/pedidos/${order.id}`)
                    }
                    className="cursor-pointer border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] transition hover:bg-[var(--surface-container-low)]"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--on-surface)]">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface)]">
                      {order.supplier?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                      {order.location?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--on-surface-variant)]">
                      {order._count?.lines ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--on-surface)]">
                      {euro.format(order.expectedTotal)}
                    </td>
                    <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                      {new Date(order.createdAt).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-[var(--on-surface-variant)]">
          <span>
            Página {page} de {totalPages} · {data?.total ?? 0} pedidos
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
            className="rounded-lg border border-[var(--outline-variant)] p-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            className="rounded-lg border border-[var(--outline-variant)] p-2 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
