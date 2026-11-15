'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { type DateRange, type MenuClass, useGestionProfitability } from '../api/gestion-api';
import { formatEuros, formatQty } from '../gestion-format';
import { KpiCard } from './kpi-card';
import { PeriodPicker } from './period-picker';

const cardCls = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';
const pctText = (p: number | null) => (p === null ? '—' : `${p.toLocaleString('es-ES')} %`);

const MENU: { id: MenuClass; label: string; hint: string; icon: string }[] = [
  { id: 'estrella', label: 'Estrellas', hint: 'Populares y rentables', icon: 'star' },
  { id: 'caballo', label: 'Caballos de batalla', hint: 'Se venden mucho, dejan poco', icon: 'trending_up' },
  { id: 'puzzle', label: 'Puzzles', hint: 'Rentables, se venden poco', icon: 'extension' },
  { id: 'perro', label: 'Perros', hint: 'Ni se venden ni dejan', icon: 'trending_down' },
];

/**
 * Rentabilidad del periodo: food cost teórico (escandallos), compras de
 * albaranes, coste de personal (fichajes) y prime cost, todo sobre las
 * ventas sin IVA. Avisa cuando los datos de base están incompletos.
 */
export function GestionProfitabilityView() {
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [range, setRange] = useState<DateRange>(() => presetRange('thisMonth'));
  const valid = range.from <= range.to;
  const { data, isLoading, isFetching, error } = useGestionProfitability(range, valid);

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <PeriodPicker
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
        />
        {isFetching && <Loader2 className="mt-2 h-4 w-4 animate-spin text-[var(--on-surface-variant)]" aria-label="Actualizando" />}
      </div>

      {!valid && <p className="text-sm text-[var(--error)]">La fecha «Desde» es posterior a «Hasta».</p>}
      {error && <p className="text-sm text-[var(--error)]">No se pudo calcular: {error.message}</p>}
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--on-surface-variant)]" />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard label="Ventas sin IVA" value={formatEuros(data.salesBase)} />
            <KpiCard
              label="Food cost teórico"
              value={pctText(data.foodCost.pct)}
              compareText={`${formatEuros(data.foodCost.total)} · con escandallo el ${pctText(data.foodCost.coverage)} de lo servido`}
            />
            <KpiCard
              label="Compras / ventas"
              value={pctText(data.purchases.pct)}
              compareText={`${formatEuros(data.purchases.total)} en albaranes recibidos`}
            />
            <KpiCard
              label="Personal / ventas"
              value={data.labor ? pctText(data.labor.pct) : '—'}
              compareText={
                data.labor
                  ? `${formatEuros(data.labor.total)} · ${formatQty(data.labor.hours)} h fichadas`
                  : 'Elige un periodo de un año como mucho'
              }
            />
            <KpiCard
              label="Prime cost"
              value={data.primeCost ? pctText(data.primeCost.pct) : '—'}
              compareText={data.primeCost ? `${formatEuros(data.primeCost.total)} · food cost + personal` : undefined}
            />
          </div>

          <Warnings
            coverage={data.foodCost.coverage}
            unknownDishes={data.foodCost.unknownDishes}
            withoutCost={data.labor?.withoutCost ?? 0}
          />

          <div className={cardCls}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--on-surface)]">Ingeniería de menú</div>
              <Link href="/dashboard/gestion/informes/ingenieria-menu" className="text-sm text-[var(--primary)] underline">
                Ver platos
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {MENU.map((m) => (
                <div key={m.id} className="rounded-lg bg-[var(--surface-container-high)] p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--on-surface)]">
                    <span className="material-symbols-outlined text-base" aria-hidden>
                      {m.icon}
                    </span>
                    {m.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--on-surface)]">{data.menu[m.id]}</div>
                  <div className="text-xs text-[var(--on-surface-variant)]">{m.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Cuiner (enlazar platos) es de gerencia: la oficina ve el aviso sin enlace. */
const CUINER_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

function Warnings({ coverage, unknownDishes, withoutCost }: { coverage: number | null; unknownDishes: number; withoutCost: number }) {
  const { user } = useAuth();
  const canOpenCuiner = CUINER_ROLES.includes(user?.role ?? '');
  const items: { text: string; href?: string; link?: string }[] = [];
  if (coverage !== null && coverage < 90) {
    items.push({
      text: `Solo el ${coverage.toLocaleString('es-ES')} % de lo servido tiene escandallo: ${unknownDishes} platos sin enlazar o sin coste. El food cost real será mayor.`,
      ...(canOpenCuiner ? { href: '/dashboard/cuiner', link: 'Enlazar platos en Cuiner' } : {}),
    });
  }
  if (withoutCost > 0) {
    items.push({
      text: `${withoutCost} persona(s) con fichajes no tienen coste/hora: no suman al coste de personal.`,
      href: '/dashboard/users',
      link: 'Completar fichas',
    });
  }
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <p key={i.text} className="flex items-start gap-2 rounded-lg bg-[var(--surface-container-high)] p-3 text-sm text-[var(--on-surface-variant)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {i.text}{' '}
            {i.href && (
              <Link href={i.href} className="font-medium text-[var(--primary)] underline">
                {i.link}
              </Link>
            )}
          </span>
        </p>
      ))}
    </div>
  );
}
