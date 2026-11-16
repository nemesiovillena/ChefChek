'use client';

import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import {
  EXPENSE_LABEL,
  type ExpenseCategory,
  useCopyExpenses,
  useCreateExpense,
  useDeleteExpense,
  useGestionExpenses,
} from '../api/gestion-results-api';
import { formatEuros, parseEsAmount } from '../gestion-format';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const errText = (e: unknown) => (e instanceof Error ? e.message : '');

const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

/** Gastos generales de un mes (sin IVA): alta, baja y copia del mes anterior. */
export function ExpensesManager({ year }: { year: number }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const now = new Date();
  const defaultMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const [month, setMonth] = useState(`${year}-${String(defaultMonth).padStart(2, '0')}`);
  const [form, setForm] = useState({ category: 'alquiler' as ExpenseCategory, concept: '', amount: '' });
  const { data: expenses } = useGestionExpenses(year);
  const create = useCreateExpense();
  const remove = useDeleteExpense();
  const copy = useCopyExpenses();
  const rows = (expenses ?? []).filter((e) => e.month === month);
  const total = rows.reduce((n, e) => n + e.amount, 0);
  const amount = parseEsAmount(form.amount);

  async function add() {
    try {
      await create.mutateAsync({ month, category: form.category, concept: form.concept.trim(), amount });
      setForm({ ...form, concept: '', amount: '' });
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo guardar el gasto', message: errText(e) });
    }
  }

  async function copyPrevious() {
    try {
      const { copied } = await copy.mutateAsync({ from: previousMonth(month), to: month });
      notify({ type: copied ? 'success' : 'info', title: copied ? `${copied} gastos copiados` : 'El mes anterior no tiene gastos', message: '' });
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo copiar', message: errText(e) });
    }
  }

  async function del(id: string, concept: string) {
    const ok = await confirm({ title: 'Borrar gasto', description: `Se borrará «${concept}».`, variant: 'destructive' });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo borrar', message: errText(e) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-col">
          <span className={labelCls}>Mes</span>
          <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((name, i) => {
              const value = `${year}-${String(i + 1).padStart(2, '0')}`;
              return (
                <option key={value} value={value}>
                  {name} {year}
                </option>
              );
            })}
          </select>
        </label>
        {rows.length === 0 && (
          <Button type="button" variant="outline" className="min-h-[48px]" disabled={copy.isPending} onClick={copyPrevious}>
            <Copy className="h-4 w-4" /> Copiar del mes anterior
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Sin gastos generales este mes.</p>
      ) : (
        <ul className="divide-y divide-[var(--outline-variant)] rounded-lg border border-[var(--outline-variant)]">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[var(--on-surface)]">{e.concept}</span>
                <span className="block text-xs text-[var(--on-surface-variant)]">{EXPENSE_LABEL[e.category] ?? e.category}</span>
              </span>
              <span className="tabular-nums text-[var(--on-surface)]">{formatEuros(e.amount)}</span>
              <button
                type="button"
                onClick={() => del(e.id, e.concept)}
                aria-label={`Borrar ${e.concept}`}
                className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 text-sm font-semibold">
            <span>Total del mes</span>
            <span className="tabular-nums">{formatEuros(total)}</span>
          </li>
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-1 flex-col">
          <span className={labelCls}>Categoría</span>
          <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
            {(Object.keys(EXPENSE_LABEL) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {EXPENSE_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-[2] flex-col">
          <span className={labelCls}>Concepto</span>
          <input
            className={inputCls}
            value={form.concept}
            maxLength={120}
            placeholder="Alquiler del local, factura de luz…"
            onChange={(e) => setForm({ ...form, concept: e.target.value })}
          />
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col">
          <span className={labelCls}>Importe sin IVA (€)</span>
          <input
            className={inputCls}
            inputMode="decimal"
            value={form.amount}
            placeholder="0,00"
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          {/* Lo que se va a guardar, para no confundir «1.200» con 1,20 €. */}
          <span className="mt-1 min-h-4 text-xs text-[var(--on-surface-variant)]">
            {form.amount.trim() === ''
              ? 'Negativo para un abono'
              : Number.isFinite(amount)
                ? `Se guardará ${formatEuros(amount)}`
                : 'Importe no válido'}
          </span>
        </label>
        <Button
          type="button"
          className="mb-5 min-h-[48px]"
          disabled={!form.concept.trim() || !Number.isFinite(amount) || form.amount.trim() === '' || create.isPending}
          onClick={add}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}
