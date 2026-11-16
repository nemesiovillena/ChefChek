'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import {
  type CalendarDateKind,
  KIND_LABEL,
  type SeasonHoliday,
  useCreateCalendarDate,
  useDeleteCalendarDate,
  useSeedCalendarDates,
} from '../api/gestion-seasonality-api';
import { formatDay, formatEuros } from '../gestion-format';

const errText = (e: unknown) => (e instanceof Error ? e.message : '');

/**
 * Festivos y fechas señaladas del año: cómo vendió cada una frente a un día
 * normal (mismo día de la semana, ±4 semanas) y su alta, baja y precarga.
 */
export function CalendarDatesManager({ year, holidays }: { year: number; holidays: SeasonHoliday[] }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const seed = useSeedCalendarDates();
  const create = useCreateCalendarDate();
  const remove = useDeleteCalendarDate();
  const [form, setForm] = useState({ date: `${year}-01-01`, name: '', kind: 'propio' as CalendarDateKind });

  async function load(region: 'nacional' | 'villena') {
    try {
      const { added } = await seed.mutateAsync({ year, region });
      notify({ type: 'success', title: added ? `${added} fechas añadidas` : 'Ya estaban todas', message: '' });
    } catch (e) {
      notify({ type: 'error', title: 'No se pudieron cargar', message: errText(e) });
    }
  }

  async function add() {
    try {
      await create.mutateAsync(form);
      setForm({ ...form, name: '' });
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo añadir la fecha', message: errText(e) });
    }
  }

  async function del(h: SeasonHoliday) {
    const ok = await confirm({
      title: 'Quitar fecha',
      description: `Se quitará «${h.name}» (${formatDay(h.date)}) del calendario. Las ventas no cambian.`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(h.id);
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo quitar', message: errText(e) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" disabled={seed.isPending} onClick={() => load('villena')}>
          {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Cargar fechas de {year} (España + C. Valenciana + Villena)
        </Button>
        <Button type="button" variant="outline" className="min-h-[44px]" disabled={seed.isPending} onClick={() => load('nacional')}>
          Solo nacionales y comerciales
        </Button>
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Son sugeridas: los festivos autonómicos y locales cambian cada año. Quita o añade las que no cuadren.
      </p>

      {holidays.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Sin fechas en {year}. Cárgalas o añade las tuyas.</p>
      ) : (
        <ul className="divide-y divide-[var(--outline-variant)] rounded-lg border border-[var(--outline-variant)]">
          {holidays.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-[var(--on-surface)]">
                  {formatDay(h.date)} · {h.name}
                </span>
                <span className="block text-xs text-[var(--on-surface-variant)]">
                  {h.weekday} · {KIND_LABEL[h.kind] ?? h.kind}
                </span>
              </span>
              <span className="text-right tabular-nums">
                <span className="block text-[var(--on-surface)]">{h.open ? formatEuros(h.total) : 'sin venta'}</span>
                <span className="block text-xs text-[var(--on-surface-variant)]">
                  {h.deltaPct === null
                    ? h.normalAvg === null
                      ? 'sin día normal con que comparar'
                      : '—'
                    : `${h.deltaPct > 0 ? '+' : ''}${h.deltaPct.toLocaleString('es-ES')} % vs. ${h.weekday} normal (${formatEuros(h.normalAvg ?? 0)})`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => del(h)}
                aria-label={`Quitar ${h.name}`}
                className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--error-container)] hover:text-[var(--on-error-container)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[9rem] flex-1 flex-col">
          <span className={labelCls}>Fecha</span>
          <input
            type="date"
            className={inputCls}
            value={form.date}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="flex min-w-[12rem] flex-[2] flex-col">
          <span className={labelCls}>Nombre</span>
          <input
            className={inputCls}
            value={form.name}
            maxLength={80}
            placeholder="Fiesta del barrio, concierto, boda…"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col">
          <span className={labelCls}>Tipo</span>
          <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CalendarDateKind })}>
            {(Object.keys(KIND_LABEL) as CalendarDateKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" className="min-h-[48px]" disabled={!form.name.trim() || !form.date || create.isPending} onClick={add}>
          Añadir
        </Button>
      </div>
    </div>
  );
}
