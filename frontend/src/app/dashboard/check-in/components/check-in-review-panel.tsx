'use client';

import { AlertTriangle } from 'lucide-react';
import { usePunchesForReview } from '@/hooks/use-check-in';
import { PUNCH_LABELS, formatDayTime } from '@/lib/check-in-punch';
import { cardCls } from './check-in-form-styles';

const REASON_LABELS: Record<string, string> = {
  PIN: 'PIN sin verificar',
  SECUENCIA: 'no encaja con los fichajes anteriores o posteriores',
  FUERA_DE_ZONA: 'fuera de la zona del centro',
  RELOJ: 'reloj del dispositivo adelantado',
};

const describeReasons = (reason: string | null) =>
  (reason ?? '')
    .split(',')
    .filter(Boolean)
    .map((code) => REASON_LABELS[code] ?? code)
    .join('; ');

/**
 * Fichajes que el sistema guardó pero no pudo dar por buenos (casi siempre
 * hechos sin conexión). No se pierden: quedan aquí para que gerencia los vea.
 */
export function CheckInReviewPanel() {
  const { data: punches } = usePunchesForReview();
  if (!punches || punches.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <AlertTriangle className="h-5 w-5 text-[var(--error)]" /> Fichajes a revisar ({punches.length})
      </h3>
      <div className={cardCls}>
        <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
          Están registrados con su hora. Compruébalos con la persona; las correcciones se documentarán desde el registro
          de jornada.
        </p>
        <ul className="divide-y divide-[var(--outline-variant)]">
          {punches.map((punch) => (
            <li key={punch.id} className="py-2">
              <p className="font-medium">
                {punch.employeeName} · {PUNCH_LABELS[punch.type]} · {formatDayTime(punch.occurredAt)}
              </p>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {describeReasons(punch.reviewReason)}
                {punch.wasOffline && ' (fichado sin conexión)'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
