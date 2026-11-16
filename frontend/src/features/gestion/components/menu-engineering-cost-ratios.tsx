'use client';

import { useState } from 'react';
import type { MenuEngineeringAnalysis } from '../api/gestion-menu-engineering-api';
import { formatEuros, parseEsAmount } from '../gestion-format';
import { stockRotation } from '../menu-engineering-stock-rotation';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';

const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`);
const num = (n: number | null, d = 2) => (n === null ? '—' : n.toLocaleString('es-ES', { maximumFractionDigits: d }));
const card = 'rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4';

/** Ratios que ChefChek aún no registra: se escribe el importe y sale el %. */
const MANUAL = [
  { key: 'caducidad', title: 'Coste de la gestión de las caducidades', formula: 'Materia prima destruida por caducar ÷ ventas × 100' },
  { key: 'aprovechamiento', title: 'Coste de la gestión de las materias primas', formula: 'Materia prima mal aprovechada ÷ ventas × 100' },
  { key: 'devueltos', title: 'Coste de platos devueltos por los clientes', formula: 'Materia prima devuelta ÷ ventas × 100' },
  { key: 'manutencion', title: 'Producción dedicada a manutención del personal', formula: 'Coste de las comidas del personal ÷ facturación × 100' },
] as const;

/** Importe escrito en formato español («1.200,50»); vacío o no válido = 0. */
const toAmount = (s: string | undefined) => {
  const v = s ? parseEsAmount(s) : 0;
  return Number.isFinite(v) ? v : 0;
};

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/**
 * Ratios de costes sobre la cifra de ventas y calculadora de rotación del
 * stock, periodo medio de pago y financiación de proveedores.
 */
export function MenuEngineeringCostRatios({ data }: { data: MenuEngineeringAnalysis }) {
  const r = data.costRatios;
  const [manual, setManual] = useState<Record<string, string>>({});
  const main = r.byCategory[0];
  const ratio = (v: number) => (r.salesBase > 0 && v > 0 ? (v / r.salesBase) * 100 : null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--on-surface-variant)]">
        Todos los ratios van sobre la cifra de ventas sin IVA del periodo: <strong className="text-[var(--on-surface)]">{formatEuros(r.salesBase)}</strong>.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <div className="text-sm font-semibold text-[var(--on-surface)]">Costes totales de la materia prima</div>
          <p className="text-xs text-[var(--on-surface-variant)]">Coste total de la materia prima ÷ ventas × 100 (compras de albaranes)</p>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-[var(--on-surface)]">{pct(r.rawMaterial.pct)}</div>
          <div className="text-xs text-[var(--on-surface-variant)]">{formatEuros(r.rawMaterial.cost)}</div>
        </div>
        <div className={card}>
          <div className="text-sm font-semibold text-[var(--on-surface)]">Costes de materias primas, por categoría</div>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Coste de la materia prima principal ÷ ventas × 100{main ? ` · la principal es «${main.label}»` : ''}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {r.byCategory.map((c) => (
              <li key={c.label} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-[var(--on-surface)]">{c.label}</span>
                <span className="shrink-0 tabular-nums text-[var(--on-surface-variant)]">
                  {formatEuros(c.cost)} · <strong className="text-[var(--on-surface)]">{pct(c.pct)}</strong>
                </span>
              </li>
            ))}
            {r.byCategory.length === 0 && <li className="text-[var(--on-surface-variant)]">Sin compras en el periodo.</li>}
          </ul>
        </div>
        {MANUAL.map((m) => (
          <div key={m.key} className={card}>
            <div className="text-sm font-semibold text-[var(--on-surface)]">{m.title}</div>
            <p className="text-xs text-[var(--on-surface-variant)]">{m.formula}</p>
            <div className="mt-2 flex items-end gap-3">
              <label className="flex w-36 flex-col">
                <span className={labelCls}>Importe del periodo (€)</span>
                <input
                  inputMode="decimal"
                  className={inputCls}
                  value={manual[m.key] ?? ''}
                  onChange={(e) => setManual({ ...manual, [m.key]: e.target.value })}
                  placeholder="0,00"
                />
              </label>
              <div className="pb-1 text-3xl font-semibold tabular-nums text-[var(--on-surface)]">{pct(ratio(toAmount(manual[m.key])))}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Caducidades, aprovechamiento, devoluciones y comidas del personal aún no se registran en ChefChek: escribe el importe para ver el ratio
        (no se guarda).
      </p>
      <RotationCalculator purchases={r.rawMaterial.cost} periodDays={days(data.range.from, data.range.to)} />
    </div>
  );
}

function RotationCalculator({ purchases, periodDays }: { purchases: number; periodDays: number }) {
  const [v, setV] = useState({ initial: '', final: '', debt: '', payments: '' });
  const n = toAmount;
  const res = stockRotation({
    purchases,
    initialStock: n(v.initial),
    finalStock: n(v.final),
    supplierDebt: v.debt ? n(v.debt) : purchases,
    payments: n(v.payments),
    days: periodDays,
  });
  const field = (k: keyof typeof v, label: string, placeholder = '0,00') => (
    <label className="flex min-w-[9rem] flex-1 flex-col">
      <span className={labelCls}>{label}</span>
      <input inputMode="decimal" className={inputCls} value={v[k]} placeholder={placeholder} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  );
  const fin = res.supplierFinancingPct;

  return (
    <div className={card}>
      <div className="text-base font-semibold text-[var(--on-surface)]">Índice de rotación y financiación de proveedores</div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Compras del periodo ({periodDays} días): {formatEuros(purchases)}. Hasta tener inventarios en ChefChek, escribe las existencias inicial y
        final valoradas a coste.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {field('initial', 'Existencias iniciales (€)')}
        {field('final', 'Existencias finales (€)')}
        {field('debt', 'Deuda con proveedores (€)', formatEuros(purchases))}
        {field('payments', 'Pagos a proveedores (€)')}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Metric label="Consumo (Ei + Compras − Ef)" value={formatEuros(res.consumption)} />
        <Metric label="Stock medio ((Ei + Ef) ÷ 2)" value={formatEuros(res.averageStock)} />
        <Metric label="Rotación del periodo" value={`${num(res.rotationPeriod)} veces`} hint={`${num(res.rotationYear, 1)} veces al año`} />
        <Metric label="El stock dura" value={res.stockDays === null ? '—' : `${num(res.stockDays, 1)} días`} />
        <Metric label="Pago medio diario" value={res.dailyPayment === null ? '—' : formatEuros(res.dailyPayment)} hint="Pagos ÷ días" />
        <Metric label="Periodo medio de pago (PMP)" value={res.paymentDays === null ? '—' : `${num(res.paymentDays, 1)} días`} hint="Deuda ÷ pago diario" />
        <Metric label="Stock financiado por proveedores" value={pct(fin)} hint="PMP × IR anual ÷ 365 × 100" />
      </dl>
      {res.consumption <= 0 && (n(v.initial) > 0 || n(v.final) > 0) && (
        <p className="mt-3 text-sm text-[var(--error)]">
          Las existencias finales superan a las iniciales más las compras: revisa los importes.
        </p>
      )}
      {fin !== null && (
        <p className="mt-3 text-sm text-[var(--on-surface)]">
          {fin >= 100
            ? `Los proveedores financian todo tu stock: pagas a ${num(res.paymentDays, 0)} días lo que vendes en ${num(res.stockDays, 0)}. El resto es caja que trabaja para ti.`
            : `Los proveedores financian el ${pct(fin)} de tu stock; el resto lo pones tú. Más rotación o pagos más largos lo mejoran.`}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-container-high)] p-3">
      <dt className="text-xs text-[var(--on-surface-variant)]">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-[var(--on-surface)]">{value}</dd>
      {hint && <dd className="text-xs text-[var(--on-surface-variant)]">{hint}</dd>}
    </div>
  );
}
