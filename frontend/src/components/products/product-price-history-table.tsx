'use client';

import { useProductPriceHistory } from '@/hooks/use-product-price-history';
import { normalizePrice, referencePriceChanged } from '@/hooks/use-products';
import { Loader2, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';

interface ProductPriceHistoryTableProps {
  productId: string;
  supplierId?: string;
}

/**
 * Tabla de historial de precios de un producto.
 * Muestra cambios de precio con fecha, proveedor, variación y albarán asociado.
 */
export function ProductPriceHistoryTable({ productId, supplierId }: ProductPriceHistoryTableProps) {
  const { data: history, isLoading, error } = useProductPriceHistory(productId, supplierId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">Error al cargar historial</p>;
  }

  if (!history || history.length === 0) {
    return <p className="text-sm text-gray-500 py-4">Sin historial de precios</p>;
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Fecha</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Proveedor</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Anterior</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Nuevo</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Variación</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Albarán</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => {
            // Normalizado a €/kg cuando hay snapshot de unitSize en ambos extremos
            // (entradas nuevas); fallback a precio crudo para filas legacy.
            const canNormalize =
              entry.previousUnitSize != null && entry.newUnitSize != null;
            const previousRef = canNormalize
              ? normalizePrice(entry.previousPrice, entry.previousUnitSize)
              : entry.previousPrice;
            const newRef = canNormalize
              ? normalizePrice(entry.newPrice, entry.newUnitSize)
              : entry.newPrice;
            const change = newRef - previousRef;
            const pctChange = previousRef > 0
              ? ((change / previousRef) * 100).toFixed(1)
              : '—';
            // Normalizado: tolerancia de redondeo (evita iconos +/- por ruido de
            // división); crudo (fila legacy): comportamiento exacto de siempre.
            const isRealChange = canNormalize
              ? referencePriceChanged(previousRef, newRef)
              : change !== 0;
            const isUp = isRealChange && change > 0;
            const isDown = isRealChange && change < 0;

            return (
              <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-700">{formatDate(entry.recordedAt)}</td>
                <td className="py-2 px-3 text-gray-700">
                  {entry.supplier?.name || '—'}
                </td>
                <td className="py-2 px-3 text-right text-gray-500">
                  {formatPrice(entry.previousPrice)}
                </td>
                <td className="py-2 px-3 text-right font-medium">
                  {formatPrice(entry.newPrice)}
                </td>
                <td className="py-2 px-3 text-right">
                  <span className={`inline-flex items-center gap-1 ${
                    isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {isUp ? '+' : ''}{pctChange}%
                  </span>
                </td>
                <td className="py-2 px-3">
                  {entry.albaran ? (
                    <a
                      href={`/dashboard/albaranes/${entry.albaran.id}`}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs"
                    >
                      <FileText className="h-3 w-3" />
                      {entry.albaran.albaranNumber || entry.albaran.internalNumber}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
