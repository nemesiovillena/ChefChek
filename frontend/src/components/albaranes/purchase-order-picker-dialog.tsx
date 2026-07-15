'use client';

import { useState } from 'react';
import { usePendingReceptionOrders } from '@/hooks/use-pending-reception-orders';
import { updateAlbaran } from '@/lib/api-albaran';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShoppingCart, Link2Off } from 'lucide-react';

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

interface PurchaseOrderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albaranId: string;
  supplierId?: string;
  albaranDate?: string;
  currentPurchaseOrderId?: string | null;
  onSuccess: () => void;
}

/**
 * Sugiere pedidos ENVIADOS/RECIBIDO_PARCIAL del proveedor del albarán,
 * cercanos a su fecha, para vincular (conciliación al confirmar).
 */
export function PurchaseOrderPickerDialog({
  open,
  onOpenChange,
  albaranId,
  supplierId,
  albaranDate,
  currentPurchaseOrderId,
  onSuccess,
}: PurchaseOrderPickerDialogProps) {
  const { data: orders, isLoading, error } = usePendingReceptionOrders(
    open ? supplierId : undefined,
    albaranDate,
  );
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleSelect = async (purchaseOrderId: string | null) => {
    if (purchaseOrderId === (currentPurchaseOrderId ?? null)) {
      onOpenChange(false);
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    try {
      await updateAlbaran(albaranId, { purchaseOrderId });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : 'Error al vincular el pedido',
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular pedido de compra</DialogTitle>
          <DialogDescription>
            Pedidos enviados a este proveedor cerca de la fecha del albarán.
            Al confirmar, se conciliarán cantidades y precios recibidos.
          </DialogDescription>
        </DialogHeader>

        {updateError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {updateError}
          </div>
        )}

        {!supplierId ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Asigna primero un proveedor al albarán.
          </p>
        ) : (
          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-red-600">{error.message}</div>
            ) : !orders || orders.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No hay pedidos enviados recientes de este proveedor.
              </div>
            ) : (
              <div className="space-y-1">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleSelect(order.id)}
                    disabled={updating}
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors disabled:opacity-50 ${
                      order.id === currentPurchaseOrderId
                        ? 'border border-indigo-200 bg-indigo-50'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                      <ShoppingCart className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">
                        {order.status === 'RECIBIDO_PARCIAL' ? 'Recibido parcial' : 'Enviado'}
                        {order.sentAt
                          ? ` · ${new Date(order.sentAt).toLocaleDateString('es-ES')}`
                          : ''}
                        {' · '}
                        {euro.format(order.expectedTotal)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {currentPurchaseOrderId && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            disabled={updating}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <Link2Off className="h-4 w-4" />
            Desvincular pedido actual
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
