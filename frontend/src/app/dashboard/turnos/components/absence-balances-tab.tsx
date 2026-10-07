'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useBalances, useSaveBalance } from '@/hooks/use-turnos';
import type { LeaveBalance } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { formatDays } from './absence-format';

function BalanceEditor({ balance, onDone }: { balance: LeaveBalance; onDone: () => void }) {
  const notify = useNotification();
  const save = useSaveBalance();
  const [entitled, setEntitled] = useState(String(balance.entitledDays));
  const [carried, setCarried] = useState(String(balance.carriedOverDays));
  const [adjustment, setAdjustment] = useState(String(balance.adjustmentDays));
  const [note, setNote] = useState(balance.note ?? '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        employeeId: balance.employeeId,
        year: balance.year,
        data: {
          entitledDays: Number(entitled) || 0,
          carriedOverDays: Number(carried) || 0,
          adjustmentDays: Number(adjustment) || 0,
          note: note.trim() || undefined,
        },
      });
      notify({ type: 'success', title: 'Saldo guardado', message: '' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  const number = (label: string, value: string, set: (v: string) => void, min = 0) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type="number" step={0.5} min={min} value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {number('Días del año', entitled, setEntitled)}
        {number('Arrastrados del año anterior', carried, setCarried)}
        {number('Ajuste (+/−)', adjustment, setAdjustment, -366)}
      </div>
      <label className="block">
        <span className={labelCls}>Nota</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={save.isPending} className={primaryBtnCls}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Saldo de vacaciones de cada persona en el año, editable. */
export function AbsenceBalancesTab({ year }: { year: number }) {
  const { data: balances, isLoading } = useBalances(year);
  const [editing, setEditing] = useState<string | null>(null);
  if (isLoading || !balances) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (balances.length === 0) return <p className="text-[var(--on-surface-variant)]">No hay empleados en activo.</p>;

  return (
    <div className={cardCls}>
      <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
        Por defecto se aplican los días del convenio (proporcionales el año del alta). Toca una persona para fijar otros.
      </p>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {balances.map((balance) => (
          <li key={balance.employeeId} className="py-3">
            <button
              type="button"
              onClick={() => setEditing(editing === balance.employeeId ? null : balance.employeeId)}
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block font-medium underline">{balance.employeeName}</span>
                <span className="block text-sm text-[var(--on-surface-variant)]">
                  {formatDays(balance.entitledDays + balance.carriedOverDays + balance.adjustmentDays)} en total
                  {balance.isDefault ? ' (convenio)' : ' (fijado a mano)'} · {formatDays(balance.usedDays)} aprobados
                  {balance.pendingDays > 0 && ` · ${formatDays(balance.pendingDays)} pendientes`}
                </span>
              </span>
              <span className={`font-semibold ${balance.remainingDays < 0 ? 'text-[var(--error)]' : ''}`}>
                Quedan {formatDays(balance.remainingDays)}
              </span>
            </button>
            {editing === balance.employeeId && (
              <BalanceEditor key={balance.employeeId} balance={balance} onDone={() => setEditing(null)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
