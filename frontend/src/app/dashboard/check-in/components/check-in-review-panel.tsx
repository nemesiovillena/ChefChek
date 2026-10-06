'use client';

import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateAdjustment, usePunchesForReview } from '@/hooks/use-check-in';
import { PUNCH_LABELS, formatDayTime } from '@/lib/check-in-punch';
import type { ReviewPunch } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

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

function ReviewRow({ punch }: { punch: ReviewPunch }) {
  const notify = useNotification();
  const create = useCreateAdjustment();
  // Qué se va a hacer con el fichaje; hasta elegir no se pide el motivo.
  const [action, setAction] = useState<'CONFIRM' | 'VOID' | null>(null);
  const [reason, setReason] = useState('');

  async function handleSave() {
    if (!action) return;
    if (reason.trim().length < 5) {
      notify({ type: 'error', title: 'Falta el motivo', message: 'Explica brevemente la decisión.' });
      return;
    }
    try {
      await create.mutateAsync({
        kind: action,
        employeeId: punch.employeeId,
        targetPunchId: punch.id,
        reason: reason.trim(),
      });
      notify({
        type: 'success',
        title: action === 'CONFIRM' ? 'Fichaje dado por bueno' : 'Fichaje anulado',
        message: '',
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <li className="py-3">
      <p className="font-medium">
        {punch.employeeName} · {PUNCH_LABELS[punch.type]} · {formatDayTime(punch.occurredAt)}
      </p>
      <p className="text-sm text-[var(--on-surface-variant)]">
        {describeReasons(punch.reviewReason)}
        {punch.wasOffline && ' (fichado sin conexión)'}
      </p>
      {action ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              action === 'CONFIRM' ? 'Ej.: confirmado con la persona, estaba trabajando' : 'Ej.: fichó por error'
            }
            className={`${inputCls} min-h-[64px] py-2`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} disabled={create.isPending} className={primaryBtnCls}>
              {action === 'CONFIRM' ? 'Dar por bueno' : 'Anular fichaje'}
            </button>
            <button type="button" onClick={() => setAction(null)} className={secondaryBtnCls}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAction('CONFIRM')} className={secondaryBtnCls}>
            <Check className="h-4 w-4" /> Es correcto
          </button>
          <button type="button" onClick={() => setAction('VOID')} className={secondaryBtnCls}>
            <X className="h-4 w-4" /> Anular
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Fichajes que el sistema guardó pero no pudo dar por buenos (casi siempre
 * hechos sin conexión). Gerencia decide: es correcto o se anula; en ambos
 * casos queda una corrección con su motivo y el fichaje original no se toca.
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
          Están registrados con su hora. Compruébalos con la persona. Para cambiar la hora, usa Registro de jornada →
          Equipo.
        </p>
        <ul className="divide-y divide-[var(--outline-variant)]">
          {punches.map((punch) => (
            <ReviewRow key={punch.id} punch={punch} />
          ))}
        </ul>
      </div>
    </section>
  );
}
