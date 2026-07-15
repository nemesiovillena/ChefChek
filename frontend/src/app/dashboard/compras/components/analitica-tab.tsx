'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { formatEuro } from '@/lib/utils';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useLocations } from '@/hooks/use-locations';
import {
  useDeviationsOverTime,
  usePriceComparison,
  useSpendBySupplier,
  useTopSpend,
  type AnalyticsFilters,
} from '@/hooks/use-purchase-analytics';
import { ProductSearchInput, type PickedProduct } from './product-search-input';

const CHART_COLORS = ['#6e5c3e', '#a8916b', '#ba1a1a', '#3f6b4f', '#4a6fa5', '#8e5a9a'];

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const content =
    'data:text/csv;charset=utf-8,﻿' +
    [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(content));
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function FiltersBar({
  filters,
  onChange,
}: {
  filters: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void;
}) {
  const { data: suppliers } = useSuppliers({ isActive: true });
  const { data: locations } = useLocations();

  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <input
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      />
      <input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      />
      <select
        value={filters.supplierId ?? ''}
        onChange={(e) => onChange({ ...filters, supplierId: e.target.value || undefined })}
        className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      >
        <option value="">Todos los proveedores</option>
        {(suppliers ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        value={filters.locationId ?? ''}
        onChange={(e) => onChange({ ...filters, locationId: e.target.value || undefined })}
        className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      >
        <option value="">Todos los locales</option>
        {(locations ?? []).map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TopSpendBlock({ filters }: { filters: AnalyticsFilters }) {
  const { data: rows, isLoading, error } = useTopSpend(filters);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--on-surface)]">
          Top-20 artículos por gasto
        </h2>
        <button
          disabled={!rows || rows.length === 0}
          onClick={() =>
            downloadCsv(
              `top-gasto_${new Date().toISOString().slice(0, 10)}.csv`,
              ['Artículo', 'Gasto (€)', '% individual', '% acumulado'],
              (rows ?? []).map((r) => [
                r.productName,
                r.spend.toFixed(2),
                r.percent.toFixed(1),
                r.cumulativePercent.toFixed(1),
              ]),
            )
          }
          className="flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      )}
      {error && <p className="text-sm text-[var(--error)]">Error: {error.message}</p>}
      {!isLoading && (rows ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">
          Sin datos de gasto para estos filtros.
        </p>
      )}

      {(rows ?? []).length > 0 && (
        <>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                <XAxis
                  dataKey="productName"
                  tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} width={70} />
                <Tooltip
                  formatter={(value) => formatEuro(Number(value))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="spend" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-[var(--outline-variant)] text-sm">
            {rows!.map((r) => (
              <li key={r.productId} className="flex items-center justify-between py-1.5">
                <span className="truncate text-[var(--on-surface)]">{r.productName}</span>
                <span className="shrink-0 text-[var(--on-surface-variant)]">
                  {formatEuro(r.spend)} · {r.percent.toFixed(1)}% · acum. {r.cumulativePercent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BySupplierBlock({ filters }: { filters: AnalyticsFilters }) {
  const { data: rows, isLoading, error } = useSpendBySupplier(filters);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--on-surface)]">Compras por proveedor</h2>
        <button
          disabled={!rows || rows.length === 0}
          onClick={() =>
            downloadCsv(
              `por-proveedor_${new Date().toISOString().slice(0, 10)}.csv`,
              ['Proveedor', 'Nº pedidos', 'Importe total (€)', 'Ticket medio (€)', 'Plazo medio (días)'],
              (rows ?? []).map((r) => [
                r.supplierName,
                r.orderCount,
                r.totalAmount.toFixed(2),
                r.averageTicket.toFixed(2),
                r.averageLeadTimeDays != null ? r.averageLeadTimeDays.toFixed(1) : '-',
              ]),
            )
          }
          className="flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      )}
      {error && <p className="text-sm text-[var(--error)]">Error: {error.message}</p>}
      {!isLoading && (rows ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">
          Sin pedidos para estos filtros.
        </p>
      )}

      {(rows ?? []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-left text-xs text-[var(--on-surface-variant)]">
                <th className="py-2 pr-3">Proveedor</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Importe</th>
                <th className="py-2 pr-3 text-right">Ticket medio</th>
                <th className="py-2 text-right">Plazo medio</th>
              </tr>
            </thead>
            <tbody>
              {rows!.map((r) => (
                <tr key={r.supplierId} className="border-b border-[var(--outline-variant)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--on-surface)]">{r.supplierName}</td>
                  <td className="py-2 pr-3 text-right text-[var(--on-surface-variant)]">{r.orderCount}</td>
                  <td className="py-2 pr-3 text-right text-[var(--on-surface)]">{formatEuro(r.totalAmount)}</td>
                  <td className="py-2 pr-3 text-right text-[var(--on-surface-variant)]">
                    {formatEuro(r.averageTicket)}
                  </td>
                  <td className="py-2 text-right text-[var(--on-surface-variant)]">
                    {r.averageLeadTimeDays != null ? `${r.averageLeadTimeDays.toFixed(1)} días` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeviationsBlock({ filters }: { filters: AnalyticsFilters }) {
  const { data: rows, isLoading, error } = useDeviationsOverTime(filters);

  const points = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        ...r,
        label: new Date(r.period).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      })),
    [rows],
  );

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <h2 className="text-sm font-semibold text-[var(--on-surface)]">
        Evolución de desviaciones de precio pactado
      </h2>
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      )}
      {error && <p className="text-sm text-[var(--error)]">Error: {error.message}</p>}
      {!isLoading && points.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">
          Sin desviaciones registradas para estos filtros.
        </p>
      )}
      {points.length > 0 && (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                width={50}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === 'averageDeviationPercent' ? [`${Number(value).toFixed(1)}%`, 'Desviación media'] : [value, 'Nº']
                }
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="averageDeviationPercent"
                name="Desviación media (%)"
                stroke={CHART_COLORS[2]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function PriceComparisonBlock({ filters }: { filters: AnalyticsFilters }) {
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const { data: rows, isLoading, error } = usePriceComparison(product?.id ?? null, filters);

  const bySupplierSeries = useMemo(() => {
    const suppliers = Array.from(new Set((rows ?? []).map((r) => r.supplierName)));
    const dates = Array.from(new Set((rows ?? []).map((r) => r.recordedAt))).sort();
    return dates.map((date) => {
      const point: Record<string, string | number> = {
        date,
        label: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      };
      for (const s of suppliers) {
        const match = (rows ?? [])
          .filter((r) => r.supplierName === s && r.recordedAt <= date)
          .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
        if (match) point[s] = match.price;
      }
      return point;
    });
  }, [rows]);

  const supplierNames = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.supplierName))),
    [rows],
  );

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <h2 className="text-sm font-semibold text-[var(--on-surface)]">
        Comparativa de precios por proveedor
      </h2>
      <ProductSearchInput onSelect={setProduct} placeholder="Buscar artículo..." />

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
        </div>
      )}
      {error && <p className="text-sm text-[var(--error)]">Error: {error.message}</p>}
      {product && !isLoading && (rows ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--on-surface-variant)]">
          Sin histórico de precios por proveedor para este artículo.
        </p>
      )}

      {bySupplierSeries.length > 0 && (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bySupplierSeries} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
              <YAxis
                tickFormatter={(v) => formatEuro(Number(v))}
                tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
                width={70}
              />
              <Tooltip formatter={(value) => formatEuro(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {supplierNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function AnaliticaTab() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});

  return (
    <div className="space-y-6">
      <header>
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--on-surface)]">
          <BarChart3 className="h-5 w-5" />
          Analítica de compras
        </h2>
      </header>
      <FiltersBar filters={filters} onChange={setFilters} />
      <TopSpendBlock filters={filters} />
      <BySupplierBlock filters={filters} />
      <DeviationsBlock filters={filters} />
      <PriceComparisonBlock filters={filters} />
    </div>
  );
}
