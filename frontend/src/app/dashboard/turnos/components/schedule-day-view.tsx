'use client';

import { AlertTriangle, Plus } from 'lucide-react';
import type { Shift, WeekSchedule } from '@/lib/turnos-types';
import { formatEuros, formatHours, timeToMinutes } from './week-utils';

const DEFAULT_COLOR = '#2563eb';
const HOUR = 60;

interface Props {
  schedule: WeekSchedule;
  date: string;
  selectedShiftId: string | null;
  onSelectShift: (shift: Shift) => void;
  onAddShift: (employeeId: string | null, date: string) => void;
}

/** Inicio y fin del turno en minutos desde las 00:00; si acaba al día siguiente, pasa de 24 h. */
function shiftSpan(shift: Shift) {
  const start = timeToMinutes(shift.startTime);
  let end = timeToMinutes(shift.endTime);
  if (end <= start) end += 24 * HOUR;
  return { start, end };
}

/**
 * Vista de un día: una línea de tiempo por persona con sus turnos como
 * barras, para ver de un vistazo quién está y cuándo se solapan. Un toque
 * abre el turno; el + añade otro. Para mover turnos entre días, la semana.
 */
export function ScheduleDayView({ schedule, date, selectedShiftId, onSelectShift, onAddShift }: Props) {
  const dayShifts = schedule.shifts.filter((s) => s.date === date);
  const dayIndex = schedule.days.indexOf(date);
  const holiday = schedule.holidays.find((h) => h.date === date);

  // Escala: de la primera entrada a la última salida, en horas enteras (por defecto 8–24).
  const spans = dayShifts.map(shiftSpan);
  const from = Math.min(8 * HOUR, ...spans.map((s) => Math.floor(s.start / HOUR) * HOUR));
  const to = Math.max(24 * HOUR, ...spans.map((s) => Math.ceil(s.end / HOUR) * HOUR));
  const percent = (minutes: number) => ((minutes - from) / (to - from)) * 100;
  const hours: number[] = [];
  for (let h = from; h <= to; h += 2 * HOUR) hours.push(h);

  const shiftWarning = (shiftId: string) =>
    schedule.alerts
      .filter((alert) => alert.shiftIds.includes(shiftId))
      .map((alert) => alert.message)
      .join('\n') || undefined;
  const absenceOn = (employeeId: string) =>
    schedule.absences.find((a) => a.employeeId === employeeId && a.startDate <= date && a.endDate >= date);

  const rows: { id: string | null; name: string; hint?: string }[] = [
    { id: null, name: 'Turnos abiertos', hint: 'por cubrir' },
    ...schedule.employees.map((e) => ({ id: e.id, name: e.name, hint: e.section ?? undefined })),
  ];
  const totalMinutes = dayShifts.filter((s) => s.employeeId).reduce((sum, s) => sum + s.workMinutes, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--on-surface-variant)]">
        {holiday && <span className="mr-2 font-medium text-[var(--error)]">Festivo: {holiday.name}.</span>}
        {formatHours(totalMinutes)} planificadas este día
        {dayIndex >= 0 && ` · ${formatEuros(schedule.laborCost.byDay[dayIndex] ?? 0)} estimados`}
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)]">
        <div className="min-w-[640px]">
          {/* Escala de horas */}
          <div className="flex border-b border-[var(--outline-variant)]">
            <div className="w-40 shrink-0 p-2 text-sm font-medium">Persona</div>
            <div className="relative h-8 flex-1">
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute top-2 -translate-x-1/2 text-xs text-[var(--on-surface-variant)]"
                  style={{ left: `${percent(h)}%` }}
                >
                  {String((h / HOUR) % 24).padStart(2, '0')}
                </span>
              ))}
            </div>
            <div className="w-12 shrink-0" />
          </div>

          {rows.map((row) => {
            const shifts = dayShifts.filter((s) => s.employeeId === row.id);
            const absence = row.id ? absenceOn(row.id) : undefined;
            const minutes = shifts.reduce((sum, s) => sum + s.workMinutes, 0);
            return (
              <div key={row.id ?? 'open'} className="flex items-center border-b border-[var(--outline-variant)] last:border-b-0">
                <div className="w-40 shrink-0 p-2">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-[var(--on-surface-variant)]">
                    {row.id ? `${formatHours(minutes)}${row.hint ? ` · ${row.hint}` : ''}` : row.hint}
                  </p>
                </div>
                <div className="relative h-12 flex-1">
                  {hours.map((h) => (
                    <span
                      key={h}
                      className="absolute inset-y-0 border-l border-dashed border-[var(--outline-variant)]"
                      style={{ left: `${percent(h)}%` }}
                      aria-hidden
                    />
                  ))}
                  {absence && (
                    <span
                      className="absolute inset-y-2 left-0 right-0 flex items-center rounded-md px-2 text-xs text-white opacity-80"
                      style={{ backgroundColor: absence.color }}
                    >
                      {absence.typeName}
                      {absence.status === 'PENDING' && ' (pendiente)'}
                    </span>
                  )}
                  {shifts.map((shift) => {
                    const { start, end } = shiftSpan(shift);
                    const warning = shiftWarning(shift.id);
                    return (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => onSelectShift(shift)}
                        title={[warning, shift.note].filter(Boolean).join('\n') || undefined}
                        className={`absolute inset-y-1.5 flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 text-xs font-semibold text-white ${
                          shift.status === 'DRAFT' ? 'border-2 border-dashed border-white/80' : 'border-2 border-transparent'
                        } ${shift.id === selectedShiftId ? 'ring-2 ring-[var(--on-surface)]' : ''}`}
                        style={{
                          left: `${percent(start)}%`,
                          width: `${percent(end) - percent(start)}%`,
                          backgroundColor: shift.color ?? DEFAULT_COLOR,
                        }}
                      >
                        {warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-label={`Aviso: ${warning}`} />}
                        {shift.startTime}–{shift.endTime}
                      </button>
                    );
                  })}
                </div>
                <div className="flex w-12 shrink-0 justify-center">
                  {absence?.status !== 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => onAddShift(row.id, date)}
                      aria-label={`Añadir turno a ${row.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
