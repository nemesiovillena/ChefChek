'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateAbsence, useRequestAbsence } from '@/hooks/use-turnos';
import type { AbsenceType } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';

interface Props {
  /** 'own': el empleado solicita (queda pendiente). 'manager': gerencia registra (queda aprobada). */
  mode: 'own' | 'manager';
  types: AbsenceType[];
  /** Solo en modo gerencia: personas entre las que elegir. */
  employees?: { id: string; name: string }[];
  onDone: () => void;
}

/** Alta de una ausencia: solicitud propia o registro directo por gerencia. */
export function AbsenceForm({ mode, types, employees, onDone }: Props) {
  const notify = useNotification();
  const request = useRequestAbsence();
  const create = useCreateAbsence();
  const mutation = mode === 'own' ? request : create;
  // El empleado solo ve los tipos que puede pedir él mismo.
  const options = mode === 'own' ? types.filter((t) => t.employeeCanRequest) : types;

  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState(options[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState('');
  const singleDay = startDate !== '' && startDate === (endDate || startDate);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'manager' && !employeeId) {
      notify({ type: 'error', title: 'Falta la persona', message: '' });
      return;
    }
    if (!typeId || !startDate) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Indica el tipo y la fecha de inicio.' });
      return;
    }
    try {
      await mutation.mutateAsync({
        employeeId: mode === 'manager' ? employeeId : undefined,
        absenceTypeId: typeId,
        startDate,
        endDate: endDate || startDate,
        halfDay: singleDay && halfDay,
        note: note.trim() || undefined,
      });
      notify({
        type: 'success',
        title: mode === 'own' ? 'Solicitud enviada' : 'Ausencia registrada',
        message: mode === 'own' ? 'Un responsable la revisará.' : '',
      });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo guardar', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <p className="font-semibold">{mode === 'own' ? 'Solicitar ausencia' : 'Registrar ausencia'}</p>
      {mode === 'manager' && (
        <label className="block">
          <span className={labelCls}>Persona</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            <option value="" disabled>
              Elige una persona
            </option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className={labelCls}>Tipo</span>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
          {options.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Desde</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Hasta (incluido)</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      {singleDay && (
        <label className="flex min-h-[40px] items-center gap-2">
          <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} className="h-5 w-5" />
          Solo media jornada
        </label>
      )}
      <label className="block">
        <span className={labelCls}>Nota (opcional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        {mode === 'manager' && (
          <span className="mt-1 block text-sm text-[var(--on-surface-variant)]">
            No anotes aquí diagnósticos ni datos de salud: basta con el tipo y las fechas.
          </span>
        )}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending} className={`${primaryBtnCls} flex-1`}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {mode === 'own' ? 'Enviar solicitud' : 'Registrar'}
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
