'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { Shift, WeekSchedule } from '@/lib/turnos-types';
import { formatHours, formatWeekday } from './week-utils';

/** Fila de turnos sin asignar. */
const OPEN_ROW = 'open';
const DEFAULT_COLOR = '#2563eb';
const cellId = (rowId: string, date: string) => `${rowId}|${date}`;

interface Props {
  schedule: WeekSchedule;
  selectedShiftId: string | null;
  onSelectShift: (shift: Shift) => void;
  onAddShift: (employeeId: string | null, date: string) => void;
  /** Soltar un turno en otra celda: mover (o duplicar si `duplicate`). */
  onDropShift: (shift: Shift, employeeId: string | null, date: string) => void;
}

function ShiftCard({ shift, selected, onSelect }: { shift: Shift; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: shift.id, data: { shift } });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...listeners}
      {...attributes}
      title={shift.note ?? undefined}
      className={`block w-full touch-none rounded-md px-1.5 py-1 text-left text-xs text-white ${
        isDragging ? 'opacity-30' : ''
      } ${selected ? 'ring-2 ring-[var(--on-surface)]' : ''} ${
        // Borrador: aún no lo ve su persona.
        shift.status === 'DRAFT' ? 'border-2 border-dashed border-white/80' : 'border-2 border-transparent'
      }`}
      style={{ backgroundColor: shift.color ?? DEFAULT_COLOR }}
    >
      <span className="block font-semibold leading-tight">
        {shift.startTime}–{shift.endTime}
      </span>
      <span className="block leading-tight opacity-90">{formatHours(shift.workMinutes)}</span>
    </button>
  );
}

function Cell({
  rowId,
  date,
  children,
  onAdd,
  blocked,
}: {
  rowId: string;
  date: string;
  children: React.ReactNode;
  onAdd: () => void;
  blocked?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(rowId, date), data: { rowId, date } });
  return (
    <td
      ref={setNodeRef}
      className={`group h-16 min-w-[92px] border-l border-t border-[var(--outline-variant)] p-1 align-top ${
        isOver ? 'bg-[var(--surface-container-high)]' : ''
      }`}
    >
      <div className="space-y-1">
        {children}
        {!blocked && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Añadir turno"
            className="flex h-6 w-full items-center justify-center rounded-md text-[var(--on-surface-variant)] opacity-40 hover:bg-[var(--surface-container-high)] hover:opacity-100 focus:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </td>
  );
}

/**
 * Rejilla semanal: una fila por persona (agrupadas por sección) más la de
 * turnos abiertos, y una columna por día. Los turnos se arrastran entre
 * celdas; un toque corto los abre para editarlos.
 */
