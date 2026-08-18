'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  FileText,
  Loader2,
  PackageCheck,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  ORDER_STATUS_META,
  useDeletePurchaseOrder,
  usePurchaseOrder,
  useReportOrderIncident,
  useRevertPurchaseOrderStatus,
  useTransitionPurchaseOrder,
  useUpdatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '@/hooks/use-purchase-orders';
import { ProductSearchInput } from '../../components/product-search-input';
import { SendOrderDialog } from '../../components/send-order-dialog';
import { ReceptionSection } from '../../components/reception-section';
import { openOrderPdf } from '@/hooks/use-order-sending';

const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

/**
 * Acciones de transición visibles por estado (espejo de la máquina backend).
 * Marcar ENVIADO no aparece aquí: se hace desde el diálogo "Enviar al
 * proveedor" (elige canal y registra sentVia + evento SENT).
 */
const STATUS_ACTIONS: Record<
  PurchaseOrderStatus,
  { to: PurchaseOrderStatus; label: string; icon: typeof Send; primary?: boolean }[]
> = {
  BORRADOR: [
    { to: 'PENDIENTE_ENVIO', label: 'Marcar pendiente de envío', icon: Check },
    { to: 'CANCELADO', label: 'Cancelar', icon: Ban },
  ],
  PENDIENTE_ENVIO: [
    { to: 'BORRADOR', label: 'Volver a borrador', icon: ArrowLeft },
    { to: 'CANCELADO', label: 'Cancelar', icon: Ban },
  ],
  ENVIADO: [
    { to: 'RECIBIDO', label: 'Recibido', icon: PackageCheck, primary: true },
    { to: 'CANCELADO', label: 'Cancelar', icon: Ban },
  ],
  RECIBIDO_PARCIAL: [
    { to: 'RECIBIDO', label: 'Recibido', icon: PackageCheck, primary: true },
  ],
  RECIBIDO: [],
  CANCELADO: [],
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Pedido creado',
  STATUS_CHANGED: 'Cambio de estado',
  SENT: 'Enviado al proveedor',
  INCIDENT_REPORTED: 'Pedido erróneo',
};

/** Estados desde los que un ADMIN puede forzar la vuelta a Borrador (espejo de REVERTIBLE_STATUSES backend). */
const REVERTIBLE_STATUSES: PurchaseOrderStatus[] = [
  'ENVIADO',
  'RECIBIDO_PARCIAL',
  'RECIBIDO',
  'CANCELADO',
];
const REVERT_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const router = useRouter();
  const { data: order, isLoading, error } = usePurchaseOrder(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[var(--on-surface-variant)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando pedido...
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
          No se pudo cargar el pedido{error ? `: ${error.message}` : ''}.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button
        onClick={() => router.push('/dashboard/compras')}
        className="mb-4 flex items-center gap-1 text-sm text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Compras
      </button>
      {/* key: remonta el editor si el pedido cambia tras invalidación */}
      <OrderDetail key={`${order.id}-${order.status}`} order={order} />
    </div>
  );
}

