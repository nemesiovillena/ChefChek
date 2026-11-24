'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, FileStack, Link2, Upload } from 'lucide-react';
import {
  type PurchaseOrder,
  type PurchaseOrderLine,
  useInvalidateOrders,
} from '@/hooks/use-purchase-orders';
import { useSectionAccess } from '@/features/modules/hooks/use-section-access';
import { LinkExistingAlbaranDialog } from '@/components/albaranes/link-existing-albaran-dialog';
import { normalizeUnitSymbol } from '@/lib/unit-symbols';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// Productos a peso/volumen (kg, L) nunca llegan al gramo exacto pedido —
// una igualdad estricta los marca en rojo por variación normal de pesaje.
// Unidades (und) sí deben coincidir exacto: no hay "0.3 unidades" de sobra.
const QUANTITY_TOLERANCE_PERCENT = 0.02;
const QUANTITY_TOLERANCE_ABSOLUTE = 0.01; // kg/L de margen mínimo (evita falsos positivos en pedidos pequeños)
// Líneas conciliadas cruzando magnitudes (pedido en ud, albarán en kg/L o al
// revés): la conversión usa el peso medio aprendido del artículo, que arrastra
// redondeo — mismo criterio que la cobertura de estado en backend.
const CROSS_CATEGORY_TOLERANCE_PERCENT = 0.1;
const CROSS_CATEGORY_TOLERANCE_ABSOLUTE = 0.05; // ud de margen mínimo
const PRICE_TOLERANCE_ABSOLUTE = 0.01; // € de margen por redondeo flotante, no oculta subidas reales

function isQuantityMismatch(
  unit: string | null | undefined,
  ordered: number,
  received: number,
  sourceUnit?: string | null,
) {
  const symbol = unit ? normalizeUnitSymbol(unit) : null;
  const sourceSymbol = sourceUnit ? normalizeUnitSymbol(sourceUnit) : null;
  if (
    symbol &&
    sourceSymbol &&
    symbol !== sourceSymbol &&
    (symbol === 'und' || sourceSymbol === 'und')
  ) {
    const allowedDelta = Math.max(
      ordered * CROSS_CATEGORY_TOLERANCE_PERCENT,
      CROSS_CATEGORY_TOLERANCE_ABSOLUTE,
    );
    return Math.abs(received - ordered) > allowedDelta;
  }
  if (symbol === 'kg' || symbol === 'L') {
    const allowedDelta = Math.max(ordered * QUANTITY_TOLERANCE_PERCENT, QUANTITY_TOLERANCE_ABSOLUTE);
    return Math.abs(received - ordered) > allowedDelta;
  }
  return received !== ordered;
}

/** Etiqueta corta de unidad para la celda: símbolo normalizado o texto breve. */
function unitLabel(unit: string | null | undefined) {
  const symbol = unit ? normalizeUnitSymbol(unit) : null;
  if (symbol) return symbol === 'und' ? 'ud' : symbol;
  const raw = (unit || '').trim();
  return raw.length > 0 && raw.length <= 12 ? raw : '';
}

/** Cantidad legible: sin ceros de precisión flotante (7.4000000001 → 7.4). */
function formatQty(qty: number) {
  return Number(qty.toFixed(3));
}

function qtyWithUnit(qty: number, unit: string | null | undefined) {
  const label = unitLabel(unit);
  return label ? `${formatQty(qty)} ${label}` : String(formatQty(qty));
}

function isPriceMismatch(expected: number, received: number) {
  return Math.abs(received - expected) > PRICE_TOLERANCE_ABSOLUTE;
}

type ArrivalState =
  | { kind: 'none' }
  | { kind: 'pending-confirm' }
  | { kind: 'missing' }
  | { kind: 'short'; missingQty: number };

/**
 * Qué pasa con la línea respecto a lo recibido. Solo se habla de faltas
 * cuando ya hay albarán vinculado (antes, el pedido simplemente no ha llegado).
 */
function arrivalState(line: PurchaseOrderLine, hasAlbaran: boolean): ArrivalState {
  if (!hasAlbaran) return { kind: 'none' };
  const received = line.receivedQuantity ?? null;
  if (received === null || received <= 0) {
    return line.inUnconfirmedAlbaran ? { kind: 'pending-confirm' } : { kind: 'missing' };
  }
  if (line.covered === false && received < line.quantity) {
    return { kind: 'short', missingQty: line.quantity - received };
  }
  return { kind: 'none' };
}

