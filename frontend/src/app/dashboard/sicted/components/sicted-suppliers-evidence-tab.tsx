'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, PackageCheck, Tag, Timer } from 'lucide-react';
import { useSictedProcurementEvidence } from '@/hooks/use-sicted-suppliers';

const inputCls =
  'min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Panel de evidencia de aprovisionamiento (PROV.4/PROV.6/PROV.7/PROV.8) — solo
 * lectura. "n de m con lote", nunca un % que oculte huecos (ver plan fase 6).
 */
export function SictedSuppliersEvidenceTab() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthValue());

  const { from, to } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
      to: new Date(Date.UTC(y, m, 1)).toISOString(),
    };
  }, [month]);

  const { data: evidence, isLoading } = useSictedProcurementEvidence(from, to);

  return (
    <div>
      <label className="mb-4 block text-sm">
        <span className="block text-[var(--on-surface-variant)]">Mes</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} mt-1`} style={{ colorScheme: 'light dark' }} />
      </label>

      {isLoading || !evidence ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
            <h4 className="mb-1 flex items-center gap-2 font-semibold">
              <PackageCheck className="h-4 w-4" /> Recepciones confirmadas (PROV.4)
            </h4>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {evidence.receptions.confirmedCount} recepciones · {evidence.receptions.withLotCount} de {evidence.receptions.confirmedCount} con
              lote de trazabilidad
            </p>
          </section>

          <section className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
            <h4 className="mb-1 flex items-center gap-2 font-semibold">
              <Timer className="h-4 w-4" /> Caducidad próxima (PROV.6/PROV.8)
            </h4>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {evidence.expiringSoon.count} etiquetas dentro del umbral de {evidence.expiringSoon.warningDays} días —{' '}
              <button type="button" onClick={() => router.push('/dashboard/appcc/caducidades')} className="underline">
                ver detalle
              </button>
            </p>
          </section>

          <section className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
            <h4 className="mb-1 flex items-center gap-2 font-semibold">
              <Tag className="h-4 w-4" /> Etiquetado interno (PROV.6)
            </h4>
            <p className="text-sm text-[var(--on-surface-variant)]">{evidence.labelsIssued.count} etiquetas emitidas este mes</p>
          </section>

          <section className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
            <h4 className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Stock fuera de rango (PROV.7)
            </h4>
            {evidence.stockAlerts.belowMinimumCount + evidence.stockAlerts.aboveMaximumCount === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">Todo el stock dentro de mínimo/máximo.</p>
            ) : (
              <div className="space-y-1">
                {evidence.stockAlerts.belowMinimum.map((s) => (
                  <div
                    key={`below-${s.productId}`}
                    className="flex items-center justify-between rounded-lg bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]"
                  >
                    <span>{s.productName}</span>
                    <span>
                      {s.quantity} (mín. {s.minimumStock})
                    </span>
                  </div>
                ))}
                {evidence.stockAlerts.aboveMaximum.map((s) => (
                  <div
                    key={`above-${s.productId}`}
                    className="flex items-center justify-between rounded-lg bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]"
                  >
                    <span>{s.productName}</span>
                    <span>
                      {s.quantity} (máx. {s.maximumStock})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
