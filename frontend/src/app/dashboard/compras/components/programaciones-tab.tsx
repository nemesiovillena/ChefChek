'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2, Plus, Power, Trash2 } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useLocations } from '@/hooks/use-locations';
import { usePurchaseLists } from '@/hooks/use-purchase-lists';
import {
  useCreatePurchaseSchedule,
  useDeletePurchaseSchedule,
  usePurchaseSchedules,
  useUpdatePurchaseSchedule,
  type PurchaseSchedule,
} from '@/hooks/use-purchase-schedules';

// 0=domingo…6=sábado (Date.getDay()); se muestran en orden L-D
const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

/** Próxima ejecución aproximada (cliente, informativa — el cron real vive en el backend). */
function nextRun(daysOfWeek: number[], timeOfDay: string): string {
  if (daysOfWeek.length === 0) return '—';
  const now = new Date();
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const dow = candidate.getDay();
    if (!daysOfWeek.includes(dow)) continue;
    const [h, m] = timeOfDay.split(':').map(Number);
    candidate.setHours(h, m, 0, 0);
    if (candidate.getTime() >= now.getTime()) {
      return candidate.toLocaleString('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return '—';
}

export function ProgramacionesTab({ canManage }: { canManage: boolean }) {
  const { data: schedules, isLoading, error } = usePurchaseSchedules();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const { data: lists } = usePurchaseLists();
  const { data: locations } = useLocations();
  const createMut = useCreatePurchaseSchedule();
  const updateMut = useUpdatePurchaseSchedule();
  const deleteMut = useDeletePurchaseSchedule();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const [supplierId, setSupplierId] = useState('');
  const [listId, setListId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState('09:00');

  const listsForSupplier = useMemo(
    () => (lists ?? []).filter((l) => !supplierId || l.supplierId === supplierId),
    [lists, supplierId],
  );

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const notifyError = (e: unknown, fallback: string) =>
    addNotification({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : fallback });

  const handleCreate = async () => {
    if (!supplierId || !listId || daysOfWeek.length === 0 || !timeOfDay) return;
    try {
      await createMut.mutateAsync({
        supplierId,
        listId,
        locationId: locationId || undefined,
        daysOfWeek,
        timeOfDay,
      });
      setListId('');
      setDaysOfWeek([]);
      addNotification({ type: 'success', title: 'Programación creada', message: 'Generará un borrador en el día/hora configurados' });
    } catch (e) {
      notifyError(e, 'No se pudo crear la programación');
    }
  };

  const handleToggleEnabled = async (schedule: PurchaseSchedule) => {
    try {
      await updateMut.mutateAsync({ id: schedule.id, data: { enabled: !schedule.enabled } });
    } catch (e) {
      notifyError(e, 'No se pudo cambiar el estado');
    }
  };

  const handleDelete = async (schedule: PurchaseSchedule) => {
    const ok = await confirm({
      title: 'Eliminar programación',
      description: `Dejará de generar pedidos para "${schedule.list.name}". Los pedidos ya generados no se ven afectados.`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(schedule.id);
    } catch (e) {
      notifyError(e, 'No se pudo eliminar la programación');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--on-surface-variant)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando programaciones...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--error-container)] p-6 text-[var(--on-error-container)]">
        No se pudieron cargar las programaciones: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
            <CalendarClock className="h-4 w-4" />
            Nueva programación
          </h2>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Genera un pedido en BORRADOR + notificación en el día/hora elegidos. Nunca se envía nada automáticamente.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setListId('');
              }}
              className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
            >
              <option value="">Proveedor...</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              disabled={!supplierId}
              className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] disabled:opacity-50"
            >
              <option value="">Lista de compra...</option>
              {listsForSupplier.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
            >
              <option value="">Sin local específico</option>
              {(locations ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`h-8 w-8 rounded-full text-xs font-medium transition ${
                  daysOfWeek.includes(value)
                    ? 'bg-[var(--primary)] text-primary-foreground'
                    : 'border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={!supplierId || !listId || daysOfWeek.length === 0 || createMut.isPending}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear programación
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {(schedules ?? []).map((schedule) => (
          <li
            key={schedule.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-[var(--on-surface)]">
                {schedule.list.name}
                <span className="ml-2 text-xs text-[var(--on-surface-variant)]">
                  {schedule.supplier.name}
                  {schedule.location ? ` · ${schedule.location.name}` : ''}
                </span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                <span>
                  {DAY_LABELS.filter((d) => schedule.daysOfWeek.includes(d.value))
                    .map((d) => d.label)
                    .join(' ')}
                  {' · '}
                  {schedule.timeOfDay}
                </span>
                <span>
                  Próxima: {schedule.enabled ? nextRun(schedule.daysOfWeek, schedule.timeOfDay) : '—'}
                </span>
                {schedule.lastRunAt && (
                  <span>
                    Última: {new Date(schedule.lastRunAt).toLocaleString('es-ES')}
                  </span>
                )}
              </p>
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleToggleEnabled(schedule)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    schedule.enabled
                      ? 'bg-[var(--primary)] text-primary-foreground'
                      : 'border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  {schedule.enabled ? 'Activa' : 'Pausada'}
                </button>
                <button
                  onClick={() => handleDelete(schedule)}
                  aria-label="Eliminar programación"
                  className="rounded-lg p-2 text-[var(--error)] transition hover:bg-[var(--error-container)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
        {(schedules ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--outline-variant)] p-6 text-center text-sm text-[var(--on-surface-variant)]">
            Todavía no hay programaciones.
          </li>
        )}
      </ul>
    </div>
  );
}
