'use client';

import { useState } from 'react';
import { CloudOff, Coffee, Loader2, LogIn, LogOut, MapPinOff, Play, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { CHECK_IN_KEYS, useAckOwnLegalTexts, useOwnCheckIn, useRecordPunch } from '@/hooks/use-check-in';
import { useOfflinePunchQueue } from '@/hooks/use-offline-punch-queue';
import { allowedAfter, enqueuePunch, isNetworkError, saveSnapshot, statusAfterPunch } from '@/lib/check-in-offline';
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

function PunchPanel({ state, userId }: { state: OwnCheckInState; userId: string }) {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const record = useRecordPunch();
  const { online, pendingCount, syncNow } = useOfflinePunchQueue(userId);
  const [syncingNow, setSyncingNow] = useState(false);

  /** Sin red: el fichaje queda en el dispositivo y la pantalla avanza igual. */
  function saveOffline(id: string, type: PunchType, deviceTime: string, position: Awaited<ReturnType<typeof getDevicePosition>>) {
    enqueuePunch(userId, { id, type, deviceTime, ...(position ?? {}) });
    const status = statusAfterPunch(type);
    const next: OwnCheckInState = {
      ...state,
      status,
      since: deviceTime,
      allowedTypes: allowedAfter(status),
      recentPunches: [
        { id, type, occurredAt: deviceTime, source: 'PERSONAL', locationName: null, geofenceStatus: 'OFF', distanceM: null, pending: true },
        ...state.recentPunches,
      ],
      offline: true,
    };
    saveSnapshot(`me.${userId}`, next);
    queryClient.setQueryData(CHECK_IN_KEYS.me, next);
  }

  async function handleSyncNow() {
    setSyncingNow(true);
    try {
      const outcomes = await syncNow();
      const flagged = outcomes.filter((o) => o.status === 'FLAGGED' || o.status === 'REJECTED').length;
      if (outcomes.length === 0) {
        notify({ type: 'warning', title: 'Sigue sin conexión', message: 'Se enviarán solos en cuanto vuelva la red.' });
      } else {
        notify({
          type: flagged ? 'warning' : 'success',
          title: `${outcomes.length} fichaje${outcomes.length === 1 ? '' : 's'} enviado${outcomes.length === 1 ? '' : 's'}`,
          message: flagged ? `${flagged} quedan pendientes de que los revise un responsable.` : '',
        });
      }
    } catch (err) {
      notify({ type: 'error', title: 'No se pudieron enviar', message: errorMessage(err) });
    } finally {
      setSyncingNow(false);
    }
  }
  // Tipo que se está enviando: bloquea los botones mientras se obtiene la ubicación y se guarda.
  const [sending, setSending] = useState<PunchType | null>(null);

  async function handlePunch(type: PunchType) {
    setSending(type);
    // El id se fija antes de pedir la ubicación: si la red falla y se reintenta, no se duplica.
    const id = newPunchId();
    const deviceTime = new Date().toISOString();
    // Sin red la ubicación suele tardar o fallar: se espera menos.
    const position = await getDevicePosition(online ? 8000 : 4000);
    try {
      if (!online) {
        saveOffline(id, type, deviceTime, position);
        notify({ type: 'warning', title: `${PUNCH_LABELS[type]} guardada sin conexión`, message: 'Se enviará sola al recuperar la red.' });
        return;
      }
      const saved = await record.mutateAsync({ id, type, deviceTime, ...(position ?? {}) });
      const warning = GEOFENCE_LABELS[saved.geofenceStatus];
      notify({
        type: warning ? 'warning' : 'success',
        title: `${PUNCH_LABELS[type]} registrada a las ${formatTime(saved.occurredAt)}`,
        message: warning ? `Marcado como: ${warning.toLowerCase()}.` : '',
      });
    } catch (err) {
      if (isNetworkError(err)) {
        // La red cayó justo al enviar: mismo id, así que no puede duplicarse.
        try {
          saveOffline(id, type, deviceTime, position);
          notify({ type: 'warning', title: `${PUNCH_LABELS[type]} guardada sin conexión`, message: 'Se enviará sola al recuperar la red.' });
        } catch {
          notify({ type: 'error', title: 'No se pudo fichar', message: 'Sin conexión y sin espacio en el dispositivo para guardarlo.' });
        }
      } else {
        notify({ type: 'error', title: 'No se pudo fichar', message: errorMessage(err) });
      }
    } finally {
      setSending(null);
    }
  }

  const status = state.status ?? 'OUT';

  return (
    <div className={`${cardCls} space-y-4`}>
      {(!online || pendingCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 text-sm">
          <span className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 shrink-0" />
            {!online && 'Sin conexión. Puedes fichar: se guardará en este dispositivo.'}
            {pendingCount > 0 &&
              ` ${pendingCount} fichaje${pendingCount === 1 ? '' : 's'} guardado${pendingCount === 1 ? '' : 's'} en este dispositivo, por enviar.`}
          </span>
          {pendingCount > 0 && online && (
            <button type="button" onClick={handleSyncNow} disabled={syncingNow} className="flex min-h-[40px] items-center gap-1 underline">
              {syncingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Enviar ahora
            </button>
          )}
        </div>
      )}
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
                  <span className="font-medium">
                    {PUNCH_LABELS[punch.type]}
                    {punch.pending && <span className="ml-2 font-normal text-[var(--on-surface-variant)]">(por enviar)</span>}
                    {punch.needsReview && <span className="ml-2 font-normal text-[var(--error)]">(a revisar)</span>}
                  </span>
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
  const { user } = useAuth();
  const { data: state, isLoading, error } = useOwnCheckIn(user?.id);

  if (error && !state) {
    return (
      <div className={cardCls}>
        <p className="font-medium">No se puede cargar el fichaje</p>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Sin conexión y sin datos guardados en este dispositivo. Abre esta pantalla una vez con conexión.
        </p>
      </div>
    );
  }
  if (isLoading || !state || !user) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

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
  return <PunchPanel state={state} userId={user.id} />;
}
