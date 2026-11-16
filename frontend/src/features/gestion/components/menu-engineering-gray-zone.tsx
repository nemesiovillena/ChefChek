'use client';

import Link from 'next/link';
import type { MenuEngineeringAnalysis } from '../api/gestion-menu-engineering-api';
import { formatEuros, formatQty } from '../gestion-format';

const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`);

/**
 * Zona gris: lo que se gasta en materia prima por encima de lo que dicen los
 * escandallos. Tres pasos del curso y los nueve sistemas de control, con dato
 * donde ChefChek lo tiene y como lista de revisión donde no.
 */
export function MenuEngineeringGrayZone({ data }: { data: MenuEngineeringAnalysis }) {
  const g = data.grayZone;
  const inv = g.controls.invitations;
  const can = g.controls.cancellations;
  const controls: { title: string; text: string; href?: string; link?: string }[] = [
    {
      title: 'Invitaciones',
      text: inv.units > 0 ? `${formatQty(inv.units)} uds. invitadas: ${formatEuros(inv.cost)} a coste (${formatEuros(inv.value)} a PVP).` : 'Ninguna marcada como invitación en caja.',
    },
    { title: 'Consumos de la propiedad', text: 'Sin dato: márcalos en caja como invitación o en una mesa propia para poder medirlos.' },
    { title: 'Consumos del personal', text: 'Sin dato: registra las comidas del personal (ver «Manutención» en Ratios de costes).' },
    {
      title: 'Cosas servidas no cobradas',
      text: 'Compara comandas de cocina con tickets; las invitaciones no marcadas acaban aquí.',
    },
    { title: 'Mermas secundarias', text: 'Sin dato: lo que se tira en preparación y sobras. Ver «Materia prima mal aprovechada».' },
    { title: 'Pesajes (recepción de mercancías)', text: 'Pesa y cuenta al recibir: cada kilo que falta se paga igual.', href: '/dashboard/albaranes', link: 'Albaranes' },
    { title: 'APPCC', text: 'Producto mal conservado o caducado es materia prima perdida.', href: '/dashboard/appcc/caducidades', link: 'Caducidades' },
    {
      title: 'Errores administrativos',
      text:
        can.lines > 0
          ? `${can.lines} líneas anuladas en caja (${can.tickets} tickets, ${formatEuros(can.total)} con IVA). Son sobre todo errores de marcado: revisa las grandes.`
          : 'Sin anulaciones en caja en el periodo.',
      href: '/dashboard/gestion/informes/anulaciones',
      link: 'Ver anulaciones',
    },
    { title: 'Fugas no autorizadas', text: 'Sin dato directo: es lo que queda de la zona gris cuando lo demás está controlado.' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Step n={1} title="Coste medio de tu carta" value={pct(g.menuAverageCostPct)} text="Media simple del % de coste de los platos vendidos, sin pesar cuánto se vende cada uno." />
        <Step
          n={2}
          title="Coste medio teórico"
          value={pct(g.theoreticalCostPct)}
          text={`Coste de escandallo de lo vendido en carta (${formatEuros(g.theoreticalCost)}) sobre su venta. Con escandallo el ${pct(g.coverage)} de lo servido.`}
        />
        <Step
          n={3}
          title="Coste real"
          value={pct(g.realCostPct)}
          text={`Compras de albaranes (${formatEuros(g.realCost)}) sobre la venta sin IVA (${formatEuros(g.salesBase)}).`}
        />
      </div>

      <div className="rounded-xl border-2 border-[var(--outline)] bg-[var(--surface-container)] p-4">
        <div className="text-sm font-semibold text-[var(--on-surface)]">Tu zona gris = coste real − coste teórico</div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-[var(--on-surface)]">
          {g.gapPoints === null ? '—' : `${g.gapPoints > 0 ? '+' : ''}${g.gapPoints.toLocaleString('es-ES')} puntos`}
        </div>
        {g.gapEuros !== null && (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {g.gapPoints! > 0
              ? `Unos ${formatEuros(g.gapEuros)} del periodo se van en materia prima que los escandallos no explican.`
              : 'El gasto real no supera al teórico en este periodo.'}
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
          Sin inventarios todavía: lo comprado y no gastado en el mes cuenta como gastado, así que compara meses completos y mira la tendencia.
          Cuentan las compras de comida y bebida; limpieza, menaje, envases y portes no son materia prima y van aparte (Ratios de costes).
        </p>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-[var(--on-surface)]">Sistemas de control</div>
        <ol className="grid gap-2 md:grid-cols-2">
          {controls.map((c, i) => (
            <li key={c.title} className="rounded-lg bg-[var(--surface-container-high)] p-3 text-sm">
              <div className="font-medium text-[var(--on-surface)]">
                {i + 1}. {c.title}
              </div>
              <p className="text-[var(--on-surface-variant)]">
                {c.text}{' '}
                {c.href && (
                  <Link href={c.href} className="font-medium text-[var(--primary)] underline">
                    {c.link}
                  </Link>
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Step({ n, title, value, text }: { n: number; title: string; value: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-variant)]">Paso {n}</div>
      <div className="text-sm font-semibold text-[var(--on-surface)]">{title}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-[var(--on-surface)]">{value}</div>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{text}</p>
    </div>
  );
}
