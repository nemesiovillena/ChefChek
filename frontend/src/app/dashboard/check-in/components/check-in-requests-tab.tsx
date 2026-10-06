'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useDecideAdjustment, usePendingAdjustments } from '@/hooks/use-check-in';
import { PUNCH_LABELS } from '@/lib/check-in-punch';
import type { Adjustment } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Qué pide la corrección, en una frase. */
export function describeAdjustment(a: Adjustment): string {
  const punch = a.type && a.occurredAt ? `${PUNCH_LABELS[a.type].toLowerCase()} el ${formatDateTime(a.occurredAt)}` : '';
  switch (a.kind) {
    case 'ADD':
      return `Añadir ${punch}`;
    case 'VOID':
      return 'Anular un fichaje';
    case 'REPLACE':
      return `Cambiar un fichaje por ${punch}`;
    case 'CONFIRM':
      return 'Dar por bueno un fichaje marcado a revisar';
  }
}

function RequestCard({ adjustment }: { adjustment: Adjustment }) {
  const notify = useNotification();
  const decide = useDecideAdjustment();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  async function handle(approve: boolean) {
    if (!approve && !note.trim()) {
      notify({ type: 'error', title: 'Falta la explicación', message: 'Indica por qué se rechaza.' });
      return;
    }
    try {
      await decide.mutateAsync({ id: adjustment.id, approve, note: note.trim() || undefined });
      notify({ type: 'success', title: approve ? 'Corrección aprobada' : 'Solicitud rechazada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} space-y-2`}>
      <p className="font-medium">
        {adjustment.employeeName} · {describeAdjustment(adjustment)}
      </p>
      <p className="text-sm">Motivo: {adjustment.reason}</p>
      <p className="text-sm text-[var(--on-surface-variant)]">
        Solicitado por {adjustment.requestedByName} el {formatDateTime(adjustment.createdAt)}
      </p>
      {rejecting && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por qué se rechaza (lo verá el empleado)"
          className={`${inputCls} min-h-[72px] py-2`}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!rejecting && (
          <button type="button" onClick={() => handle(true)} disabled={decide.isPending} className={primaryBtnCls}>
            <Check className="h-4 w-4" /> Aprobar
          </button>
        )}
        <button
          type="button"
          onClick={() => (rejecting ? handle(false) : setRejecting(true))}
          disabled={decide.isPending}
          className={secondaryBtnCls}
        >
          <X className="h-4 w-4" /> {rejecting ? 'Confirmar rechazo' : 'Rechazar'}
        </button>
        {rejecting && (
          <button type="button" onClick={() => setRejecting(false)} className={secondaryBtnCls}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/** Solicitudes de corrección pendientes de respuesta. */
export function CheckInRequestsTab() {
  const { data: pending, isLoading } = usePendingAdjustments();
  if (isLoading || !pending) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (pending.length === 0) {
    return <p className="text-[var(--on-surface-variant)]">No hay solicitudes pendientes.</p>;
  }
  return (
    <div className="space-y-3">
      {pending.map((adjustment) => (
        <RequestCard key={adjustment.id} adjustment={adjustment} />
      ))}
    </div>
  );
}
