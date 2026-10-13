'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { Switch } from '@/components/ui/switch';
import { useAbsenceTypes, useCreateHoliday, useDeleteHoliday, useHolidays, useSaveAbsenceType } from '@/hooks/use-turnos';
import type { AbsenceType } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { formatDate } from './absence-format';

function HolidaysCard({ year }: { year: number }) {
  const notify = useNotification();
  const { data: holidays } = useHolidays(year);
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!date || name.trim().length < 2) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Indica la fecha y el nombre del festivo.' });
      return;
    }
    try {
      await create.mutateAsync({ date, name: name.trim() });
      setDate('');
      setName('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <div>
        <h3 className="text-lg font-semibold">Festivos de {year}</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Se marcan en el calendario y, si las vacaciones se cuentan en días laborables, no consumen saldo. Hay que
          darlos de alta cada año (nacionales, autonómicos y locales).
        </p>
      </div>
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="block">
          <span className={labelCls}>Fecha</span>
          <input type="date" value={date} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Fiesta Nacional" className={inputCls} />
        </label>
        <button type="submit" disabled={create.isPending} className={primaryBtnCls}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
        </button>
      </form>
      {holidays && holidays.length > 0 ? (
        <ul className="divide-y divide-[var(--outline-variant)]">
          {holidays.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium capitalize">{formatDate(holiday.date)}</span> · {holiday.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(holiday.id)}
                disabled={remove.isPending}
                aria-label={`Quitar ${holiday.name}`}
                className="flex h-10 w-10 items-center justify-center"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--on-surface-variant)]">Aún no hay festivos de {year}.</p>
      )}
    </section>
  );
}

function TypeRow({ type }: { type: AbsenceType }) {
  const notify = useNotification();
  const save = useSaveAbsenceType();

  async function toggle(isActive: boolean) {
    try {
      await save.mutateAsync({ id: type.id, data: { name: type.name, isActive } });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: type.color }} aria-hidden />
          {type.name}
        </span>
        <span className="block text-sm text-[var(--on-surface-variant)]">
          {[
            type.deductsVacation ? 'descuenta vacaciones' : 'no descuenta vacaciones',
            type.employeeCanRequest ? 'la pide el empleado' : 'la registra gerencia',
          ].join(' · ')}
        </span>
      </span>
      <Switch checked={type.isActive} onCheckedChange={toggle} disabled={save.isPending} aria-label={`${type.name} activo`} />
    </li>
  );
}

function TypesCard() {
  const notify = useNotification();
  const { data: types } = useAbsenceTypes(true);
  const save = useSaveAbsenceType();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [deductsVacation, setDeductsVacation] = useState(false);
  const [employeeCanRequest, setEmployeeCanRequest] = useState(true);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      notify({ type: 'error', title: 'Falta el nombre', message: '' });
      return;
    }
    try {
      await save.mutateAsync({ data: { name: name.trim(), color, deductsVacation, employeeCanRequest } });
      setName('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <h3 className="text-lg font-semibold">Tipos de ausencia</h3>
      <ul className="divide-y divide-[var(--outline-variant)]">{types?.map((type) => <TypeRow key={type.id} type={type} />)}</ul>
      <form onSubmit={handleAdd} className="space-y-3 border-t border-[var(--outline-variant)] pt-3">
        <p className="font-medium">Añadir tipo</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className={labelCls}>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Formación" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Color</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-16 rounded-lg border border-[var(--outline-variant)]" />
          </label>
        </div>
        <label className="flex min-h-[40px] items-center gap-2">
          <input type="checkbox" checked={deductsVacation} onChange={(e) => setDeductsVacation(e.target.checked)} className="h-5 w-5" />
          Descuenta días de vacaciones
        </label>
        <label className="flex min-h-[40px] items-center gap-2">
          <input type="checkbox" checked={employeeCanRequest} onChange={(e) => setEmployeeCanRequest(e.target.checked)} className="h-5 w-5" />
          La puede solicitar el propio empleado
        </label>
        <button type="submit" disabled={save.isPending} className={primaryBtnCls}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir tipo
        </button>
      </form>
    </section>
  );
}

/** Festivos del año y tipos de ausencia. */
export function AbsenceSettingsTab({ year }: { year: number }) {
  return (
    <div className="space-y-4">
      <HolidaysCard year={year} />
      <TypesCard />
    </div>
  );
}
