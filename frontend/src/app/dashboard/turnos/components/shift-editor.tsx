'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateShift, useDeleteShift, useUpdateShift } from '@/hooks/use-turnos';
import type { Shift, ShiftTemplate, WeekSchedule } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { formatWeekday } from './week-utils';

/** Qué se está editando: un turno existente o uno nuevo en una celda. */
export type EditorTarget = { shift: Shift } | { employeeId: string | null; date: string };

interface Props {
  schedule: WeekSchedule;
  target: EditorTarget;
  onDone: () => void;
}

/** Alta y edición de un turno. Se monta con `key` distinta por destino. */
export function ShiftEditor({ schedule, target, onDone }: Props) {
  const notify = useNotification();
  const create = useCreateShift();
  const update = useUpdateShift(schedule.location.id, schedule.weekStart);
  const remove = useDeleteShift();
  const existing = 'shift' in target ? target.shift : null;

  const [employeeId, setEmployeeId] = useState(existing ? (existing.employeeId ?? '') : (target as { employeeId: string | null }).employeeId ?? '');
  const [date, setDate] = useState(existing ? existing.date : (target as { date: string }).date);
  const [startTime, setStartTime] = useState(existing?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '17:00');
  const [breakMinutes, setBreakMinutes] = useState(existing?.breakMinutes ?? 0);
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const busy = create.isPending || update.isPending || remove.isPending;

  function applyTemplate(template: ShiftTemplate) {
    setStartTime(template.startTime);
    setEndTime(template.endTime);
    setBreakMinutes(template.breakMinutes);
    setColor(template.color);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = {
      employeeId: employeeId || null,
      date,
      startTime,
      endTime,
      breakMinutes,
      color: color ?? undefined,
      note: note.trim(),
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, data });
      else await create.mutateAsync({ locationId: schedule.location.id, ...data });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo guardar el turno', message: errorMessage(err) });
    }
  }

  async function handleDelete() {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <p className="font-semibold">{existing ? 'Editar turno' : 'Nuevo turno'}</p>

      {schedule.templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {schedule.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template)}
              className="flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-3 text-sm"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: template.color }} aria-hidden />
              {template.name} · {template.startTime}–{template.endTime}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block lg:col-span-2">
          <span className={labelCls}>Persona</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            <option value="">Turno abierto (sin asignar)</option>
            {schedule.employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Día</span>
          <select value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} capitalize`}>
            {schedule.days.map((day) => (
              <option key={day} value={day}>
                {formatWeekday(day)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Entrada</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Salida</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block">
          <span className={labelCls}>Pausa (minutos)</span>
          <input
            type="number"
            min={0}
            max={600}
            step={5}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Nota (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </label>
      </div>
      {endTime <= startTime && (
        <p className="text-sm text-[var(--on-surface-variant)]">Este turno termina al día siguiente.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={`${primaryBtnCls} flex-1`}>
          {create.isPending || update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        {existing && (
          <button type="button" onClick={handleDelete} disabled={busy} className={secondaryBtnCls}>
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
        )}
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cerrar
        </button>
      </div>
    </form>
  );
}
