'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '@/components/notification-system';
import { correctLinePrice, type Albaran, type AlbaranLine } from '@/lib/api-albaran';
import { LinePriceChangeBadge } from '@/components/albaranes/line-price-change-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil, ShieldCheck } from 'lucide-react';

interface CorrectPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albaran: Albaran;
  line: AlbaranLine;
  onSuccess: () => void;
}

/** "8,90" | "8.90" → 8.9 (el input es texto libre con coma española). */
const parseEsNumber = (raw: string): number | null => {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '') return null;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatEur = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

/**
 * Corrección de precio de una línea de un albarán YA confirmado. No es una
 * edición más: el precio equivocado ya se propagó al confirmar, así que este
 * diálogo muestra qué coste quedará asentado y qué se re-sincroniza (oferta
 * preferente, coste del artículo, histórico y pedido vinculado) antes de
 * guardar. La cantidad y el stock no se tocan.
 */
export function CorrectPriceDialog({
  open,
  onOpenChange,
  albaran,
  line,
  onSuccess,
}: CorrectPriceDialogProps) {
  const addNotification = useNotification();
  const queryClient = useQueryClient();
  // La línea confirmada no es editable en la tabla: los drafts arrancan del
  // valor asentado. El diálogo se monta/desmonta desde la página (key-reset),
  // así que el useState inicial ya los rehidrata en cada apertura.
  const [price, setPrice] = useState(String(line.unitPrice));
  const [net, setNet] = useState(line.totalPrice !== null ? String(line.totalPrice) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Neto del papel: solo procede tocarlo si la línea lo trajo o si el albarán
  // aplica el descuento al coste (el coste efectivo depende de él).
  const showNet =
    line.totalPrice !== null || albaran.applyDiscountToCost === true;

  const parsedPrice = parseEsNumber(price);
  const parsedNet = net.trim() === '' ? null : parseEsNumber(net);

  const priceValid = parsedPrice !== null && parsedPrice > 0;
  const netValid = parsedNet === null || (showNet && parsedNet >= 0);

  // Mismo coste efectivo que asienta el backend (applyDiscountToCost manda el
  // neto del papel cuando existe).
  const effectivePrice =
    albaran.applyDiscountToCost && parsedNet !== null && line.quantity > 0
      ? parsedNet / line.quantity
      : parsedPrice;

  const priceChanged =
    priceValid && netValid && (parsedPrice !== line.unitPrice || (showNet && parsedNet !== line.totalPrice));

  const handleSave = async () => {
    if (!priceValid || !netValid || !priceChanged) return;
    setSaving(true);
    setError(null);
    try {
      await correctLinePrice(albaran.id, line.id, {
        unitPrice: parsedPrice!,
        // Ausente → el backend conserva el neto actual; null explícito lo limpia.
        ...(showNet ? { totalPrice: parsedNet } : {}),
      });
      // El coste del artículo cambió: refresca todo lo que lo lee.
      void queryClient.invalidateQueries({ queryKey: ['albaran', albaran.id] });
      void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['price-history'] });
      void queryClient.invalidateQueries({ queryKey: ['price-history-all'] });
      void queryClient.invalidateQueries({ queryKey: ['recipe-cost'] });
      addNotification({
        type: 'success',
        title: 'Precio corregido',
        message: `${line.matchedProduct?.name ?? line.description}: el coste quedó en ${formatEur(effectivePrice ?? 0)}/${line.unit}`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al corregir el precio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Pencil className="h-4 w-4" />
            </span>
            Corregir precio asentado
          </DialogTitle>
          <DialogDescription>
            {line.matchedProduct?.name ?? line.description} · Albarán{' '}
            {albaran.albaranNumber || albaran.internalNumber}
            {albaran.supplier ? ` · ${albaran.supplier.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="correct-price">
              Precio por {line.unit} (€)
            </Label>
            <Input
              id="correct-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={saving}
              aria-invalid={!priceValid}
            />
          </div>
          {showNet && (
            <div className="space-y-1.5">
              <Label htmlFor="correct-net">Neto del papel (€)</Label>
              <Input
                id="correct-net"
                inputMode="decimal"
                placeholder="con descuento"
                value={net}
                onChange={(e) => setNet(e.target.value)}
                disabled={saving}
              />
            </div>
          )}
        </div>

        {/* Preview del coste que quedará asentado, contra el coste en ficha */}
        {priceValid && netValid && effectivePrice !== null && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60">
            <span className="text-gray-600 dark:text-gray-300">
              Coste que quedará asentado
            </span>
            <span className="flex items-center gap-2 font-semibold">
              {formatEur(effectivePrice)}/{line.unit}
              <LinePriceChangeBadge
                effectivePrice={effectivePrice}
                previousPrice={line.matchedProduct?.purchasePrice}
              />
            </span>
          </div>
        )}

        <div className="space-y-1.5 rounded-lg border border-gray-200 p-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <p className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Al guardar se actualizará:
          </p>
          <ul className="list-disc space-y-0.5 pl-8">
            <li>la oferta de {albaran.supplier?.name ?? 'este proveedor'} (pasará a ser la preferente) y con ella el coste del artículo y los escandallos</li>
            <li>el histórico de precios, dejando traza de la corrección</li>
            {albaran.purchaseOrderId && <li>el precio recibido del pedido vinculado</li>}
          </ul>
          <p>La cantidad recibida y el stock no cambian.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!priceChanged || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar corrección
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
