"use client";

import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import type {
  AccountingCheck,
  PeriodFigures,
} from "../api/gestion-results-api";
import { formatEuros } from "../gestion-format";

const cardCls =
  "rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4";
const th = "px-2 py-2 text-right font-medium";
const td = "px-2 py-1.5 text-right tabular-nums";
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const pct = (n: number | null) =>
  n === null
    ? "—"
    : `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
const share = (part: number, f: PeriodFigures) =>
  f.sales > 0 ? (part / f.sales) * 100 : null;

type Level = "bien" | "vigilar" | "alto";

/**
 * Referencias orientativas de restauración en España, en % sobre ventas sin
 * IVA. «good» y «warn» son los límites de bien y de vigilar; por encima, alto.
 * El resultado va al revés: cuanto más, mejor.
 */
const RATIOS: {
  key: string;
  label: string;
  value: (f: PeriodFigures) => number;
  good: number;
  warn: number;
  higherIsBetter?: boolean;
  hint: string;
}[] = [
  {
    key: "producto",
    label: "Coste de producto",
    value: (f) => f.purchases,
    good: 30,
    warn: 35,
    hint: "compras sobre ventas; referencia ≤ 30 %",
  },
  {
    key: "personal",
    label: "Personal",
    value: (f) => f.labor,
    good: 35,
    warn: 40,
    hint: "nóminas + Seguridad Social; referencia ≤ 35 %",
  },
  {
    key: "primo",
    label: "Coste primo",
    value: (f) => f.purchases + f.labor,
    good: 60,
    warn: 65,
    hint: "producto + personal; referencia ≤ 60–65 %",
  },
  {
    key: "generales",
    label: "Gastos generales",
    value: (f) => f.overheads,
    good: 15,
    warn: 20,
    hint: "alquiler, suministros, limpieza…; referencia ≤ 15 %",
  },
  {
    key: "resultado",
    label: "Resultado",
    value: (f) => f.result,
    good: 10,
    warn: 5,
    higherIsBetter: true,
    hint: "beneficio sobre ventas; referencia ≥ 10 %",
  },
];

function level(p: number, r: (typeof RATIOS)[number]): Level {
  if (r.higherIsBetter)
    return p >= r.good ? "bien" : p >= r.warn ? "vigilar" : "alto";
  return p <= r.good ? "bien" : p <= r.warn ? "vigilar" : "alto";
}

const LEVEL_UI: Record<
  Level,
  {
    label: (higherIsBetter?: boolean) => string;
    cls: string;
    Icon: typeof CheckCircle2;
  }
> = {
  bien: {
    label: () => "Bien",
    cls: "text-green-700 dark:text-green-400",
    Icon: CheckCircle2,
  },
  vigilar: {
    label: () => "Vigilar",
    cls: "text-amber-700 dark:text-amber-400",
    Icon: CircleAlert,
  },
  alto: {
    label: (h) => (h ? "Bajo" : "Alto"),
    cls: "text-red-700 dark:text-red-400",
    Icon: AlertTriangle,
  },
};

/**
 * Balance del gestor frente a Gestión: qué cuadra y qué no (y dónde mirar),
 * y los porcentajes sobre ventas con semáforo y el año anterior.
 */
export function AccountingCheckCard({ checks }: { checks: AccountingCheck[] }) {
  if (checks.length === 0) {
    return (
      <div className={cardCls}>
        <div className="mb-1 text-sm font-semibold text-[var(--on-surface)]">
          Cuadre con la contabilidad
        </div>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Importa el balance de explotación del gestor (abajo, en Gastos) para
          cuadrarlo con las ventas de Cuiner, los albaranes y los fichajes, y
          ver los porcentajes sobre ventas con su semáforo.
        </p>
      </div>
    );
  }
  return (
    <>
      {checks.map((c) => (
        <div key={c.from + c.to} className="space-y-4">
          <Ratios check={c} />
          <Reconciliation check={c} />
        </div>
      ))}
    </>
  );
}

function Ratios({ check }: { check: AccountingCheck }) {
  const { books, previousBooks: prev } = check;
  return (
    <div className={cardCls}>
      <div className="mb-3 text-sm font-semibold text-[var(--on-surface)]">
        Porcentajes sobre ventas · contabilidad {day(check.from)} –{" "}
        {day(check.to)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm text-[var(--on-surface)]">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              <th className="px-2 py-2 text-left font-medium">Concepto</th>
              <th className={th}>Importe</th>
              <th className={th}>% ventas</th>
              {prev && <th className={th}>Año anterior</th>}
              {prev && <th className={th}>Diferencia</th>}
              <th className="px-2 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {RATIOS.map((r) => {
              const p = share(r.value(books), books);
              const pp = prev ? share(r.value(prev), prev) : null;
              const ui = p === null ? null : LEVEL_UI[level(p, r)];
              return (
                <tr
                  key={r.key}
                  className="border-b border-[var(--outline-variant)]"
                >
                  <td className="px-2 py-1.5">
                    {r.label}
                    <span className="block text-xs text-[var(--on-surface-variant)]">
                      {r.hint}
                    </span>
                  </td>
                  <td className={td}>{formatEuros(r.value(books))}</td>
                  <td className={`${td} font-semibold`}>{pct(p)}</td>
                  {prev && <td className={td}>{pct(pp)}</td>}
                  {prev && (
                    <td className={td}>
                      {p === null || pp === null
                        ? "—"
                        : `${p - pp > 0 ? "+" : ""}${(p - pp).toLocaleString("es-ES", { maximumFractionDigits: 1 })} p.`}
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    {ui && (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${ui.cls}`}
                      >
                        <ui.Icon className="h-4 w-4" aria-hidden />
                        {ui.label(r.higherIsBetter)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
        Ventas {formatEuros(books.sales)} sin IVA
        {prev ? ` (año anterior ${formatEuros(prev.sales)})` : ""}. Referencias
        orientativas de restauración; cada local tiene las suyas.
      </p>
    </div>
  );
}

