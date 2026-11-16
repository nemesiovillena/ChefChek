'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Bucket, SeriesPoint } from '../api/gestion-api';
import { formatBucket, formatEuros, formatEurosShort } from '../gestion-format';

interface Props {
  series: SeriesPoint[];
  compareSeries: SeriesPoint[];
  bucket: Bucket;
  compareLabel: string;
}

interface Row {
  key: string;
  current: number | null;
  previous: number | null;
}

/**
 * Ventas con IVA del periodo y del de comparación, una línea sobre otra: cada
 * tramo de la comparación se dibuja en el tramo actual que le corresponde
 * (alignedKey), así el lunes cae sobre el lunes. Días sin venta = sin punto.
 */
export function SalesEvolutionChart({ series, compareSeries, bucket, compareLabel }: Props) {
  const data = useMemo<Row[]>(() => {
    const rows = new Map<string, Row>();
    for (const p of series) rows.set(p.key, { key: p.key, current: p.total, previous: null });
    for (const p of compareSeries) {
      const key = p.alignedKey ?? p.key;
      const row = rows.get(key) ?? { key, current: null, previous: null };
      row.previous = (row.previous ?? 0) + p.total;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [series, compareSeries]);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[var(--on-surface-variant)]">Sin ventas en este periodo.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[var(--on-surface-variant)]" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-[var(--primary)]" /> Este periodo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-[var(--outline)]" /> {compareLabel}
        </span>
      </div>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--outline-variant)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="key"
              tickFormatter={(k: string) => formatBucket(k, bucket)}
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              stroke="var(--outline-variant)"
              minTickGap={16}
            />
            <YAxis
              tickFormatter={(v: number) => formatEurosShort(v)}
              tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
              stroke="var(--outline-variant)"
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface-container-highest)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 8,
                color: 'var(--on-surface)',
                fontSize: 12,
              }}
              labelFormatter={(k) => formatBucket(String(k), bucket)}
              formatter={(value, name) => [
                typeof value === 'number' ? formatEuros(value) : '—',
                name === 'current' ? 'Este periodo' : compareLabel,
              ]}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--outline)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={data.length <= 31 ? { r: 3, strokeWidth: 0, fill: 'var(--primary)' } : false}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
