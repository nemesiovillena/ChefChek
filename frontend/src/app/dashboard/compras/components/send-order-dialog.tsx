'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/components/notification-system';
import {
  useSendOrder,
  useSendPreview,
  type SendChannel,
} from '@/hooks/use-order-sending';
import type { PurchaseOrder } from '@/hooks/use-purchase-orders';

/**
 * Diálogo "Enviar pedido": ofrece solo los canales declarados en
 * Supplier.orderMethods. EMAIL envía de verdad (SMTP + PDF adjunto);
 * WhatsApp abre wa.me con el mensaje y el usuario confirma; teléfono/web
 * son registro manual.
 */
export function SendOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: PurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addNotification = useNotification();
  const { data: preview, isLoading, error } = useSendPreview(order.id, open);
  const sendMut = useSendOrder();
  const [whatsappOpened, setWhatsappOpened] = useState(false);

  const send = async (channel: SendChannel) => {
    try {
      await sendMut.mutateAsync({ orderId: order.id, channel });
      addNotification({
        type: 'success',
        title: `Pedido ${order.orderNumber} enviado`,
        message:
          channel === 'EMAIL'
            ? `Email con PDF enviado a ${preview?.email}`
            : `Registrado como enviado por ${channel}`,
      });
      onOpenChange(false);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo enviar',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  const channelRow =
    'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--outline-variant)] px-4 py-3';
  const primaryBtn =
    'flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50';
  const outlineBtn =
    'flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 py-2 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-low)] disabled:opacity-50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar {order.orderNumber}</DialogTitle>
          <DialogDescription>
            {order.supplier?.name} · elige el canal del proveedor
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Preparando envío...
          </div>
        ) : error ? (
          <div className="rounded-xl bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]">
            {error.message}
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--on-surface-variant)]">
                Mensaje para el proveedor
              </p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--surface-container-low)] p-3 text-xs text-[var(--on-surface)]">
                {preview.text}
              </pre>
            </div>

            {preview.channels.length === 0 && (
              <p className="text-sm text-[var(--on-surface-variant)]">
                El proveedor no tiene canales de pedido configurados. Edítalo en
                la gestión de proveedores.
              </p>
            )}

            {preview.channels.includes('EMAIL') && (
              <div className={channelRow}>
                <div className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                  <Mail className="h-4 w-4 text-[var(--primary)]" />
                  {preview.email ?? 'Sin email en el proveedor'}
                </div>
                <button
                  onClick={() => send('EMAIL')}
                  disabled={!preview.email || sendMut.isPending}
                  className={primaryBtn}
                >
                  {sendMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar email con PDF
                </button>
              </div>
            )}

            {preview.channels.includes('WHATSAPP') && (
              <div className={channelRow}>
                <div className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                  <MessageCircle className="h-4 w-4 text-[var(--primary)]" />
                  WhatsApp
                </div>
                <div className="flex gap-2">
                  <a
                    href={preview.whatsappUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappOpened(true)}
                    aria-disabled={!preview.whatsappUrl}
                    className={outlineBtn}
                  >
                    <ExternalLink className="h-4 w-4" /> Abrir WhatsApp
                  </a>
                  <button
                    onClick={() => send('WHATSAPP')}
                    disabled={!whatsappOpened || sendMut.isPending}
                    title={
                      whatsappOpened
                        ? undefined
                        : 'Abre WhatsApp primero y envía el mensaje'
                    }
                    className={primaryBtn}
                  >
                    Marcar enviado
                  </button>
                </div>
              </div>
            )}

            {preview.channels.includes('PHONE') && (
              <div className={channelRow}>
                <div className="flex items-center gap-2 text-sm text-[var(--on-surface)]">
                  <Phone className="h-4 w-4 text-[var(--primary)]" />
                  {preview.phone ?? 'Sin teléfono en el proveedor'}
                </div>
                <div className="flex gap-2">
                  {preview.phone && (
                    <a href={`tel:${preview.phone}`} className={outlineBtn}>
                      Llamar
                    </a>
                  )}
                  <button
                    onClick={() => send('PHONE')}
                    disabled={sendMut.isPending}
                    className={primaryBtn}
                  >
                    Pedido comunicado
                  </button>
                </div>
              </div>
            )}

            {preview.channels.includes('WEB') && (
              <div className={channelRow}>
                <span className="text-sm text-[var(--on-surface)]">
                  Pedido hecho en la web del proveedor
                </span>
                <button
                  onClick={() => send('WEB')}
                  disabled={sendMut.isPending}
                  className={primaryBtn}
                >
                  Marcar enviado
                </button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
