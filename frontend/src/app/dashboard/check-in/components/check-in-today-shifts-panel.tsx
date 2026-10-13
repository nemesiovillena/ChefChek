'use client';

import { useTodaySchedule } from '@/hooks/use-turnos';
import { PlanVsActualStatus } from '../../turnos/components/plan-vs-actual-status';
import { cardCls } from './check-in-form-styles';

/**
 * Turnos publicados de hoy frente a lo fichado: quién no ha fichado y quién
 * llegó tarde. Solo gerencia, y solo si el tenant planifica turnos.
 */
export function CheckInTodayShiftsPanel() {
  const { data } = useTodaySchedule();
  if (!data || data.rows.length === 0) return null;

  // Primero lo que pide atención.
  const weight = { NO_SHOW: 0, INCIDENT: 1, IN_PROGRESS: 2, PENDING: 3, OK: 4, UNPLANNED: 5 };
  const rows = [...data.rows].sort(
    (a, b) => weight[a.status] - weight[b.status] || (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''),
  );
  return (
    <section>
      <h3 className="mb-3 text-lg font-semibold">Turnos de hoy</h3>
      <ul className={`${cardCls} divide-y divide-[var(--outline-variant)]`}>
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{row.employeeName}</span>
              <span className="block text-sm text-[var(--on-surface-variant)]">
                Turno {row.plannedStart}–{row.plannedEnd}
                {row.actualStart && ` · entró a las ${row.actualStart}`}
              </span>
            </span>
            <PlanVsActualStatus row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
