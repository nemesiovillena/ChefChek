'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useOwnUnclosedDays, useTeamUnclosedDays } from '@/hooks/use-check-in';
import { INCIDENCE_LABELS, formatDay } from '@/lib/check-in-punch';
import type { UnclosedDay } from '@/lib/check-in-types';
import { cardCls } from './check-in-form-styles';

/** Enlace al día concreto en el registro de jornada (mes y día van en la URL). */
export function workdayLink(date: string, employeeId?: string) {
  const params = new URLSearchParams({ tab: employeeId ? 'equipo' : 'mias', mes: date.slice(0, 7), dia: date });
  if (employeeId) params.set('empleado', employeeId);
  return `/dashboard/check-in/jornadas?${params.toString()}`;
}

const describe = (day: UnclosedDay) => day.incidences.map((code) => INCIDENCE_LABELS[code] ?? code).join(' · ');

const rowCls =
  'flex min-h-[44px] items-center justify-between gap-2 py-2 hover:bg-[var(--surface-container-high)] -mx-2 rounded-lg px-2';

/**
 * Aviso al propio empleado: días recientes en los que se le olvidó fichar la
 * salida o los fichajes no encajan. Los que ya tienen una corrección pedida
 * no salen: ya ha hecho lo que tocaba.
 */
export function CheckInOwnUnclosedDays({ enabled }: { enabled: boolean }) {
  const { data } = useOwnUnclosedDays(enabled);
  const days = (data ?? []).filter((day) => !day.pendingCorrection);
  if (days.length === 0) return null;

  return (
    <section className={`${cardCls} border-[var(--error)]`}>
      <p className="mb-1 flex items-center gap-2 font-semibold text-[var(--error)]">
        <AlertTriangle className="h-5 w-5" />
        {days.length === 1 ? 'Tienes un día sin cerrar' : `Tienes ${days.length} días sin cerrar`}
      </p>
      <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
        Abre el día y pide la corrección con la hora correcta: un tramo sin salida no suma horas.
      </p>
      <ul>
        {days.map((day) => (
          <li key={day.date}>
            <Link href={workdayLink(day.date)} className={rowCls}>
              <span>
                <span className="font-medium capitalize">{formatDay(day.date)}</span>
                <span className="ml-2 text-sm text-[var(--on-surface-variant)]">{describe(day)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Gerencia: jornadas sin cerrar de todo el equipo en el último mes. */
export function CheckInTeamUnclosedDays() {
  const { data: days } = useTeamUnclosedDays();
  if (!days || days.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <AlertTriangle className="h-5 w-5 text-[var(--error)]" /> Jornadas sin cerrar ({days.length})
      </h3>
      <div className={cardCls}>
        <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
          Último mes. Un tramo sin salida no suma horas, y la hoja del mes no se puede aprobar hasta corregirlo.
        </p>
        <ul className="divide-y divide-[var(--outline-variant)]">
          {days.map((day) => (
            <li key={`${day.employeeId}-${day.date}`}>
              <Link href={workdayLink(day.date, day.employeeId)} className={rowCls}>
                <span>
                  <span className="font-medium">{day.employeeName}</span>
                  <span className="ml-2 capitalize">{formatDay(day.date)}</span>
                  <span className="block text-sm text-[var(--on-surface-variant)]">
                    {describe(day)}
                    {day.pendingCorrection && ' · corrección pedida, pendiente de respuesta'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
