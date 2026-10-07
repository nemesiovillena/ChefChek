'use client';

import { AlertTriangle, Loader2, PackageMinus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useApplyCuinerSales, useCuinerSalesPreview, useRequeueCuinerSales } from '@/hooks/use-cuiner';
import { CUINER_DISH_TIPO_LABELS } from '@/lib/cuiner-types';

const fmtQty = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES');

/**
 * Ventas del TPV de Cuiner pendientes de descontar del stock de ChefChek.
 * Muestra lo que se va a descontar (en formatos de compra, como suma el
 * albarán) y lo aplica solo cuando el usuario lo confirma.
 */
export function CuinerSalesTab() {
  const { data, isLoading, error } = useCuinerSalesPreview();
  const apply = useApplyCuinerSales();
  const requeue = useRequeueCuinerSales();
  const confirm = useConfirm();
  const notify = useNotification();

  async function handleApply() {
    if (!data) return;
    const ok = await confirm({
      title: 'Aplicar ventas al stock',
      description: `Se descontarán ${data.consumption.length} artículos por ${data.linesToApply} líneas de venta. Las ${data.linesUnmapped} líneas sin enlazar quedarán apartadas para más adelante.`,
      confirmText: 'Aplicar ventas',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      const res = await apply.mutateAsync();
      notify({
        type: 'success',
        title: 'Ventas aplicadas',
        message: `${res.applied} líneas descontadas en ${res.movements} movimientos de stock.`,
      });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudieron aplicar', message: err instanceof Error ? err.message : '' });
    }
  }

  async function handleRequeue() {
    try {
      const res = await requeue.mutateAsync();
      notify({ type: 'success', title: 'Listo', message: `${res.requeued} líneas vuelven a estar pendientes.` });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : '' });
    }
  }

  if (isLoading) return <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!data) return null;

  const nothingPending = data.pendingLines === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          {nothingPending ? (
            'No hay ventas pendientes de aplicar.'
          ) : (
            <>
              {data.pendingLines} líneas de venta pendientes
              {data.dateFrom && data.dateTo && ` (del ${fmtDate(data.dateFrom)} al ${fmtDate(data.dateTo)})`}:{' '}
              {data.linesToApply} con receta o artículo enlazado, {data.linesUnmapped} sin enlazar.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleRequeue} disabled={requeue.isPending} className="min-h-[44px]">
            <RotateCcw className="h-4 w-4" /> Reintentar las sin enlazar
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={data.linesToApply === 0 || apply.isPending}
            className="min-h-[44px]"
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageMinus className="h-4 w-4" />} Aplicar ventas
          </Button>
        </div>
      </div>

      {data.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
        </p>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 font-semibold">Se descontará del stock</h3>
          <p className="mb-2 text-xs text-gray-500">En formatos de compra, la misma unidad en la que suma el albarán.</p>
          <ul className="divide-y divide-gray-200 text-sm dark:divide-zinc-800">
            {data.consumption.map((c) => (
              <li key={c.productId} className="flex justify-between gap-3 py-2">
                <span>{c.name}</span>
                <span className={`font-mono ${c.formats < 0 ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                  {c.formats < 0 ? `+${fmtQty(-c.formats)}` : `−${fmtQty(c.formats)}`}
                </span>
              </li>
            ))}
            {data.consumption.length === 0 && <li className="py-3 text-gray-500">Nada que descontar.</li>}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Vendido sin enlazar (no descontará)</h3>
          <p className="mb-2 text-xs text-gray-500">Enlázalos en la pestaña Platos y pulsa «Reintentar las sin enlazar».</p>
          <ul className="divide-y divide-gray-200 text-sm dark:divide-zinc-800">
            {data.unmappedDishes.slice(0, 50).map((d) => (
              <li key={`${d.tipo}-${d.producto}`} className="flex justify-between gap-3 py-2">
                <span>
                  {d.nombre} <span className="text-xs text-gray-500">({CUINER_DISH_TIPO_LABELS[d.tipo] ?? d.tipo})</span>
                </span>
                <span className="font-mono">{fmtQty(d.unidades)}</span>
              </li>
            ))}
            {data.unmappedDishes.length === 0 && <li className="py-3 text-gray-500">Todo lo vendido está enlazado.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
