'use client';

import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useSictedRunsDetails } from '@/hooks/use-sicted';
import type { ChecklistRunSummary } from '@/lib/sicted-types';

interface SictedMonthMatrixProps {
  runs: ChecklistRunSummary[];
}

const fmtPeriod = (key: string) => key; // periodKey ya es legible (día ISO / semana ISO / mes)

/**
 * Filas = ítems de la plantilla, columnas = periodos (uno por hoja del rango
 * elegido) — cuadrante clásico del documento en papel para detectar huecos.
 * Contenedor propio con scroll horizontal (globals.css / regla responsive).
 */
export function SictedMonthMatrix({ runs }: SictedMonthMatrixProps) {
  const router = useRouter();
  const sorted = [...runs].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const runIds = sorted.map((r) => r.id);
  const { data: details, isLoading } = useSictedRunsDetails(runIds);

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
        Sin hojas en este periodo para la plantilla elegida.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const byId = new Map(details.map((d) => [d.id, d]));
  const items = sorted[0]?.snapshot.items ?? [];

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)]">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--surface-container-high)]">
          <tr>
            <th className="sticky left-0 z-10 min-w-[160px] bg-[var(--surface-container-high)] px-3 py-2 text-left">
              Elemento
            </th>
            {sorted.map((run) => (
              <th key={run.id} className="min-w-[64px] px-2 py-2 text-center font-normal">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/sicted/registros/${run.id}`)}
                  className="flex flex-col items-center gap-0.5 hover:text-[var(--primary)]"
                >
                  {fmtPeriod(run.periodKey)}
                  {run.supervisedAt && <ShieldCheck className="h-3 w-3 text-[var(--primary)]" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-[var(--outline-variant)]">
              <td className="sticky left-0 z-10 bg-[var(--surface-container-lowest)] px-3 py-2 font-medium">
                {item.label}
              </td>
              {sorted.map((run) => {
                const entry = byId.get(run.id)?.currentByItem[item.id];
                return (
                  <td key={run.id} className="px-2 py-2 text-center">
                    <MatrixCell outcome={entry?.outcome} withinRange={entry?.withinRange} value={entry?.value} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixCell({
  outcome,
  withinRange,
  value,
}: {
  outcome?: string | null;
  withinRange?: boolean | null;
  value?: number | null;
}) {
  if (value !== undefined && value !== null) {
    return (
      <span
        className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 text-xs font-semibold ${
          withinRange === false
            ? 'bg-[var(--error-container)] text-[var(--on-error-container)]'
            : 'bg-[var(--surface-container-high)]'
        }`}
      >
        {value}
      </span>
    );
  }
  if (!outcome) {
    return <span className="inline-block h-3 w-3 rounded-full bg-[var(--surface-container-high)]" title="Sin marcar" />;
  }
  const ok = outcome === 'DONE' || outcome === 'OK';
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${ok ? 'bg-[var(--primary)]' : 'bg-[var(--error)]'}`}
      title={ok ? 'Hecho/Bien' : 'No realizado/Mal'}
    />
  );
}
