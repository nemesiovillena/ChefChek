'use client';

import Link from 'next/link';
import { CheckCircle2, CircleAlert, FileStack, Upload } from 'lucide-react';
import type { PurchaseOrder } from '@/hooks/use-purchase-orders';
import { normalizeUnitSymbol } from '@/lib/unit-symbols';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// Productos a peso/volumen (kg, L) nunca llegan al gramo exacto pedido —
// una igualdad estricta los marca en rojo por variación normal de pesaje.
// Unidades (und) sí deben coincidir exacto: no hay "0.3 unidades" de sobra.
const QUANTITY_TOLERANCE_PERCENT = 0.02;
const QUANTITY_TOLERANCE_ABSOLUTE = 0.01; // kg/L de margen mínimo (evita falsos positivos en pedidos pequeños)
const PRICE_TOLERANCE_ABSOLUTE = 0.01; // € de margen por redondeo flotante, no oculta subidas reales

function isQuantityMismatch(unit: string | null | undefined, ordered: number, received: number) {
  const symbol = unit ? normalizeUnitSymbol(unit) : null;
  if (symbol === 'kg' || symbol === 'L') {
    const allowedDelta = Math.max(ordered * QUANTITY_TOLERANCE_PERCENT, QUANTITY_TOLERANCE_ABSOLUTE);
    return Math.abs(received - ordered) > allowedDelta;
  }
  return received !== ordered;
}

function isPriceMismatch(expected: number, received: number) {
  return Math.abs(received - expected) > PRICE_TOLERANCE_ABSOLUTE;
}

const ALBARAN_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  REVISADO: { label: 'Revisado', className: 'bg-blue-100 text-blue-800' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  ARCHIVADO: { label: 'Archivado', className: 'bg-gray-100 text-gray-700' },
};

/**
 * Discrepancias pedido vs. recibido (conciliación con albaranes vinculados,
 * ver docs/pdr-modulo-compras.md §F4): resalta diferencias de cantidad y
 * precio, y enlaza a los albaranes que han conciliado con este pedido.
 */
export function ReceptionSection({ order }: { order: PurchaseOrder }) {
  const lines = order.lines ?? [];
  const albaranes = order.albaranes ?? [];
  const canUploadAlbaran = order.status === 'ENVIADO' || order.status === 'RECIBIDO_PARCIAL';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--on-surface)]">
            Recepción y discrepancias
          </h2>
          {albaranes.length > 0 ? (
            <Link
              href={`/dashboard/albaranes/${albaranes[0].id}/resumen?returnTo=${encodeURIComponent(`/dashboard/compras/pedidos/${order.id}`)}`}
              className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 transition hover:bg-green-200"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Albarán vinculado
            </Link>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              <CircleAlert className="h-3.5 w-3.5" /> Sin albarán subido
            </span>
          )}
        </div>
        {canUploadAlbaran && (
          <Link
            href={`/dashboard/albaranes/subir?purchaseOrderId=${order.id}`}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            <Upload className="h-4 w-4" /> Subir albarán
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--outline-variant)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-[var(--surface-container)] text-left text-[var(--on-surface-variant)]">
              <th className="px-4 py-3 font-medium">Artículo</th>
              <th className="px-4 py-3 text-right font-medium">Pedido</th>
              <th className="px-4 py-3 text-right font-medium">Recibido</th>
              <th className="px-4 py-3 text-right font-medium">Precio est.</th>
              <th className="px-4 py-3 text-right font-medium">Precio recibido</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const receivedQuantity = line.receivedQuantity ?? null;
              const quantityMismatch =
                receivedQuantity !== null &&
                isQuantityMismatch(line.unit, line.quantity, receivedQuantity);
              const priceMismatch =
                line.receivedPrice != null &&
                line.expectedPrice != null &&
                isPriceMismatch(line.expectedPrice, line.receivedPrice);

              return (
                <tr
                  key={line.id}
                  className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                >
                  <td className="px-4 py-2 text-[var(--on-surface)]">
                    {line.product?.name ?? line.productId}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--on-surface)]">
                    {line.quantity}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      quantityMismatch
                        ? 'rounded bg-[var(--error-container)] text-[var(--on-error-container)]'
                        : 'text-[var(--on-surface)]'
                    }`}
                  >
                    {receivedQuantity ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--on-surface-variant)]">
                    {line.expectedPrice != null ? euro.format(line.expectedPrice) : '—'}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      priceMismatch
                        ? 'rounded bg-[var(--error-container)] text-[var(--on-error-container)]'
                        : 'text-[var(--on-surface)]'
                    }`}
                  >
                    {line.receivedPrice != null ? euro.format(line.receivedPrice) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {order.receivedTotal != null && (
            <tfoot>
              <tr className="border-t border-[var(--outline-variant)] bg-[var(--surface-container)]">
                <td colSpan={4} className="px-4 py-3 text-right font-medium text-[var(--on-surface-variant)]">
                  Total recibido
                </td>
                <td className="px-4 py-3 text-right text-base font-semibold text-[var(--on-surface)]">
                  {euro.format(order.receivedTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {albaranes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--on-surface-variant)]">
            Albaranes vinculados
          </p>
          <ul className="space-y-1">
            {albaranes.map((albaran) => {
              const statusMeta = ALBARAN_STATUS_META[albaran.status] ?? {
                label: albaran.status,
                className: 'bg-gray-100 text-gray-700',
              };
              return (
                <li key={albaran.id}>
                  <Link
                    href={`/dashboard/albaranes/${albaran.id}/resumen?returnTo=${encodeURIComponent(`/dashboard/compras/pedidos/${order.id}`)}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] transition hover:bg-[var(--surface-container-low)]"
                  >
                    <FileStack className="h-4 w-4 text-[var(--on-surface-variant)]" />
                    {albaran.albaranNumber || albaran.internalNumber}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {new Date(albaran.date).toLocaleDateString('es-ES')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
