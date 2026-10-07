'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateAdjustment, useRequestAdjustment } from '@/hooks/use-check-in';
import { PUNCH_LABELS, formatTimeIn } from '@/lib/check-in-punch';
import type { AdjustmentKind, PunchType, WorkdayPunch } from '@/lib/check-in-types';
import { errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

const TYPES: PunchType[] = ['IN', 'OUT', 'BREAK_START', 'BREAK_END'];

interface Props {
  /** 'own': el empleado solicita (queda pendiente). 'manager': gerencia corrige (queda aprobada). */
  mode: 'own' | 'manager';
  employeeId: string;
  /** Día al que se refiere (AAAA-MM-DD). */
  date: string;
  timezone: string;
  /** Fichaje sobre el que se actúa; sin él, se añade uno nuevo. */
  target?: WorkdayPunch;
  onDone: () => void;
}

/**
 * Corrección de un fichaje. Nunca edita el original: añade, anula o sustituye
 * dejando constancia del motivo y de quién lo pide.
 */
export function CheckInAdjustmentForm({ mode, employeeId, date, timezone, target, onDone }: Props) {
  const notify = useNotification();
  const request = useRequestAdjustment();
  const create = useCreateAdjustment();
  const mutation = mode === 'own' ? request : create;

  const [kind, setKind] = useState<AdjustmentKind>(target ? 'REPLACE' : 'ADD');
  const [type, setType] = useState<PunchType>(target?.type ?? 'OUT');
  const [time, setTime] = useState(target ? formatTimeIn(target.occurredAt, timezone) : '');
  const [reason, setReason] = useState('');
  const needsNewPunch = kind === 'ADD' || kind === 'REPLACE';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      notify({ type: 'error', title: 'Falta el motivo', message: 'Explica brevemente por qué se corrige.' });
      return;
    }
    if (needsNewPunch && !time) {
      notify({ type: 'error', title: 'Falta la hora', message: '' });
      return;
    }
    try {
      await mutation.mutateAsync({
        kind,
        employeeId: mode === 'manager' ? employeeId : undefined,
        targetPunchId: target?.id,
        type: needsNewPunch ? type : undefined,
        // La hora se interpreta en el horario de este dispositivo.
        occurredAt: needsNewPunch ? new Date(`${date}T${time}`).toISOString() : undefined,
        reason: reason.trim(),
      });
      notify({
        type: 'success',
        title: mode === 'own' ? 'Solicitud enviada' : 'Corrección registrada',
        message: mode === 'own' ? 'Un responsable la revisará.' : '',
      });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      {target ? (
        <label className="block">
          <span className={labelCls}>
            {PUNCH_LABELS[target.type]} de las {formatTimeIn(target.occurredAt, timezone)}
          </span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AdjustmentKind)} className={inputCls}>
            <option value="REPLACE">Cambiar la hora o el tipo</option>
            <option value="VOID">Anular (no debería existir)</option>
          </select>
        </label>
      ) : (
        <p className="font-medium">Añadir un fichaje que falta</p>
      )}

      {needsNewPunch && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as PunchType)} className={inputCls}>
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {PUNCH_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Hora correcta</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}

      <label className="block">
        <span className={labelCls}>Motivo (queda en el registro)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: olvidé fichar la salida"
          className={`${inputCls} min-h-[72px] py-2`}
        />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className={`${primaryBtnCls} flex-1`}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {mode === 'own' ? 'Solicitar corrección' : 'Registrar corrección'}
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
