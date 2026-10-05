'use client';

import { useState } from 'react';
import { Coffee, Loader2, LogIn, LogOut, MapPinOff, Play } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAckOwnLegalTexts, useOwnCheckIn, useRecordPunch } from '@/hooks/use-check-in';
import {
  GEOFENCE_LABELS,
  PUNCH_ACTION_LABELS,
  PUNCH_LABELS,
  STATUS_LABELS,
  formatDayTime,
  formatTime,
  getDevicePosition,
  newPunchId,
} from '@/lib/check-in-punch';
import type { LegalTextForEmployee, OwnCheckInState, PunchType } from '@/lib/check-in-types';
import { cardCls, errorMessage, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

const PUNCH_ICONS: Record<PunchType, typeof LogIn> = {
  IN: LogIn,
  OUT: LogOut,
  BREAK_START: Coffee,
  BREAK_END: Play,
};

/** Información que hay que leer y aceptar antes del primer fichaje. */
function LegalAckGate({ texts }: { texts: LegalTextForEmployee[] }) {
  const notify = useNotification();
  const ack = useAckOwnLegalTexts();

  async function handleAck() {
    try {
      await ack.mutateAsync();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} space-y-4`}>
      <p className="font-semibold">Antes de fichar, lee esta información</p>
      {texts.map((text) => (
        <section key={text.id}>
          <h3 className="mb-1 font-medium">{text.title}</h3>
          <p className="max-h-60 overflow-y-auto whitespace-pre-line rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
            {text.content}
          </p>
        </section>
      ))}
      <button type="button" onClick={handleAck} disabled={ack.isPending} className={`${primaryBtnCls} w-full`}>
        {ack.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        He leído y entiendo esta información
      </button>
    </div>
  );
}

function PunchPanel({ state }: { state: OwnCheckInState }) {
  const notify = useNotification();
  const record = useRecordPunch();
  // Tipo que se está enviando: bloquea los botones mientras se obtiene la ubicación y se guarda.
  const [sending, setSending] = useState<PunchType | null>(null);

  async function handlePunch(type: PunchType) {
    setSending(type);
    // El id se fija antes de pedir la ubicación: si la red falla y se reintenta, no se duplica.
    const id = newPunchId();
    try {
      const position = await getDevicePosition();
      const saved = await record.mutateAsync({
        id,
        type,
        deviceTime: new Date().toISOString(),
        ...(position ?? {}),
      });
      const warning = GEOFENCE_LABELS[saved.geofenceStatus];
      notify({
        type: warning ? 'warning' : 'success',
        title: `${PUNCH_LABELS[type]} registrada a las ${formatTime(saved.occurredAt)}`,
        message: warning ? `Marcado como: ${warning.toLowerCase()}.` : '',
      });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo fichar', message: errorMessage(err) });
    } finally {
      setSending(null);
    }
  }

  const status = state.status ?? 'OUT';

  return (
    <div className={`${cardCls} space-y-4`}>
      <div>
        <p className="text-sm text-[var(--on-surface-variant)]">{state.employee?.name}</p>
        <p className="text-2xl font-semibold">
          {STATUS_LABELS[status]}
          {state.since && status !== 'OUT' && (
            <span className="ml-2 text-base font-normal text-[var(--on-surface-variant)]">
              desde las {formatTime(state.since)}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {state.allowedTypes.map((type, index) => {
          const Icon = PUNCH_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => handlePunch(type)}
              disabled={sending !== null}
              className={`${index === 0 ? primaryBtnCls : secondaryBtnCls} min-h-[64px] flex-1 text-lg`}
            >
              {sending === type ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              {PUNCH_ACTION_LABELS[type]}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-[var(--on-surface-variant)]">
        Al fichar se registra tu ubicación en ese instante, si el dispositivo la da.
      </p>

      {state.recentPunches.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--on-surface-variant)]">Últimos fichajes</p>
          <ul className="divide-y divide-[var(--outline-variant)]">
            {state.recentPunches.map((punch) => {
              const warning = GEOFENCE_LABELS[punch.geofenceStatus];
              return (
                <li key={punch.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium">{PUNCH_LABELS[punch.type]}</span>
                  <span className="flex items-center gap-2 text-[var(--on-surface-variant)]">
                    {warning && (
                      <span className="flex items-center gap-1 text-[var(--error)]">
                        <MapPinOff className="h-4 w-4" /> {warning}
                      </span>
                    )}
                    {formatDayTime(punch.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Fichaje desde la cuenta personal: sin PIN, la sesión identifica al empleado. */
export function CheckInPersonalCard() {
  const { data: state, isLoading } = useOwnCheckIn();

  if (isLoading || !state) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  if (state.isSharedAccount) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Esta es una cuenta compartida</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Desde aquí se ficha en modo kiosco: cada persona elige su nombre e introduce su PIN.
        </p>
      </div>
    );
  }
  if (!state.employee) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Tu cuenta no está vinculada a una ficha de empleado</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Pide a un administrador que la vincule en Empleados para poder fichar desde aquí.
        </p>
      </div>
    );
  }
  if (!state.readiness.ready) {
    return (
      <div className={cardCls}>
        <p className="font-medium">El fichaje todavía no está disponible</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          La empresa tiene que terminar de configurarlo. Avisa a un administrador.
        </p>
      </div>
    );
  }
  if (!state.employee.isActive) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Tu ficha de empleado está dada de baja</p>
      </div>
    );
  }
  if (state.pendingLegalTexts.length > 0) return <LegalAckGate texts={state.pendingLegalTexts} />;
  return <PunchPanel state={state} />;
}
