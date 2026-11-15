import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  /** Variación en % frente a la comparación; null si no hay con qué comparar. */
  delta: number | null;
  /** Texto de la cifra de comparación (p. ej. «año anterior: 1.234 €»). */
  compareText?: string;
  /** true si subir es malo (anulaciones): invierte el color, no la flecha. */
  higherIsWorse?: boolean;
}

/** Tarjeta de KPI: cifra grande + variación con flecha y signo (nunca solo color). */
export function KpiCard({ label, value, delta, compareText, higherIsWorse }: Props) {
  const good = delta !== null && delta !== 0 && (delta > 0) !== !!higherIsWorse;
  const tone =
    delta === null || delta === 0
      ? 'text-[var(--on-surface-variant)]'
      : good
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-red-700 dark:text-red-400';
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--on-surface-variant)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--on-surface)]">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-sm tabular-nums ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden />
        {delta === null ? 'sin comparación' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('es-ES')} %`}
      </div>
      {compareText && <div className="mt-0.5 text-xs text-[var(--on-surface-variant)]">{compareText}</div>}
    </div>
  );
}
