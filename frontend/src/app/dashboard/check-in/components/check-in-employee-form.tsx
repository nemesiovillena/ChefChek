'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  useClearEmployeePin,
  useCreateEmployee,
  useLinkableUsers,
  useSetEmployeePin,
  useUpdateEmployee,
} from '@/hooks/use-check-in';
import type { Employee, EmployeeInput, WorkCenter } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

interface FormState {
  firstName: string;
  lastName: string;
  nationalId: string;
  socialSecurityNumber: string;
  jobTitle: string;
  section: string;
  contractType: string;
  weeklyHours: string;
  hourlyCost: string;
  userId: string;
  defaultLocationId: string;
  locationIds: string[];
  hireDate: string;
  terminationDate: string;
  isActive: boolean;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function initialState(employee: Employee | null, centers: WorkCenter[]): FormState {
  const fallbackCenter = centers.find((c) => c.isDefault)?.id ?? centers[0]?.id ?? '';
  return {
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    nationalId: employee?.nationalId ?? '',
    socialSecurityNumber: employee?.socialSecurityNumber ?? '',
    jobTitle: employee?.jobTitle ?? '',
    section: employee?.section ?? '',
    contractType: employee?.contractType ?? '',
    weeklyHours: String(employee?.weeklyHours ?? 40),
    hourlyCost: employee?.hourlyCost != null ? String(employee.hourlyCost) : '',
    userId: employee?.userId ?? '',
    defaultLocationId: employee?.defaultLocationId ?? fallbackCenter,
    locationIds: employee?.locationIds ?? (fallbackCenter ? [fallbackCenter] : []),
    hireDate: toDateInput(employee?.hireDate ?? null),
    terminationDate: toDateInput(employee?.terminationDate ?? null),
    isActive: employee?.isActive ?? true,
  };
}

function toPayload(form: FormState): EmployeeInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    nationalId: form.nationalId.trim(),
    socialSecurityNumber: form.socialSecurityNumber.trim(),
    jobTitle: form.jobTitle.trim(),
    section: form.section.trim(),
    contractType: form.contractType.trim(),
    weeklyHours: Number(form.weeklyHours) || 0,
    hourlyCost: form.hourlyCost === '' ? null : Number(form.hourlyCost),
    userId: form.userId || null,
    defaultLocationId: form.defaultLocationId || null,
    locationIds: form.locationIds,
    hireDate: form.hireDate || null,
    terminationDate: form.terminationDate || null,
    isActive: form.isActive,
  };
}