export function ScheduleGrid({ schedule, selectedShiftId, onSelectShift, onAddShift, onDropShift }: Props) {
  const [dragging, setDragging] = useState<Shift | null>(null);
  // La distancia y el retardo dejan que un clic o un toque sigan siendo un clic.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const shiftsIn = (employeeId: string | null, date: string) =>
    schedule.shifts.filter((s) => s.employeeId === employeeId && s.date === date);
  const absenceOn = (employeeId: string, date: string) =>
    schedule.absences.find((a) => a.employeeId === employeeId && a.startDate <= date && a.endDate >= date);
  const holidayNames = new Map(schedule.holidays.map((h) => [h.date, h.name]));
  const weekMinutes = (employeeId: string) =>
    schedule.shifts.filter((s) => s.employeeId === employeeId).reduce((sum, s) => sum + s.workMinutes, 0);
  const dayMinutes = (date: string) =>
    schedule.shifts.filter((s) => s.date === date && s.employeeId).reduce((sum, s) => sum + s.workMinutes, 0);

  // Secciones en orden de aparición; quien no tiene sección va al final.
  const sections = [...new Set(schedule.employees.map((e) => e.section ?? ''))].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );

  function handleDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current?.shift as Shift) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const shift = event.active.data.current?.shift as Shift | undefined;
    const target = event.over?.data.current as { rowId: string; date: string } | undefined;
    if (!shift || !target) return;
    const employeeId = target.rowId === OPEN_ROW ? null : target.rowId;
    if (employeeId === shift.employeeId && target.date === shift.date) return;
    onDropShift(shift, employeeId, target.date);
  }

  const renderShifts = (employeeId: string | null, date: string) =>
    shiftsIn(employeeId, date).map((shift) => (
      <ShiftCard
        key={shift.id}
        shift={shift}
        selected={shift.id === selectedShiftId}
        onSelect={() => onSelectShift(shift)}
      />
    ));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="overflow-x-auto rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)]">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[150px] bg-[var(--surface-container)] p-2 text-left font-medium">
                Persona
              </th>
              {schedule.days.map((date) => (
                <th
                  key={date}
                  title={holidayNames.get(date)}
                  className={`border-l border-[var(--outline-variant)] p-2 text-center font-medium capitalize ${
                    holidayNames.has(date) ? 'text-[var(--error)]' : ''
                  }`}
                >
                  {formatWeekday(date)}
                  {holidayNames.has(date) && <span className="block text-xs font-normal normal-case">{holidayNames.get(date)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="sticky left-0 z-10 border-t border-[var(--outline-variant)] bg-[var(--surface-container)] p-2 text-left font-medium">
                Turnos abiertos
                <span className="block text-xs font-normal text-[var(--on-surface-variant)]">por cubrir</span>
              </th>
              {schedule.days.map((date) => (
                <Cell key={date} rowId={OPEN_ROW} date={date} onAdd={() => onAddShift(null, date)}>
                  {renderShifts(null, date)}
                </Cell>
              ))}
            </tr>

            {sections.map((section) => (
              <SectionRows key={section || 'sin-seccion'} label={section} showLabel={sections.length > 1} columns={schedule.days.length}>
                {schedule.employees
                  .filter((employee) => (employee.section ?? '') === section)
                  .map((employee) => {
                    const planned = weekMinutes(employee.id);
                    const over = planned > employee.weeklyHours * 60;
                    return (
                      <tr key={employee.id}>
                        <th className="sticky left-0 z-10 border-t border-[var(--outline-variant)] bg-[var(--surface-container)] p-2 text-left font-medium">
                          <span className="block truncate">{employee.name}</span>
                          <span className={`block text-xs font-normal ${over ? 'text-[var(--error)]' : 'text-[var(--on-surface-variant)]'}`}>
                            {formatHours(planned)} / {employee.weeklyHours} h
                          </span>
                        </th>
                        {schedule.days.map((date) => {
                          const absence = absenceOn(employee.id, date);
                          return (
                            <Cell
                              key={date}
                              rowId={employee.id}
                              date={date}
                              onAdd={() => onAddShift(employee.id, date)}
                              // Con una ausencia aprobada no se puede planificar ese día.
                              blocked={absence?.status === 'APPROVED'}
                            >
                              {absence && (
                                <span
                                  className="block rounded-md px-1.5 py-1 text-xs text-white"
                                  style={{
                                    backgroundColor: absence.color,
                                    backgroundImage:
                                      absence.status === 'PENDING'
                                        ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.45) 0 4px, transparent 4px 8px)'
                                        : undefined,
                                  }}
                                >
                                  {absence.typeName}
                                  {absence.status === 'PENDING' && ' (pendiente)'}
                                </span>
                              )}
                              {renderShifts(employee.id, date)}
                            </Cell>
                          );
                        })}
                      </tr>
                    );
                  })}
              </SectionRows>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="sticky left-0 z-10 border-t border-[var(--outline-variant)] bg-[var(--surface-container)] p-2 text-left font-medium">
                Horas del día
              </th>
              {schedule.days.map((date) => (
                <td key={date} className="border-l border-t border-[var(--outline-variant)] p-2 text-center text-[var(--on-surface-variant)]">
                  {formatHours(dayMinutes(date))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <DragOverlay>
        {dragging && (
          <div
            className="rounded-md px-1.5 py-1 text-xs font-semibold text-white shadow-lg"
            style={{ backgroundColor: dragging.color ?? DEFAULT_COLOR, width: 92 }}
          >
            {dragging.startTime}–{dragging.endTime}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SectionRows({
  label,
  showLabel,
  columns,
  children,
}: {
  label: string;
  showLabel: boolean;
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {showLabel && (
        <tr>
          <th
            colSpan={columns + 1}
            className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]"
          >
            {label || 'Sin sección'}
          </th>
        </tr>
      )}
      {children}
    </>
  );
}
