'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import {
  useAddSictedCalendarException,
  useJustifySictedClosedDayRuns,
  useRemoveSictedCalendarException,
  useSetSictedClosedWeekdays,
  useSictedClosureCalendar,
  type CalendarExceptionKind,
} from '@/hooks/use-sicted-closure-calendar';
import { formatPeriodKey } from '@/lib/sicted-types';

/** Lunes primero; el valor es el día de la semana de JS (0=domingo). */
const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const fieldCls =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-900';
const buttonCls =
  'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-40';

/**
 * Configuración → SICTED: días de cierre del local. En un día de cierre no se
 * generan hojas ni cuentan como hueco en la cobertura de Auditoría. Las
 * excepciones cubren vacaciones y los descansos en que sí se abre.
 */
export function SictedClosureCalendarForm({ canManage }: { canManage: boolean }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const { data: calendar, isLoading } = useSictedClosureCalendar();
  const setWeekdays = useSetSictedClosedWeekdays();
  const addException = useAddSictedCalendarException();
  const removeException = useRemoveSictedCalendarException();
  const justify = useJustifySictedClosedDayRuns();

  const [kind, setKind] = useState<CalendarExceptionKind>('OPEN');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [reason, setReason] = useState('');

  function notifyError(err: unknown) {
    notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
  }

  if (isLoading || !calendar) {
    return <Loader2 className="mb-6 h-5 w-5 animate-spin text-indigo-600" />;
  }

  async function toggleWeekday(day: number) {
    const current = calendar!.closedWeekdays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    try {
      await setWeekdays.mutateAsync(next);
    } catch (err) {
      notifyError(err);
    }
  }

  async function handleAdd() {
    try {
      await addException.mutateAsync({ kind, fromDay, toDay: toDay || fromDay, reason: reason.trim() || undefined });
      setFromDay('');
      setToDay('');
      setReason('');
      notify({ type: 'success', title: 'Fecha añadida', message: '' });
    } catch (err) {
      notifyError(err);
    }
  }

  async function handleJustify() {
    const count = calendar!.overdueOnClosedDays;
    await confirm({
      title: `¿Justificar ${count} ${count === 1 ? 'hoja vencida' : 'hojas vencidas'}?`,
      description:
        'Son hojas de días en que el local estuvo cerrado. Quedarán justificadas con el motivo «Local cerrado ese día» y no se podrán modificar después.',
      confirmText: 'Justificar',
      onConfirm: async () => {
        const { justified } = await justify.mutateAsync();
        notify({ type: 'success', title: `${justified} hojas justificadas`, message: '' });
      },
    });
  }

  return (
    <div className="mb-6">
      <h3 className="mb-1 font-semibold">Días de cierre</h3>
      <p className="mb-3 text-sm text-gray-500">
        Los días que el local cierra no se generan hojas ni cuentan como hueco en Auditoría.
      </p>

      <p className="mb-2 text-sm text-gray-500">Descanso semanal</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <label
            key={day.value}
            className={`flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 px-3 dark:border-zinc-700 ${canManage ? 'cursor-pointer' : 'opacity-70'}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={calendar.closedWeekdays.includes(day.value)}
              disabled={!canManage || setWeekdays.isPending}
              onChange={() => toggleWeekday(day.value)}
            />
            {day.label}
          </label>
        ))}
      </div>

      <p className="mb-2 text-sm text-gray-500">Fechas concretas (vacaciones, festivos, un descanso en que sí abrís)</p>
      {calendar.exceptions.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {calendar.exceptions.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-1 dark:border-zinc-700"
            >
              <span>
                <span className="font-medium">{e.kind === 'OPEN' ? 'Abrimos' : 'Cerramos'}</span>{' '}
                {formatPeriodKey(e.fromDay)}
                {e.toDay !== e.fromDay && ` – ${formatPeriodKey(e.toDay)}`}
                {e.reason && ` · ${e.reason}`}
                <span className="text-gray-500"> · {e.createdByName}</span>
              </span>
              {canManage && (
                <button
                  type="button"
                  aria-label="Quitar fecha"
                  disabled={removeException.isPending}
                  onClick={() => removeException.mutateAsync(e.id).catch(notifyError)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Qué pasa</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as CalendarExceptionKind)} className={fieldCls}>
                <option value="OPEN">Abrimos</option>
                <option value="CLOSED">Cerramos</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Desde</span>
              <input type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} className={fieldCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Hasta (opcional)</span>
              <input type="date" value={toDay} min={fromDay} onChange={(e) => setToDay(e.target.value)} className={fieldCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Motivo (opcional)</span>
              <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={fieldCls} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!fromDay || addException.isPending} onClick={handleAdd} className={buttonCls}>
              {addException.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Añadir fecha
            </button>
            {calendar.overdueOnClosedDays > 0 && (
              <button type="button" onClick={handleJustify} className={buttonCls}>
                Justificar {calendar.overdueOnClosedDays} {calendar.overdueOnClosedDays === 1 ? 'hoja vencida' : 'hojas vencidas'}{' '}
                de días de cierre
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
