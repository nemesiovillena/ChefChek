'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useDecideAbsence, usePendingAbsences } from '@/hooks/use-turnos';
import type { Absence } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { formatDays, formatRange } from './absence-format';

function RequestCard({ absence }: { absence: Absence }) {
  const notify = useNotification();
  const decide = useDecideAbsence();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  async function handle(approve: boolean) {
    if (!approve && !note.trim()) {
      notify({ type: 'error', title: 'Falta la explicación', message: 'Indica por qué se rechaza.' });
      return;
    }
    try {
      await decide.mutateAsync({ id: absence.id, approve, note: note.trim() || undefined });
      notify({ type: 'success', title: approve ? 'Ausencia aprobada' : 'Solicitud rechazada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} space-y-2`}>
      <p className="flex items-center gap-2 font-medium">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: absence.type.color }} aria-hidden />
        {absence.employeeName} · {absence.type.name}
      </p>
      <p className="text-sm">
        {formatRange(absence)} · {formatDays(absence.days)}
      </p>
      {absence.note && <p className="text-sm text-[var(--on-surface-variant)]">Nota: {absence.note}</p>}
      {rejecting && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por qué se rechaza (lo verá la persona)"
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

/** Solicitudes de ausencia pendientes de respuesta. */
export function AbsenceRequestsTab() {
  const { data: pending, isLoading } = usePendingAbsences();
  if (isLoading || !pending) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (pending.length === 0) return <p className="text-[var(--on-surface-variant)]">No hay solicitudes pendientes.</p>;
  return (
    <div className="space-y-3">
      {pending.map((absence) => (
        <RequestCard key={absence.id} absence={absence} />
      ))}
    </div>
  );
}
