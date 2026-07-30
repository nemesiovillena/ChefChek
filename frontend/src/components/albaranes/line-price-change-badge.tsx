'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { referencePriceChanged } from '@/hooks/use-products';

interface LinePriceChangeBadgeProps {
  /** Precio efectivo de esta línea (bruto o neto según applyDiscountToCost). */
  effectivePrice: number;
  /** purchasePrice vigente del artículo emparejado, antes de confirmar. */
  previousPrice: number | null | undefined;
}

/**
 * Preview de variación de precio en Líneas de albarán: compara el precio
 * efectivo de la línea (aún sin confirmar) contra el purchasePrice vigente
 * del artículo. Convención de color del proyecto: rojo = sube, verde = baja
 * (misma que ProductPriceTrendBadge en Artículos). A diferencia de ese
 * componente, NO sourcea de ProductPriceHistory (que solo se escribe al
 * confirmar) — compara contra el precio EN FICHA ahora mismo, como preview
 * de lo que pasará si se confirma este albarán.
 */
export function LinePriceChangeBadge({
  effectivePrice,
  previousPrice,
}: LinePriceChangeBadgeProps) {
  if (!previousPrice || previousPrice <= 0) return null;
  if (!referencePriceChanged(previousPrice, effectivePrice)) return null;

  const pct = ((effectivePrice - previousPrice) / previousPrice) * 100;
  const isUp = effectivePrice > previousPrice;

  return (
    <span
      title={`Precio vigente: ${previousPrice.toFixed(2)} €`}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
      )}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}