/** PIN de kiosco: asignar, cambiar o quitar. El PIN actual nunca se muestra. */
function PinSection({ employee, pinLength }: { employee: Employee; pinLength: number }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const setPin = useSetEmployeePin();
  const clearPin = useClearEmployeePin();
  const [pin, setPinValue] = useState('');

  async function handleSet() {
    if (pin.length !== pinLength) {
      notify({ type: 'error', title: 'PIN no válido', message: `Debe tener ${pinLength} dígitos.` });
      return;
    }
    try {
      await setPin.mutateAsync({ id: employee.id, pin });
      setPinValue('');
      notify({ type: 'success', title: 'PIN guardado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'Quitar PIN',
      description: `${employee.firstName} no podrá fichar en el kiosco hasta que se le asigne otro.`,
    });
    if (!ok) return;
    try {
      await clearPin.mutateAsync(employee.id);
      notify({ type: 'success', title: 'PIN eliminado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className="rounded-lg border border-[var(--outline-variant)] p-3">
      <p className="mb-1 flex items-center gap-2 font-medium">
        <KeyRound className="h-4 w-4" /> PIN de kiosco
      </p>
      <p className="mb-3 text-sm text-[var(--on-surface-variant)]">
        {employee.hasPin ? 'Tiene PIN asignado.' : 'Sin PIN: no puede fichar en el kiosco compartido.'}
        {employee.pinLocked && ' Bloqueado temporalmente por intentos fallidos; asignar uno nuevo lo desbloquea.'}
        {' '}Desde su propia cuenta se ficha sin PIN.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={pin}
          onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, pinLength))}
          inputMode="numeric"
          autoComplete="off"
          type="password"
          placeholder={`${pinLength} dígitos`}
          aria-label="Nuevo PIN"
          className={`${inputCls} max-w-[160px]`}
        />
        <button type="button" onClick={handleSet} disabled={setPin.isPending} className={secondaryBtnCls}>
          {employee.hasPin ? 'Cambiar PIN' : 'Asignar PIN'}
        </button>
        {employee.hasPin && (
          <button type="button" onClick={handleClear} disabled={clearPin.isPending} className={secondaryBtnCls}>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  employee: Employee | null;
  centers: WorkCenter[];
  pinLength: number;
  onDone: () => void;
}

/** Alta y edición de la ficha laboral. Montar con `key` distinta por empleado. */
export function CheckInEmployeeForm({ employee, centers, pinLength, onDone }: Props) {
  const notify = useNotification();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const { data: linkableUsers } = useLinkableUsers();
  const [form, setForm] = useState<FormState>(() => initialState(employee, centers));
  const saving = create.isPending || update.isPending;
  const activeCenters = centers.filter((c) => c.isActive || form.locationIds.includes(c.id));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // La cuenta ya vinculada no aparece en "libres": se añade para poder mostrarla.
  const userOptions = [...(employee?.user ? [employee.user] : []), ...(linkableUsers ?? [])];

  function toggleCenter(id: string) {
    setForm((prev) => {
      const locationIds = prev.locationIds.includes(id)
        ? prev.locationIds.filter((x) => x !== id)
        : [...prev.locationIds, id];
      const defaultLocationId = locationIds.includes(prev.defaultLocationId)
        ? prev.defaultLocationId
        : (locationIds[0] ?? '');
      return { ...prev, locationIds, defaultLocationId };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Nombre y apellidos son obligatorios.' });
      return;
    }
    if (centers.length > 0 && form.locationIds.length === 0) {
      notify({ type: 'error', title: 'Falta el centro', message: 'Asigna al menos un centro de trabajo.' });
      return;
    }
    try {
      if (employee) {
        await update.mutateAsync({ id: employee.id, data: toPayload(form) });
      } else {
        await create.mutateAsync(toPayload(form));
      }
      notify({ type: 'success', title: employee ? 'Empleado actualizado' : 'Empleado creado', message: '' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  const field = (label: string, key: keyof FormState, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value as FormState[typeof key])}
        className={inputCls}
        {...props}
      />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} mb-6 space-y-4`}>
      <h3 className="font-semibold">{employee ? `Editar: ${employee.firstName} ${employee.lastName}` : 'Nuevo empleado'}</h3>

      <div className="grid gap-3 md:grid-cols-2">
        {field('Nombre *', 'firstName', { autoComplete: 'off' })}
        {field('Apellidos *', 'lastName', { autoComplete: 'off' })}
        {field('DNI / NIE', 'nationalId', { autoComplete: 'off' })}
        {field('Nº Seguridad Social', 'socialSecurityNumber', { autoComplete: 'off', inputMode: 'numeric' })}
        {field('Puesto', 'jobTitle')}
        {field('Sección', 'section', { placeholder: 'Cocina, Sala, Barra…' })}
        {field('Tipo de contrato', 'contractType', { placeholder: 'Indefinido, fijo discontinuo…' })}
        {field('Horas semanales pactadas', 'weeklyHours', { type: 'number', min: 0, max: 60, step: 0.5 })}
        {field('Coste por hora (€)', 'hourlyCost', { type: 'number', min: 0, step: 0.01 })}
        {field('Fecha de alta', 'hireDate', { type: 'date' })}
      </div>

      <label className="block">
        <span className={labelCls}>Cuenta de ChefChek</span>
        <select value={form.userId} onChange={(e) => set('userId', e.target.value)} className={inputCls}>
          <option value="">Sin cuenta (solo ficha en kiosco con PIN)</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email}
            </option>
          ))}
        </select>
      </label>

      {centers.length > 1 && (
        <fieldset>
          <legend className={labelCls}>Centros en los que puede fichar</legend>
          <div className="space-y-2">
            {activeCenters.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-[40px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.locationIds.includes(c.id)}
                    onChange={() => toggleCenter(c.id)}
                    className="h-5 w-5"
                  />
                  {c.name}
                </label>
                {form.locationIds.includes(c.id) && (
                  <label className="flex items-center gap-1 text-sm text-[var(--on-surface-variant)]">
                    <input
                      type="radio"
                      name="defaultCenter"
                      checked={form.defaultLocationId === c.id}
                      onChange={() => set('defaultLocationId', c.id)}
                    />
                    habitual
                  </label>
                )}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {employee && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-[48px] items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-5 w-5"
            />
            En activo
          </label>
          {field('Fecha de baja', 'terminationDate', { type: 'date' })}
        </div>
      )}

      {employee && <PinSection employee={employee} pinLength={pinLength} />}
      {!employee && (
        <p className="text-sm text-[var(--on-surface-variant)]">
          El PIN de kiosco se asigna después de crear la ficha.
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={`${primaryBtnCls} flex-1`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cerrar
        </button>
      </div>
    </form>
  );
}
