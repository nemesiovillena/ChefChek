'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { useProductPriceHistory, PriceHistoryEntry } from '@/hooks/use-product-price-history';

interface ProductPriceHistoryChartProps {
  productId: string;
  supplierId?: string;
}

const euroShort = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n);

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

/**
 * Gráfico de evolución del precio de compra de un producto a lo largo del tiempo.
 * Línea neutra (indigo); el color rojo/verde queda reservado para los deltas
 * puntuales de la tabla. Los datos llegan en orden descendente y se invierten
 * para pintar la línea de izquierda (más antiguo) a derecha (más reciente).
 */
export function ProductPriceHistoryChart({ productId, supplierId }: ProductPriceHistoryChartProps) {
  const { data: history, isLoading, error } = useProductPriceHistory(productId, supplierId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">Error al cargar el historial</p>;
  }

  if (!history || history.length === 0) {
    return <p className="text-sm text-gray-500 py-4">Sin historial de precios</p>;
  }

  // Cronológico (antiguo → reciente) para la línea de evolución
  const points = [...history]
    .reverse()
    .map((entry: PriceHistoryEntry) => ({
      date: entry.recordedAt,
      price: entry.newPrice,
      previous: entry.previousPrice,
    }));

  return (
    <div className="w-full h-[240px] bg-white border border-gray-200 rounded-lg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="priceEvolution" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            stroke="#d1d5db"
            minTickGap={16}
          />
          <YAxis
            tickFormatter={euroShort}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            stroke="#d1d5db"
            width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
            labelFormatter={(label) => shortDate(String(label))}
            formatter={(value, _name, item) => {
              const v = Number(value);
              const prev = (item as { payload?: { previous?: number } } | undefined)?.payload
                ?.previous;
              const delta = prev && prev > 0 ? ((v - prev) / prev) * 100 : null;
              const deltaTxt =
                delta !== null ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)}%)` : '';
              return [`${euroShort(v)}${deltaTxt}`, 'Precio'];
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#priceEvolution)"
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
