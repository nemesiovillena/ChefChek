'use client';

import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { useSupplierPriceHistory } from '@/hooks/use-suppliers';
import { cn, formatEuro } from '@/lib/utils';

interface Props {
  supplierId: string;
  supplierName: string;
}

export function SupplierPriceHistory({ supplierId, supplierName }: Props) {
  const { data: history, isLoading } = useSupplierPriceHistory(supplierId, 12);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-600">
        Sin datos históricos para {supplierName}
      </div>
    );
  }

  // Reverse for chronological order (oldest → newest)
  const sorted = [...history].reverse();
  const prices = sorted.map((h) => h.averagePrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  // Calculate overall trend
  const first = sorted[0].averagePrice;
  const last = sorted[sorted.length - 1].averagePrice;
  const diff = last - first;
  const pct = first > 0 ? ((diff / first) * 100).toFixed(1) : '0';
  const trendUp = diff > 0;
  const trendDown = diff < 0;

  // SVG chart dimensions
  const W = 380;
  const H = 100;
  const PX = 8;
  const PY = 8;

  const points = sorted
    .map((h, i) => {
      const x = PX + (i / (sorted.length - 1 || 1)) * (W - PX * 2);
      const y = H - PY - ((h.averagePrice - minPrice) / range) * (H - PY * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Area fill path
  const areaPath = `M${PX},${H - PY} ` +
    sorted
      .map((h, i) => {
        const x = PX + (i / (sorted.length - 1 || 1)) * (W - PX * 2);
        const y = H - PY - ((h.averagePrice - minPrice) / range) * (H - PY * 2);
        return `L${x},${y}`;
      })
      .join(' ') +
    ` L${W - PX},${H - PY} Z`;

  // Line color: stronger than before
  const lineColor = trendUp ? '#dc2626' : trendDown ? '#16a34a' : '#4b5563';

  return (
    <div className="space-y-3">
      {/* Trend summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {trendUp ? (
            <TrendingUp className="h-4 w-4 text-red-600" />
          ) : trendDown ? (
            <TrendingDown className="h-4 w-4 text-green-600" />
          ) : (
            <Minus className="h-4 w-4 text-gray-600" />
          )}
          <span className={cn(
            'text-sm font-semibold',
            trendUp ? 'text-red-700' : trendDown ? 'text-green-700' : 'text-gray-700',
          )}>
            {trendUp ? '+' : ''}{pct}% en el período
          </span>
        </div>
        <div className="text-xs text-gray-600 font-medium">
          {sorted.length} registros
        </div>
      </div>

      {/* Mini sparkline chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${supplierId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${supplierId})`} />
          <polyline
            points={points}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {sorted.length > 0 && (() => {
            const lastIdx = sorted.length - 1;
            const cx = PX + (lastIdx / (sorted.length - 1 || 1)) * (W - PX * 2);
            const cy = H - PY - ((sorted[lastIdx].averagePrice - minPrice) / range) * (H - PY * 2);
            return (
              <>
                <circle cx={cx} cy={cy} r="4" fill="white" stroke={lineColor} strokeWidth="2" />
                <circle cx={cx} cy={cy} r="2" fill={lineColor} />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Price history table */}
      <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Fecha</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Precio medio</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Var.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((entry, i) => {
              const prev = i > 0 ? sorted[i - 1].averagePrice : null;
              const change = prev !== null ? entry.averagePrice - prev : null;
              return (
                <tr key={entry.id} className="hover:bg-gray-50 bg-white">
                  <td className="px-3 py-1.5 text-gray-800 font-medium">
                    {new Date(entry.recordDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-900 font-bold">
                    {formatEuro(entry.averagePrice)}
                  </td>
                  <td className={cn(
                    'px-3 py-1.5 text-right font-semibold',
                    change !== null && change > 0 && 'text-red-700',
                    change !== null && change < 0 && 'text-green-700',
                    (change === null || change === 0) && 'text-gray-500',
                  )}>
                    {change !== null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
