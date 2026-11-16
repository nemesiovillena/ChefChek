'use client';

import type { MenuEngineeringAnalysis } from '../api/gestion-menu-engineering-api';
import { formatEuros } from '../gestion-format';

const num = (n: number, d = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: d });
const BAND = ['Bajo', 'Medio', 'Alto'];

/**
 * Principios de Omnes sobre los precios de la familia: amplitud de gama,
 * reparto en tres tramos y relación precio demandado / precio ofertado.
 */
export function MenuEngineeringOmnes({ data }: { data: MenuEngineeringAnalysis }) {
  const o = data.omnes;
  if (!o) {
    return <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">Hacen falta al menos dos platos vendidos en la familia.</p>;
  }
  const maxBand = Math.max(...o.bands.map((b) => b.count), 1);
  const ratioAdvice =
    o.ratio < 0.85
      ? 'El cliente elige lo más barato: la carta se percibe cara. Revisa precios altos o añade opciones en la zona media.'
      : o.ratio > 1.05
        ? 'El cliente elige lo más caro: hay margen para subir precios o añadir platos de más precio.'
        : 'Precios bien ajustados a lo que el cliente está dispuesto a pagar.';

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--on-surface-variant)]">
        {data.group}: {o.dishes} platos vendidos, de {formatEuros(o.minPrice)} a {formatEuros(o.maxPrice)} (sin IVA, precio medio cobrado).
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        <Principle
          ok={o.amplitudeOk}
          title="1. Amplitud de gama"
          formula="Precio más alto ÷ precio más bajo"
          value={num(o.amplitude)}
          target={`≤ ${num(o.amplitudeLimit, 1)} (${o.dishes <= 9 ? 'hasta 9 platos' : '10 o más platos'})`}
          advice={o.amplitudeOk ? 'Gama coherente.' : 'Demasiada distancia entre el plato más barato y el más caro: el cliente se va a los extremos.'}
        />
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <Header ok={o.bandsOk} title="2. Dispersión de precios" />
          <p className="text-xs text-[var(--on-surface-variant)]">Tres tramos iguales: en el medio tantos platos como en bajo y alto juntos.</p>
          <div className="mt-3 space-y-2">
            {o.bands.map((b, i) => (
              <div key={BAND[i]} className="text-sm">
                <div className="flex justify-between text-xs text-[var(--on-surface-variant)]">
                  <span>
                    {BAND[i]} · {formatEuros(b.from)}–{formatEuros(b.to)}
                  </span>
                  <span className="tabular-nums text-[var(--on-surface)]">{b.count}</span>
                </div>
                <div className="mt-0.5 h-2 rounded bg-[var(--surface-container-high)]">
                  <div className="h-2 rounded" style={{ width: `${(b.count / maxBand) * 100}%`, background: 'var(--me-estrella)' }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--on-surface)]">
            {o.bandsOk
              ? 'Reparto equilibrado.'
              : `Medio ${o.bands[1].count} frente a ${o.bands[0].count + o.bands[2].count} en los extremos: ${
                  o.bands[1].count < o.bands[0].count + o.bands[2].count ? 'faltan platos de precio medio.' : 'sobran platos de precio medio.'
                }`}
          </p>
        </div>
        <Principle
          ok={o.ratioOk}
          title="3. Precio demandado ÷ ofertado"
          formula={`${formatEuros(o.demandedAverage)} (lo que paga de media) ÷ ${formatEuros(o.offeredAverage)} (media de la carta)`}
          value={num(o.ratio, 3)}
          target="entre 0,85 y 1,05"
          advice={ratioAdvice}
        />
      </div>
    </div>
  );
}

function Header({ ok, title }: { ok: boolean; title: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm font-semibold text-[var(--on-surface)]">{title}</div>
      <span className={`flex items-center gap-1 text-xs font-medium ${ok ? 'text-[var(--on-surface)]' : 'text-[var(--error)]'}`}>
        <span className="material-symbols-outlined text-base" aria-hidden>
          {ok ? 'check_circle' : 'error'}
        </span>
        {ok ? 'Cumple' : 'No cumple'}
      </span>
    </div>
  );
}

function Principle(p: { ok: boolean; title: string; formula: string; value: string; target: string; advice: string }) {
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <Header ok={p.ok} title={p.title} />
      <p className="text-xs text-[var(--on-surface-variant)]">{p.formula}</p>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-[var(--on-surface)]">{p.value}</div>
      <div className="text-xs text-[var(--on-surface-variant)]">Recomendado: {p.target}</div>
      <p className="mt-2 text-sm text-[var(--on-surface)]">{p.advice}</p>
    </div>
  );
}