function OrderDetail({ order }: { order: PurchaseOrder }) {
  const router = useRouter();
  const confirm = useConfirm();
  const addNotification = useNotification();
  const { user } = useAuth();
  const updateMut = useUpdatePurchaseOrder();
  const transitionMut = useTransitionPurchaseOrder();
  const deleteMut = useDeletePurchaseOrder();
  const revertMut = useRevertPurchaseOrderStatus();
  const revertReasonRef = useRef<HTMLTextAreaElement>(null);
  const closeReasonRef = useRef<HTMLTextAreaElement>(null);
  const incidentMut = useReportOrderIncident();
  const incidentDescRef = useRef<HTMLTextAreaElement>(null);
  const incidentFileRef = useRef<HTMLInputElement>(null);

  const canRevert =
    REVERTIBLE_STATUSES.includes(order.status) &&
    !!user?.role &&
    REVERT_ROLES.includes(user.role);

  const isDraft = order.status === 'BORRADOR';
  const hasReception = ['ENVIADO', 'RECIBIDO_PARCIAL', 'RECIBIDO'].includes(
    order.status,
  );
  const meta = ORDER_STATUS_META[order.status];

  const [lines, setLines] = useState(
    (order.lines ?? []).map((line) => ({
      productId: line.productId,
      name: line.product?.name ?? line.productId,
      unit: line.unit ?? '',
      quantity: line.quantity,
      expectedPrice: line.expectedPrice,
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [notes, setNotes] = useState(order.notes ?? '');
  const [additionalItems, setAdditionalItems] = useState(order.additionalItems ?? '');

  const canSend = order.status === 'BORRADOR' || order.status === 'PENDIENTE_ENVIO';

  const handlePdf = async () => {
    try {
      await openOrderPdf(order.id);
    } catch (e) {
      notifyError(e, 'No se pudo generar el PDF');
    }
  };

  const notifyError = (e: unknown, fallback: string) =>
    addNotification({
      type: 'error',
      title: 'Error',
      message: e instanceof Error ? e.message : fallback,
    });

  const total = lines.reduce(
    (sum, l) => sum + l.quantity * (l.expectedPrice ?? 0),
    0,
  );

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: order.id,
        data: {
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            expectedPrice: l.expectedPrice ?? undefined,
            unit: l.unit || undefined,
          })),
          notes,
          additionalItems,
        },
      });
      setDirty(false);
      addNotification({ type: 'success', title: 'Pedido guardado', message: order.orderNumber });
    } catch (e) {
      notifyError(e, 'No se pudo guardar el pedido');
    }
  };

  const handleTransition = async (to: PurchaseOrderStatus) => {
    if (to === 'CANCELADO') {
      const ok = await confirm({
        title: `Cancelar el pedido ${order.orderNumber}`,
        description: 'Un pedido cancelado no puede reactivarse.',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    // Cerrar un Recibido parcial es aceptar lo recibido como final (el
    // proveedor no completará el resto) — se pide motivo opcional para dejar
    // rastro de la decisión junto al usuario que la tomó (ya lo graba el evento).
    if (order.status === 'RECIBIDO_PARCIAL' && to === 'RECIBIDO') {
      await confirm({
        title: `Cerrar el pedido ${order.orderNumber}`,
        description:
          'El pedido pasará a Recibido aceptando lo entregado hasta ahora como definitivo. Úsalo cuando el proveedor no vaya a enviar el resto.',
        confirmText: 'Cerrar pedido',
        children: (
          <textarea
            ref={closeReasonRef}
            rows={3}
            placeholder="Motivo (opcional): ej. proveedor confirma que no queda stock..."
            className="w-full rounded-xl border border-[var(--outline-variant)] bg-transparent px-3 py-2 text-sm text-[var(--on-surface)]"
          />
        ),
        onConfirm: async () => {
          const reason = closeReasonRef.current?.value.trim() || undefined;
          try {
            await transitionMut.mutateAsync({ id: order.id, status: to, reason });
          } catch (e) {
            notifyError(e, 'No se pudo cerrar el pedido');
            throw e;
          }
          // Pedido cerrado: vuelve al listado en vez de dejar al usuario en
          // el detalle de un pedido que ya no necesita más acción.
          router.push('/dashboard/compras');
        },
      });
      return;
    }
    try {
      await transitionMut.mutateAsync({ id: order.id, status: to });
    } catch (e) {
      notifyError(e, 'No se pudo cambiar el estado');
    }
  };

  const handleRevert = async () => {
    await confirm({
      title: `Revertir ${order.orderNumber} a Borrador`,
      description:
        'Corrección administrativa: el pedido volverá a Borrador (podrás editarlo y reenviarlo). No usar si ya hubo una recepción real.',
      variant: 'destructive',
      confirmText: 'Revertir a Borrador',
      children: (
        <textarea
          ref={revertReasonRef}
          rows={3}
          placeholder="Motivo (mínimo 10 caracteres)..."
          className="w-full rounded-xl border border-[var(--outline-variant)] bg-transparent px-3 py-2 text-sm text-[var(--on-surface)]"
        />
      ),
      onConfirm: async () => {
        const reason = revertReasonRef.current?.value.trim() ?? '';
        if (reason.length < 10) {
          addNotification({
            type: 'error',
            title: 'Motivo requerido',
            message: 'Escribe al menos 10 caracteres explicando el motivo.',
          });
          throw new Error('reason too short');
        }
        try {
          await revertMut.mutateAsync({ id: order.id, reason });
        } catch (e) {
          notifyError(e, 'No se pudo revertir el pedido');
          throw e;
        }
      },
    });
  };

  const handleReportIncident = async () => {
    await confirm({
      title: `Pedido erróneo: ${order.orderNumber}`,
      description:
        'Describe qué ha ido mal (producto equivocado, cantidad incorrecta, etc.) y adjunta una foto si tienes. El pedido no cambia de estado.',
      variant: 'destructive',
      confirmText: 'Guardar incidencia',
      children: (
        <div className="space-y-3">
          <textarea
            ref={incidentDescRef}
            rows={3}
            placeholder="¿Qué ha ido mal? (mínimo 10 caracteres)"
            className="w-full rounded-xl border border-[var(--outline-variant)] bg-transparent px-3 py-2 text-sm text-[var(--on-surface)]"
          />
          <input
            ref={incidentFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="w-full text-sm text-[var(--on-surface-variant)]"
          />
        </div>
      ),
      onConfirm: async () => {
        const description = incidentDescRef.current?.value.trim() ?? '';
        if (description.length < 10) {
          addNotification({
            type: 'error',
            title: 'Descripción requerida',
            message: 'Describe el error con al menos 10 caracteres.',
          });
          throw new Error('description too short');
        }
        const formData = new FormData();
        formData.append('description', description);
        const file = incidentFileRef.current?.files?.[0];
        if (file) formData.append('file', file);
        try {
          await incidentMut.mutateAsync({ id: order.id, formData });
        } catch (e) {
          notifyError(e, 'No se pudo guardar la incidencia');
          throw e;
        }
      },
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Eliminar el pedido ${order.orderNumber}`,
      description: 'Se moverá a la papelera.',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(order.id);
      router.push('/dashboard/compras');
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el pedido');
    }
  };

  return (
    <div className="space-y-6">
      {/* div, no <header>: la regla global header:not(.fixed){display:none} oculta cualquier <header> que no sea el navbar fijo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--on-surface)]">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {order.supplier?.name}
            {order.location?.name ? ` · ${order.location.name}` : ''} ·{' '}
            {new Date(order.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${meta.className}`}>
            {meta.label}
          </span>
          {order.status === 'RECIBIDO' &&
            order.receivedTotal != null &&
            order.receivedTotal < order.expectedTotal && (
              <span
                title="Se cerró aceptando menos de lo pedido"
                className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800"
              >
                Cerrado con falta
              </span>
            )}
        </div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[var(--outline-variant)]">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-[var(--surface-container)] text-left text-[var(--on-surface-variant)]">
              <th className="px-4 py-3 font-medium">Artículo</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 text-right font-medium">Precio est.</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              {isDraft && <th className="px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={line.productId}
                className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
              >
                <td className="px-4 py-2 text-[var(--on-surface)]">{line.name}</td>
                <td className="px-4 py-2 text-right">
                  {isDraft ? (
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      value={line.quantity}
                      onChange={(e) => {
                        const quantity = Number(e.target.value) || 0;
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, quantity } : l)),
                        );
                        setDirty(true);
                      }}
                      className="w-24 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1 text-right text-[var(--on-surface)]"
                    />
                  ) : (
                    <span className="text-[var(--on-surface)]">{line.quantity}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[var(--on-surface-variant)]">
                  {line.unit || '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  {isDraft ? (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={line.expectedPrice ?? ''}
                      placeholder="—"
                      onChange={(e) => {
                        const expectedPrice =
                          e.target.value === '' ? null : Number(e.target.value);
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === index ? { ...l, expectedPrice } : l,
                          ),
                        );
                        setDirty(true);
                      }}
                      className="w-24 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1 text-right text-[var(--on-surface)]"
                    />
                  ) : (
                    <span className="text-[var(--on-surface)]">
                      {line.expectedPrice != null ? euro.format(line.expectedPrice) : '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-medium text-[var(--on-surface)]">
                  {euro.format(line.quantity * (line.expectedPrice ?? 0))}
                </td>
                {isDraft && (
                  <td className="px-2 py-2">
                    <button
                      onClick={() => {
                        setLines((prev) => prev.filter((_, i) => i !== index));
                        setDirty(true);
                      }}
                      aria-label={`Quitar ${line.name}`}
                      className="rounded-lg p-1.5 text-[var(--error)] hover:bg-[var(--error-container)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--outline-variant)] bg-[var(--surface-container)]">
              <td colSpan={4} className="px-4 py-3 text-right font-medium text-[var(--on-surface-variant)]">
                Total estimado
              </td>
              <td className="px-4 py-3 text-right text-base font-semibold text-[var(--on-surface)]">
                {euro.format(total)}
              </td>
              {isDraft && <td />}
            </tr>
          </tfoot>
        </table>
      </section>

      {isDraft ? (
        <div>
          <label htmlFor="order-additional-items" className="block text-xs font-medium text-[var(--on-surface-variant)]">
            Artículos nuevos
          </label>
          <textarea
            id="order-additional-items"
            value={additionalItems}
            onChange={(e) => {
              setAdditionalItems(e.target.value);
              setDirty(true);
            }}
            rows={4}
            placeholder="Un artículo por línea. Se añaden al final del listado de artículos, en la misma lista, para artículos que aún no le has comprado a este proveedor..."
            className="mt-1 w-full resize-y rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      ) : (
        order.additionalItems && (
          <div>
            <p className="text-xs font-medium text-[var(--on-surface-variant)]">Artículos nuevos</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-[var(--on-surface)]">
              {order.additionalItems
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
            </ul>
          </div>
        )
      )}

      {isDraft ? (
        <div>
          <label htmlFor="order-notes" className="block text-xs font-medium text-[var(--on-surface-variant)]">
            Notas para el proveedor
          </label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            rows={4}
            placeholder="Aparecen en el PDF y en el mensaje de envío, tras el listado de artículos..."
            className="mt-1 w-full resize-y rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm italic text-[var(--on-surface-variant)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      ) : (
        order.notes && (
          <p className="text-sm italic text-[var(--on-surface-variant)]">{order.notes}</p>
        )
      )}

      {isDraft && (
        <ProductSearchInput
          supplierId={order.supplierId}
          excludeIds={lines.map((l) => l.productId)}
          onSelect={(product) => {
            setLines((prev) => [
              ...prev,
              {
                productId: product.id,
                name: product.name,
                unit: product.purchaseFormat || product.referenceUnit || '',
                quantity: 1,
                expectedPrice: null,
              },
            ]);
            setDirty(true);
          }}
        />
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--outline-variant)] pt-4">
        {isDraft && (
          <button
            onClick={handleSave}
            disabled={!dirty || lines.length === 0 || updateMut.isPending}
            className="rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            {updateMut.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
        {canSend && (
          <button
            onClick={() => setSendOpen(true)}
            disabled={dirty}
            title={dirty ? 'Guarda los cambios primero' : undefined}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Enviar al proveedor
          </button>
        )}
        <button
          onClick={handlePdf}
          className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
        >
          <FileText className="h-4 w-4" /> PDF
        </button>
        {STATUS_ACTIONS[order.status].map(({ to, label, icon: Icon, primary }) => (
          <button
            key={to}
            onClick={() => handleTransition(to)}
            disabled={transitionMut.isPending || (isDraft && dirty)}
            title={isDraft && dirty ? 'Guarda los cambios primero' : undefined}
            className={
              primary
                ? 'flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50'
                : 'flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50'
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        {hasReception && (
          <button
            onClick={handleReportIncident}
            disabled={incidentMut.isPending}
            title="Registrar un error del pedido (no cambia el estado)"
            className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" /> Pedido erróneo
          </button>
        )}
        {canRevert && (
          <button
            onClick={handleRevert}
            disabled={revertMut.isPending}
            title="Corrección administrativa: vuelve a Borrador"
            className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" /> Deshacer (volver a Borrador)
          </button>
        )}
        {(order.status === 'BORRADOR' || order.status === 'CANCELADO') && (
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="ml-auto flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-container)] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        )}
      </footer>

      <SendOrderDialog order={order} open={sendOpen} onOpenChange={setSendOpen} />

      {hasReception && <ReceptionSection order={order} />}

      {(order.events ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--on-surface)]">Historial</h2>
          <ul className="space-y-1">
            {(order.events ?? []).map((event) => {
              const payload = event.payload as {
                from?: string;
                to?: string;
                reason?: string;
                description?: string;
                photoUrl?: string | null;
              } | null;
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-1 rounded-xl bg-[var(--surface-container-low)] px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--on-surface-variant)]">
                      {new Date(event.createdAt).toLocaleString('es-ES')}
                    </span>
                    <span className="text-[var(--on-surface)]">
                      {EVENT_LABELS[event.type] ?? event.type}
                      {payload?.from && payload?.to
                        ? `: ${payload.from} → ${payload.to}`
                        : ''}
                      {event.channel ? ` (${event.channel})` : ''}
                    </span>
                  </div>
                  {payload?.reason && (
                    <p className="text-[var(--on-surface-variant)]">{payload.reason}</p>
                  )}
                  {payload?.description && (
                    <p className="text-[var(--on-surface-variant)]">{payload.description}</p>
                  )}
                  {payload?.photoUrl && (
                    <a href={payload.photoUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={payload.photoUrl}
                        alt="Evidencia"
                        className="mt-1 h-24 w-24 rounded-lg object-cover"
                      />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
