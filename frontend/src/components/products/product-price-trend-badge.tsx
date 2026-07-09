import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductPriceTrendBadgeProps {
  /** Precio de compra actual */
  current: number;
  /** Precio de compra inmediatamente anterior (previousPurchasePrice) */
  previous: number;
}

/**
 * Insignia de tendencia del último cambio de precio de compra de un artículo.
 * Compara el precio actual con el anterior (ambos ya vienen en el Product).
 * Convención de color del proyecto: rojo = subida, verde = bajada.
 * Devuelve null cuando no hay cambio que mostrar (sin precio previo o sin
 * variación), para no ensuciar la celda del listado.
 */
export function ProductPriceTrendBadge({ current, previous }: ProductPriceTrendBadgeProps) {
  if (!previous || previous <= 0) return null;

  const change = current - previous;
  if (change === 0) return null;

  const pct = (change / previous) * 100;
  const isUp = change > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        isUp ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
      )}
      title={`Precio anterior: ${previous.toFixed(2)} €`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}
