'use client';

import Link from 'next/link';
import { FileStack } from 'lucide-react';
import type { PurchaseOrder } from '@/hooks/use-purchase-orders';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const ALBARAN_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  REVISADO: 'Revisado',
  CONFIRMADO: 'Confirmado',
  ARCHIVADO: 'Archivado',
};

/**
 * Discrepancias pedido vs. recibido (conciliación con albaranes vinculados,
 * ver docs/pdr-modulo-compras.md §F4): resalta diferencias de cantidad y
 * precio, y enlaza a los albaranes que han conciliado con este pedido.
 */
export function ReceptionSection({ order }: { order: PurchaseOrder }) {
  const lines = order.lines ?? [];
  const albaranes = order.albaranes ?? [];

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-[var(--on-surface)]">
        Recepción y discrepancias
      </h2>

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
                receivedQuantity !== null && receivedQuantity !== line.quantity;
              const priceMismatch =
                line.receivedPrice != null &&
                line.expectedPrice != null &&
                line.receivedPrice !== line.expectedPrice;

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
            {albaranes.map((albaran) => (
              <li key={albaran.id}>
                <Link
                  href={`/dashboard/albaranes/${albaran.id}/resumen`}
                  className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] transition hover:bg-[var(--surface-container-low)]"
                >
                  <FileStack className="h-4 w-4 text-[var(--on-surface-variant)]" />
                  {albaran.albaranNumber || albaran.internalNumber}
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    {ALBARAN_STATUS_LABEL[albaran.status] ?? albaran.status} ·{' '}
                    {new Date(albaran.date).toLocaleDateString('es-ES')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
