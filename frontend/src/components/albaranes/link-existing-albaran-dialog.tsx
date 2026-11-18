'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2 } from 'lucide-react';
import { listAlbaranes, updateAlbaran } from '@/lib/api-albaran';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'UTC' });
const formatEuros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  supplierId: string;
  onSuccess: () => void;
}

/**
 * Vincula al pedido un albarán que ya se subió desde Albaranes (p. ej. antes de
 * marcar el pedido como enviado). Lista los del mismo proveedor, sin confirmar
 * y sin pedido. Si el albarán ya está en «Pedido recibido», el backend pasa el
 * pedido a Recibido al vincularlo.
 */
export function LinkExistingAlbaranDialog({ open, onOpenChange, purchaseOrderId, supplierId, onSuccess }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['albaranes', 'unlinked', supplierId],
    queryFn: () => listAlbaranes({ supplierId, pending: true, unlinked: true, limit: 50 }),
    enabled: open,
  });
  const [linking, setLinking] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const albaranes = data?.data ?? [];

  const handleLink = async (albaranId: string) => {
    setLinking(albaranId);
    setLinkError(null);
    try {
      await updateAlbaran(albaranId, { purchaseOrderId });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'No se pudo vincular el albarán');
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular albarán ya subido</DialogTitle>
          <DialogDescription>
            Albaranes de este proveedor sin confirmar y sin pedido. Elige el que corresponde a este pedido.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-6 text-[var(--on-surface-variant)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error && <p className="text-sm text-[var(--error)]">No se pudieron cargar los albaranes: {error.message}</p>}
        {!isLoading && !error && albaranes.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--on-surface-variant)]">
            No hay albaranes de este proveedor pendientes de vincular. Si aún no lo has subido, usa «Subir albarán».
          </p>
        )}

        {albaranes.length > 0 && (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {albaranes.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={linking !== null}
                  onClick={() => handleLink(a.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--outline-variant)] p-3 text-left hover:bg-[var(--surface-container-low)] disabled:opacity-50"
                >
                  <FileText className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--on-surface)]">
                      {a.internalNumber}
                      {a.albaranNumber && ` · nº ${a.albaranNumber}`}
                    </span>
                    <span className="block text-xs text-[var(--on-surface-variant)]">
                      {formatDate(a.date)} · {a.status === 'REVISADO' ? 'Pedido recibido' : 'Pendiente'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-[var(--on-surface)]">{formatEuros(a.total)}</span>
                  {linking === a.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {linkError && <p className="text-sm text-[var(--error)]">{linkError}</p>}
      </DialogContent>
    </Dialog>
  );
}
