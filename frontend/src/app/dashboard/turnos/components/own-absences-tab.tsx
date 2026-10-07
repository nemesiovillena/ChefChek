'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useAbsenceTypes, useCancelOwnAbsence, useOwnAbsences, useOwnBalance } from '@/hooks/use-turnos';
import { ABSENCE_STATUS_LABELS, type Absence } from '@/lib/turnos-types';
import { cardCls, errorMessage, primaryBtnCls } from '../../check-in/components/check-in-form-styles';
import { AbsenceForm } from './absence-form';
import { STATUS_COLORS, formatDays, formatRange } from './absence-format';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-[var(--on-surface-variant)]">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function AbsenceRow({ absence }: { absence: Absence }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const cancel = useCancelOwnAbsence();

  async function handleCancel() {
    const ok = await confirm({ title: 'Retirar solicitud', description: 'Se cancelará tu solicitud pendiente.' });
    if (!ok) return;
    try {
      await cancel.mutateAsync(absence.id);
      notify({ type: 'success', title: 'Solicitud retirada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: absence.type.color }} aria-hidden />
          {absence.type.name} · {formatRange(absence)}
        </p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {formatDays(absence.days)} ·{' '}
          <span className={STATUS_COLORS[absence.status]}>{ABSENCE_STATUS_LABELS[absence.status]}</span>
          {absence.decisionNote && ` · ${absence.decisionNote}`}
        </p>
      </div>
      {absence.status === 'PENDING' && (
        <button type="button" onClick={handleCancel} disabled={cancel.isPending} className="min-h-[40px] px-2 text-sm underline">
          Retirar
        </button>
      )}
    </li>
  );
}

/** Mis ausencias del año: saldo de vacaciones, solicitar y ver el estado. */
export function OwnAbsencesTab({ year }: { year: number }) {
  const { data: balance, isError: noEmployee } = useOwnBalance(year);
  const { data: absences } = useOwnAbsences(year, !noEmployee);
  const { data: types } = useAbsenceTypes();
  const [adding, setAdding] = useState(false);

  if (noEmployee) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Tu cuenta no está vinculada a una ficha de empleado</p>
        <p className="text-sm text-[var(--on-surface-variant)]">Por eso no tienes ausencias propias que gestionar.</p>
      </div>
    );
  }
  if (!balance || !types) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <p className="mb-3 font-medium">Vacaciones de {year}</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Te corresponden" value={formatDays(balance.entitledDays + balance.carriedOverDays + balance.adjustmentDays)} />
          <Stat label="Aprobadas" value={formatDays(balance.usedDays)} />
          <Stat label="Pendientes de respuesta" value={formatDays(balance.pendingDays)} />
          <Stat label="Te quedan" value={formatDays(balance.remainingDays)} />
        </div>
      </div>

      {adding ? (
        <AbsenceForm mode="own" types={types} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={primaryBtnCls}>
          <Plus className="h-4 w-4" /> Solicitar ausencia
        </button>
      )}

      <div className={cardCls}>
        {absences && absences.length > 0 ? (
          <ul className="divide-y divide-[var(--outline-variant)]">
            {absences.map((absence) => (
              <AbsenceRow key={absence.id} absence={absence} />
            ))}
          </ul>
        ) : (
          <p className="text-[var(--on-surface-variant)]">No tienes ausencias en {year}.</p>
        )}
      </div>
    </div>
  );
}