const ALBARAN_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  REVISADO: { label: 'Pedido recibido', className: 'bg-blue-100 text-blue-800' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
  ARCHIVADO: { label: 'Archivado', className: 'bg-surface-subtle text-text-default' },
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
  // Vincular pide el listado de Albaranes: sin esa sección daría 403.
  const { canEnter } = useSectionAccess();
  const canLinkAlbaran = canUploadAlbaran && canEnter('albaranes');
  const [linkOpen, setLinkOpen] = useState(false);
  const invalidateOrders = useInvalidateOrders();
  const queryClient = useQueryClient();
  const hasAlbaran = albaranes.length > 0;
  const shortfalls = lines
    .map((line) => ({ line, state: arrivalState(line, hasAlbaran) }))
    .filter(({ state }) => state.kind === 'missing' || state.kind === 'short');

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
        <div className="flex flex-wrap items-center gap-2">
          {canLinkAlbaran && (
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-3 py-1.5 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
            >
              <Link2 className="h-4 w-4" /> Vincular albarán ya subido
            </button>
          )}
          {canUploadAlbaran && (
            <Link
              href={`/dashboard/albaranes/subir?purchaseOrderId=${order.id}`}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> Subir albarán
            </Link>
          )}
        </div>
        {canLinkAlbaran && (
          <LinkExistingAlbaranDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            purchaseOrderId={order.id}
            supplierId={order.supplierId}
            onSuccess={() => {
              invalidateOrders();
              queryClient.invalidateQueries({ queryKey: ['albaranes'] });
            }}
          />
        )}
      </div>

      {shortfalls.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {order.status === 'RECIBIDO' ? 'Recibido con faltas' : 'Falta mercancía'}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {shortfalls.map(({ line, state }) => (
                <li key={line.id}>
                  {line.product?.name ?? line.productId}
                  {' · '}
                  {state.kind === 'short'
                    ? `faltan ${qtyWithUnit(state.missingQty, line.unit)}`
                    : `no ha llegado (${qtyWithUnit(line.quantity, line.unit)})`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
                isQuantityMismatch(line.unit, line.quantity, receivedQuantity, line.receivedSourceUnit);
              const priceMismatch =
                line.receivedPrice != null &&
                line.expectedPrice != null &&
                isPriceMismatch(line.expectedPrice, line.receivedPrice);
              const orderedLabel = unitLabel(line.unit);
              const state = arrivalState(line, hasAlbaran);

              return (
                <tr
                  key={line.id}
                  className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                >
                  <td className="px-4 py-2 text-[var(--on-surface)]">
                    {line.product?.name ?? line.productId}
                  </td>
                  <td className="px-4 py-2 text-right text-[var(--on-surface)]">
                    {formatQty(line.quantity)}
                    {orderedLabel && <span className="ml-1 text-xs text-[var(--on-surface-variant)]">{orderedLabel}</span>}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      quantityMismatch
                        ? 'rounded bg-[var(--error-container)] text-[var(--on-error-container)]'
                        : 'text-[var(--on-surface)]'
                    }`}
                  >
                    {receivedQuantity != null ? (
                      <>
                        {formatQty(receivedQuantity)}
                        {orderedLabel && <span className="ml-1 text-xs font-normal opacity-70">{orderedLabel}</span>}
                        {line.receivedSourceQuantity != null && line.receivedSourceUnit && (
                          <span className="block text-xs font-normal text-[var(--on-surface-variant)]">
                            albarán: {formatQty(line.receivedSourceQuantity)} {line.receivedSourceUnit}
                          </span>
                        )}
                      </>
                    ) : state.kind === 'missing' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        No ha llegado
                      </span>
                    ) : state.kind === 'pending-confirm' ? (
                      <span className="text-xs font-normal text-[var(--on-surface-variant)]">
                        En albarán, sin confirmar
                      </span>
                    ) : (
                      '—'
                    )}
                    {state.kind === 'short' && (
                      <span className="block text-xs font-normal">
                        faltan {formatQty(state.missingQty)} {orderedLabel}
                      </span>
                    )}
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
                className: 'bg-surface-subtle text-text-default',
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
