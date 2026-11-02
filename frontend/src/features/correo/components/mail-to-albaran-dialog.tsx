'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAlbaranOrders, useAttachmentToAlbaran, type MailDetail, type MailPart } from '../hooks/use-correo';
import { shortDate } from './mail-format';

const NO_ORDER = '';

interface Props {
  detail: MailDetail;
  attachment: MailPart;
  onClose: () => void;
}

const money = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/**
 * Pasa un adjunto (albarán o factura del proveedor) a un albarán de ChefChek:
 * el servidor lo coge del buzón, la IA lee las líneas y se abre el albarán para revisarlo.
 */
export function MailToAlbaranDialog({ detail, attachment, onClose }: Props) {
  const router = useRouter();
  const notify = useNotification();
  const sender = detail.from[0];
  const orders = useAlbaranOrders(sender, true);
  const create = useAttachmentToAlbaran();
  const list = orders.data ?? [];
  // Sin elección del usuario: el pedido más reciente del remitente, si lo hay
  const [choice, setChoice] = useState<string | null>(null);
  const selected = choice ?? list.find((o) => o.fromSender)?.id ?? NO_ORDER;
  const hasSenderOrders = list.some((o) => o.fromSender);

  async function confirm() {
    try {
      const { albaranId } = await create.mutateAsync({
        detail,
        part: attachment.part,
        purchaseOrderId: selected || undefined,
      });
      notify({ type: 'success', title: 'Albarán creado', message: 'Revisa las líneas que ha leído la IA.' });
      router.push(`/dashboard/albaranes/${albaranId}`);
    } catch (err) {
      notify({
        type: 'error',
        title: 'No se pudo crear el albarán',
        message: err instanceof Error && err.message ? err.message : 'Inténtalo de nuevo.',
      });
    }
  }

  const option = (id: string, title: string, subtitle: string, highlight = false) => (
    <label
      key={id || 'none'}
      className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
        selected === id ? 'border-[var(--primary)] bg-[var(--surface-container)]' : 'border-[var(--outline-variant)]'
      }`}
    >
      <input
        type="radio"
        name="albaran-order"
        className="h-4 w-4"
        checked={selected === id}
        onChange={() => setChoice(id)}
        disabled={create.isPending}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--on-surface)]">
          {title}
          {highlight && <span className="ml-2 text-xs font-normal text-[var(--primary)]">De este proveedor</span>}
        </span>
        <span className="block truncate text-xs text-[var(--on-surface-variant)]">{subtitle}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 pb-28 md:pb-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="albaran-dialog-title"
        className="mt-4 w-full max-w-lg space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div id="albaran-dialog-title" className="text-lg font-semibold text-[var(--on-surface)]">
            Pasar a albarán
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={create.isPending} className="p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{attachment.filename}</span>
        </p>
        <p className="text-sm text-[var(--on-surface)]">¿Qué pedido recibe este albarán?</p>

        {orders.isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-[var(--on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando pedidos abiertos…
          </div>
        ) : orders.error ? (
          <p className="text-sm text-[var(--error)]">No se pudieron cargar los pedidos.</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {!hasSenderOrders && list.length > 0 && (
              <p className="text-xs text-[var(--on-surface-variant)]">
                No hay pedidos abiertos de este remitente. Elige otro o crea el albarán sin pedido.
              </p>
            )}
            {list.map((o) =>
              option(
                o.id,
                `${o.orderNumber} · ${o.supplierName}`,
                `${o.status === 'RECIBIDO_PARCIAL' ? 'Recibido en parte' : 'Enviado'}${
                  o.sentAt ? ` el ${shortDate(o.sentAt)}` : ''
                } · ${money(o.expectedTotal)}`,
                o.fromSender,
              ),
            )}
            {option(NO_ORDER, 'Sin pedido', 'Crear el albarán suelto, sin vincularlo a ningún pedido')}
          </div>
        )}

        {create.isPending && (
          <p className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el documento con IA… puede tardar un minuto.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] px-4 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={create.isPending || orders.isLoading}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear albarán
          </button>
        </div>
      </div>
    </div>
  );
}
