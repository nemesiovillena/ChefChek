'use client';

import { useScheduleWeeks } from '@/hooks/use-turnos';
import { formatEuros, formatHours, mondaysOfMonth, todayIso } from './week-utils';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  locationId: string;
  /** Cualquier fecha del mes a mostrar ("AAAA-MM-DD"). */
  date: string;
  /** Abre la vista de día. */
  onOpenDay: (date: string) => void;
}

/**
 * Vista de mes: resumen por día de lo planificado en el centro (turnos,
 * horas, borradores, turnos sin cubrir y ausencias). Es de consulta: un
 * toque en un día abre su vista de día para editar.
 */
export function ScheduleMonthView({ locationId, date, onOpenDay }: Props) {
  const mondays = mondaysOfMonth(date);
  const weeks = useScheduleWeeks(locationId, mondays);
  if (weeks.some((w) => w.isLoading)) {
    return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  }
  if (weeks.some((w) => w.isError || !w.data)) {
    return <p className="text-[var(--error)]">No se pudo cargar el mes. Vuelve a intentarlo.</p>;
  }

  const month = date.slice(0, 7);
  const today = todayIso();
  const cells = weeks.flatMap(({ data: week }) =>
    week!.days.map((day, index) => {
      const shifts = week!.shifts.filter((s) => s.date === day);
      return {
        day,
        inMonth: day.slice(0, 7) === month,
        minutes: shifts.filter((s) => s.employeeId).reduce((sum, s) => sum + s.workMinutes, 0),
        cost: week!.laborCost.byDay[index] ?? 0,
        shifts: shifts.length,
        drafts: shifts.filter((s) => s.status === 'DRAFT').length,
        open: shifts.filter((s) => !s.employeeId).length,
        absences: week!.absences.filter((a) => a.status === 'APPROVED' && a.startDate <= day && a.endDate >= day)
          .length,
        holiday: week!.holidays.find((h) => h.date === day)?.name,
      };
    }),
  );
  const monthCells = cells.filter((cell) => cell.inMonth);
  const monthMinutes = monthCells.reduce((sum, cell) => sum + cell.minutes, 0);
  const monthCost = monthCells.reduce((sum, cell) => sum + cell.cost, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--on-surface-variant)]">
        {formatHours(monthMinutes)} planificadas en el mes · {formatEuros(monthCost)} estimados. Toca un día para
        editarlo.
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-1 text-center text-xs font-semibold text-[var(--on-surface-variant)]">
            {weekday}
          </div>
        ))}
        {cells.map((cell) =>
          cell.inMonth ? (
            <button
              key={cell.day}
              type="button"
              onClick={() => onOpenDay(cell.day)}
              title={cell.holiday}
              className={`flex min-h-[84px] flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left text-xs hover:bg-[var(--surface-container-high)] ${
                cell.day === today ? 'border-[var(--primary)]' : 'border-[var(--outline-variant)]'
              } bg-[var(--surface-container)]`}
            >
              <span className={`text-sm font-semibold ${cell.holiday ? 'text-[var(--error)]' : ''}`}>
                {Number(cell.day.slice(8))}
              </span>
              {cell.shifts > 0 && (
                <span>
                  {cell.shifts} turno{cell.shifts === 1 ? '' : 's'} · {formatHours(cell.minutes)}
                </span>
              )}
              {cell.drafts > 0 && <span className="text-[var(--on-surface-variant)]">{cell.drafts} sin publicar</span>}
              {cell.open > 0 && <span className="text-amber-600">{cell.open} sin cubrir</span>}
              {cell.absences > 0 && (
                <span className="text-[var(--on-surface-variant)]">
                  {cell.absences} ausencia{cell.absences === 1 ? '' : 's'}
                </span>
              )}
            </button>
          ) : (
            <div key={cell.day} aria-hidden />
          ),
        )}
      </div>
    </div>
  );
}