/** Diferencias que merecen un aviso: más de un 2 % y más de 100 €. */
const differs = (a: number, b: number) =>
  Math.abs(a - b) > Math.max(100, Math.abs(b) * 0.02);

function Reconciliation({ check }: { check: AccountingCheck }) {
  const { books, gestion } = check;
  const rows: {
    label: string;
    source: string;
    g: number;
    b: number;
    hint: (g: number, b: number) => string;
  }[] = [
    {
      label: "Ventas",
      source: "Cuiner",
      g: gestion.sales,
      b: books.sales,
      hint: (g, b) =>
        g < b
          ? "El gestor tiene ventas que no pasan por Cuiner (otros canales, facturas aparte)."
          : "Cuiner tiene ventas que el gestor no ha contabilizado.",
    },
    {
      label: "Compras",
      source: "albaranes",
      g: gestion.purchases,
      b: books.purchases,
      hint: (g, b) =>
        g < b
          ? "Faltan albaranes en ChefChek (meses sin albaranes o facturas sin albarán): el coste de producto de Gestión sale bajo."
          : "Hay albaranes que el gestor aún no ha contabilizado, o alguno mal leído.",
    },
    {
      label: "Personal",
      source: "fichajes × coste/hora",
      g: gestion.labor,
      b: books.labor,
      hint: (g) =>
        g === 0
          ? "No hay fichajes con coste/hora en esos meses."
          : "Revisa el coste/hora de las fichas: debe incluir la Seguridad Social de la empresa.",
    },
    {
      label: "Gastos generales",
      source: "introducidos",
      g: gestion.overheads,
      b: books.overheads,
      hint: () =>
        "Los gastos introducidos en Gestión no coinciden con el balance.",
    },
  ];
  return (
    <div className={cardCls}>
      <div className="mb-3 text-sm font-semibold text-[var(--on-surface)]">
        Cuadre con la contabilidad · {day(check.from)} – {day(check.to)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm text-[var(--on-surface)]">
          <thead>
            <tr className="border-b border-[var(--outline-variant)] text-xs uppercase tracking-wide text-[var(--on-surface-variant)]">
              <th className="px-2 py-2 text-left font-medium">Concepto</th>
              <th className={th}>Gestión</th>
              <th className={th}>Contabilidad</th>
              <th className={th}>Diferencia</th>
              <th className="px-2 py-2 text-left font-medium">Qué mirar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bad = differs(r.g, r.b);
              return (
                <tr
                  key={r.label}
                  className="border-b border-[var(--outline-variant)] align-top"
                >
                  <td className="px-2 py-1.5">
                    {r.label}
                    <span className="block text-xs text-[var(--on-surface-variant)]">
                      {r.source}
                    </span>
                  </td>
                  <td className={td}>{formatEuros(r.g)}</td>
                  <td className={td}>{formatEuros(r.b)}</td>
                  <td className={`${td} ${bad ? "font-semibold" : ""}`}>
                    {r.g - r.b > 0 ? "+" : ""}
                    {formatEuros(r.g - r.b)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-[var(--on-surface-variant)]">
                    {bad ? (
                      <span className="flex items-start gap-1">
                        <AlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
                          aria-hidden
                        />
                        {r.hint(r.g, r.b)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Cuadra
                      </span>
                    )}
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
