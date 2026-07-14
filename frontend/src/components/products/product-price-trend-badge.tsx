'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProductPriceHistoryChart } from './product-price-history-chart';
import { ProductPriceHistoryTable } from './product-price-history-table';

export interface LatestPriceChange {
  previousPrice: number;
  newPrice: number;
  recordedAt: string;
}

interface ProductPriceTrendBadgeProps {
  /** Precio de compra actual (el que se muestra en la celda junto al badge). */
  current: number;
  /** Delta del último cambio con traza, sourceado de ProductPriceHistory. */
  latestPriceChange: LatestPriceChange | null;
  productId: string;
  productName: string;
  supplierId?: string;
}

/**
 * Insignia de tendencia del último cambio de precio de compra de un artículo.
 * Se sourcea desde el historial (latestPriceChange), NO desde la columna plana
 * previousPurchasePrice (que deriva respecto al historial). Convención de color
 * del proyecto: rojo = subida, verde = bajada. Al hacer click abre un modal con
 * la evolución (gráfico) y la tabla del historial completo.
 *
 * Devuelve null (sin render, sin click) cuando no hay cambio que mostrar: sin
 * historial, sin precio previo válido o sin variación.
 */
export function ProductPriceTrendBadge({
  current,
  latestPriceChange,
  productId,
  productName,
  supplierId,
}: ProductPriceTrendBadgeProps) {
  if (!latestPriceChange) return null;

  const previous = latestPriceChange.previousPrice;
  if (!previous || previous <= 0) return null;

  const change = current - previous;
  if (change === 0) return null;

  const pct = (change / previous) * 100;
  const isUp = change > 0;
  const dateLabel = new Date(latestPriceChange.recordedAt).toLocaleDateString(
    'es-ES',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        title={`Precio anterior: ${previous.toFixed(2)} € (${dateLabel}) — click para ver el historial`}
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
        )}
      >
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? '+' : ''}
        {pct.toFixed(1)}%
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de precios — {productName}</DialogTitle>
          <DialogDescription>
            Evolución del precio de compra y cambios registrados.
          </DialogDescription>
        </DialogHeader>
        <ProductPriceHistoryChart productId={productId} supplierId={supplierId} />
        <ProductPriceHistoryTable productId={productId} supplierId={supplierId} />
      </DialogContent>
    </Dialog>
  );
}
