'use client';

import { useOwnShifts } from '@/hooks/use-turnos';
import { cardCls } from '../../check-in/components/check-in-form-styles';
import { addDaysIso, formatHours, mondayOf } from './week-utils';

const formatLong = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Mis turnos publicados de esta semana y las tres siguientes. */
export function OwnShifts() {
  const from = mondayOf(new Date());
  const to = addDaysIso(from, 27);
  const { data: shifts, isLoading, isError } = useOwnShifts(from, to);

  if (isError) {
    return (
      <div className={cardCls}>
        <p className="font-medium">Tu cuenta no está vinculada a una ficha de empleado</p>
        <p className="text-sm text-[var(--on-surface-variant)]">Por eso no tienes turnos propios que mostrar.</p>
      </div>
    );
  }
  if (isLoading || !shifts) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (shifts.length === 0) {
    return (
      <div className={cardCls}>
        <p className="text-[var(--on-surface-variant)]">No tienes turnos publicados en las próximas cuatro semanas.</p>
      </div>
    );
  }

  // Un turno partido son dos turnos el mismo día: se agrupan por fecha.
  const days = [...new Set(shifts.map((s) => s.date))];
  return (
    <div className={cardCls}>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {days.map((date) => {
          const ofDay = shifts.filter((s) => s.date === date);
          return (
            <li key={date} className="py-3">
              <p className="font-medium capitalize">{formatLong(date)}</p>
              {ofDay.map((shift) => (
                <p key={shift.id} className="text-sm">
                  {shift.startTime}–{shift.endTime}
                  <span className="text-[var(--on-surface-variant)]">
                    {' '}
                    · {formatHours(shift.workMinutes)}
                    {shift.locationName && ` · ${shift.locationName}`}
                    {shift.note && ` · ${shift.note}`}
                  </span>
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
