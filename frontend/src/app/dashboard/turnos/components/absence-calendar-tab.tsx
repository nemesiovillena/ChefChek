'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useEmployees } from '@/hooks/use-check-in';
import { useAbsenceTypes, useCancelAbsence, useHolidays, useTeamAbsences } from '@/hooks/use-turnos';
import type { Absence } from '@/lib/turnos-types';
import { cardCls, errorMessage, primaryBtnCls } from '../../check-in/components/check-in-form-styles';
import type { YearMonth } from '../../check-in/components/check-in-month-picker';
import { AbsenceForm } from './absence-form';
import { formatDays, formatRange } from './absence-format';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Calendario mensual del equipo: una fila por persona y una columna por día,
 * con las ausencias activas coloreadas por tipo. Las pendientes van rayadas.
 */
export function AbsenceCalendarTab({ period }: { period: YearMonth }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const cancel = useCancelAbsence();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Absence | null>(null);

  const daysInMonth = new Date(period.year, period.month, 0).getDate();
  const prefix = `${period.year}-${pad(period.month)}-`;
  const from = `${prefix}01`;
  const to = `${prefix}${pad(daysInMonth)}`;
  const days = Array.from({ length: daysInMonth }, (_, i) => `${prefix}${pad(i + 1)}`);

  const { data: employees } = useEmployees(false);
  const { data: absences } = useTeamAbsences(from, to);
  const { data: types } = useAbsenceTypes();
  const { data: holidays } = useHolidays(period.year);

  if (!employees || !absences || !types) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;

  const holidayNames = new Map((holidays ?? []).map((h) => [h.date, h.name]));
  const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
  const absenceOn = (employeeId: string, date: string) =>
    absences.find((a) => a.employeeId === employeeId && a.startDate <= date && a.endDate >= date);
  const people = employees.map((e) => ({ id: e.id, name: [e.firstName, e.lastName].filter(Boolean).join(' ') }));

  async function handleCancel(absence: Absence) {
    const ok = await confirm({
      title: 'Cancelar ausencia',
      description: `${absence.employeeName} · ${absence.type.name} · ${formatRange(absence)}. Si descontaba vacaciones, los días vuelven a su saldo.`,
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync({ id: absence.id });
      setSelected(null);
      notify({ type: 'success', title: 'Ausencia cancelada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <AbsenceForm mode="manager" types={types} employees={people} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={primaryBtnCls}>
          <Plus className="h-4 w-4" /> Registrar ausencia
        </button>
      )}

      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[140px] bg-[var(--surface-container)] p-1 text-left font-medium">
                Persona
              </th>
              {days.map((date) => {
                const weekday = weekdayOf(date);
                const off = weekday === 0 || weekday === 6 || holidayNames.has(date);
                return (
                  <th
                    key={date}
                    title={holidayNames.get(date)}
                    className={`min-w-[26px] p-1 text-center font-normal ${off ? 'text-[var(--error)]' : 'text-[var(--on-surface-variant)]'}`}
                  >
                    <span className="block text-xs">{WEEKDAYS[weekday]}</span>
                    {Number(date.slice(8))}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td className="sticky left-0 z-10 truncate bg-[var(--surface-container)] p-1 font-medium">{person.name}</td>
                {days.map((date) => {
                  const absence = absenceOn(person.id, date);
                  return (
                    <td key={date} className="p-0.5">
                      {absence ? (
                        <button
                          type="button"
                          onClick={() => setSelected(absence)}
                          title={`${absence.type.name}${absence.status === 'PENDING' ? ' (pendiente)' : ''}`}
                          aria-label={`${person.name}, ${absence.type.name}, día ${Number(date.slice(8))}`}
                          className="block h-7 w-full rounded"
                          style={{
                            backgroundColor: absence.type.color,
                            // Pendiente de aprobar: rayado para distinguirla de una firme.
                            backgroundImage:
                              absence.status === 'PENDING'
                                ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px)'
                                : undefined,
                          }}
                        />
                      ) : (
                        <span className="block h-7 rounded bg-[var(--surface-container-lowest)]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 && <p className="text-[var(--on-surface-variant)]">No hay empleados en activo.</p>}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--on-surface-variant)]">
        {types.map((type) => (
          <span key={type.id} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: type.color }} aria-hidden /> {type.name}
          </span>
        ))}
        <span>Rayado = pendiente de aprobar</span>
      </div>

      {selected && (
        <div className={`${cardCls} space-y-2`}>
          <p className="font-medium">
            {selected.employeeName} · {selected.type.name}
          </p>
          <p className="text-sm">
            {formatRange(selected)} · {formatDays(selected.days)} ·{' '}
            {selected.status === 'PENDING' ? 'pendiente de aprobar' : `aprobada por ${selected.decidedByName ?? '—'}`}
          </p>
          {selected.note && <p className="text-sm text-[var(--on-surface-variant)]">Nota: {selected.note}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => handleCancel(selected)} disabled={cancel.isPending} className="min-h-[40px] px-2 text-sm underline">
              Cancelar esta ausencia
            </button>
            <button type="button" onClick={() => setSelected(null)} className="min-h-[40px] px-2 text-sm underline">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
