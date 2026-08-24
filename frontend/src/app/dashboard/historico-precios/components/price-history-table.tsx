'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import type { PriceHistoryEntry } from '@/hooks/use-price-history';

interface PriceHistoryTableProps {
  entries: PriceHistoryEntry[];
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

/** Tabla de historial de precios de todo el tenant (no filtrada por artículo). */
export function PriceHistoryTable({ entries }: PriceHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Fecha</th>
            <th className="text-left py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Producto</th>
            <th className="text-left py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Proveedor</th>
            <th className="text-right py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Anterior</th>
            <th className="text-right py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Nuevo</th>
            <th className="text-right py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Variación</th>
            <th className="text-left py-2 px-3 font-label-sm text-label-sm text-on-surface-variant uppercase">Albarán</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const change = entry.newPrice - entry.previousPrice;
            const pctChange = entry.previousPrice > 0 ? ((change / entry.previousPrice) * 100).toFixed(1) : '—';
            const isUp = change > 0;
            const isDown = change < 0;

            return (
              <tr key={entry.id} className="border-b border-border/60 hover:bg-surface-variant/50">
                <td className="py-2 px-3 text-on-surface-variant">{formatDate(entry.recordedAt)}</td>
                <td className="py-2 px-3 text-primary font-medium">{entry.product.name}</td>
                <td className="py-2 px-3 text-on-surface-variant">{entry.supplier?.name || '—'}</td>
                <td className="py-2 px-3 text-right text-on-surface-variant">{formatPrice(entry.previousPrice)}</td>
                <td className="py-2 px-3 text-right text-primary font-medium">{formatPrice(entry.newPrice)}</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      isUp ? 'bg-error/10 text-error' : isDown ? 'bg-secondary-container/40 text-secondary' : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {isUp ? '+' : ''}
                    {pctChange}%
                  </span>
                </td>
                <td className="py-2 px-3">
                  {entry.albaran ? (
                    <Link
                      href={`/dashboard/albaranes/${entry.albaran.id}`}
                      className="inline-flex items-center gap-1 text-secondary hover:underline text-xs"
                    >
                      <FileText className="h-3 w-3" />
                      {entry.albaran.albaranNumber || entry.albaran.internalNumber}
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
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
