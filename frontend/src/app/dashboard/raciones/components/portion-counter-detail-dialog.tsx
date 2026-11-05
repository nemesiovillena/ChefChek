'use client';

import { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import {
  MOVEMENT_LABEL,
  fmtPortions,
  useDeletePortionCounter,
  usePortionCounterDetail,
  useUnlinkPortionDish,
  useUpdatePortionCounter,
  type PortionCounter,
} from '@/hooks/use-raciones';
import { PortionDishLinker } from './portion-dish-linker';

interface Props {
  counter: PortionCounter;
  canManage: boolean;
  onClose: () => void;
}

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtPortions(Math.abs(n))}`;

/**
 * Detalle de un contador: etiquetas en el orden en que se gastan, historial
 * de movimientos y, para gerencia y cocina, mínimo, platos de Cuiner y baja.
 */
export function PortionCounterDetailDialog({ counter, canManage, onClose }: Props) {
  const addNotification = useNotification();
  const { data, isLoading } = usePortionCounterDetail(counter.id);
  const update = useUpdatePortionCounter();
  const unlink = useUnlinkPortionDish();
  const remove = useDeletePortionCounter();
  const confirm = useConfirm();
  const [minPortions, setMinPortions] = useState(String(counter.minPortions));
  const [pendingDishes, setPendingDishes] = useState(0);

  const fail = (err: unknown) =>
    addNotification({
      type: 'error',
      title: 'No se pudo guardar',
      message: (err as Error).message,
    });

  const saveMin = async () => {
    const min = Number(minPortions.replace(',', '.'));
    if (!Number.isFinite(min) || min < 0 || min === counter.minPortions) return;
    try {
      await update.mutateAsync({ id: counter.id, minPortions: min });
      addNotification({
        type: 'success',
        title: 'Mínimo guardado',
        message: `${counter.name}: avisar con ${fmtPortions(min)}.`,
      });
    } catch (err) {
      fail(err);
    }
  };

  const toggleActive = async () => {
    try {
      await update.mutateAsync({ id: counter.id, active: !counter.active });
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  const deleteCounter = () =>
    confirm({
      title: `¿Borrar el contador «${counter.name}»?`,
      description:
        'Se borran su historial y los platos de Cuiner enlazados. Las etiquetas no se tocan: solo dejan de sumar aquí. Si solo quieres quitarlo de la vista, usa «Desactivar contador».',
      confirmText: 'Borrar',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await remove.mutateAsync(counter.id);
        } catch (err) {
          fail(err);
          throw err;
        }
        addNotification({ type: 'success', title: 'Contador borrado', message: counter.name });
        onClose();
      },
    });

  // Marcar platos no los guarda: hasta pulsar «Enlazar» no cuentan.
  const requestClose = async () => {
    if (pendingDishes > 0) {
      const leave = await confirm({
        title: 'Platos marcados sin enlazar',
        description: `Tienes ${pendingDishes} ${pendingDishes === 1 ? 'plato marcado' : 'platos marcados'} sin enlazar. Si sales ahora no se guardan: pulsa «Enlazar» antes de cerrar.`,
        confirmText: 'Salir sin enlazar',
        cancelText: 'Volver',
        variant: 'warning',
      });
      if (!leave) return;
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{counter.name}</DialogTitle>
          <DialogDescription>
            {fmtPortions(data?.available ?? counter.available)} raciones disponibles
            {counter.unlabeledPortions > 0 &&
              ` (${fmtPortions(counter.unlabeledPortions)} contadas a mano sin etiqueta)`}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Etiquetas activas</h3>
              {data.labels.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)]">
                  Ninguna. Al etiquetar se suman aquí.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--outline-variant)] rounded-lg border border-[var(--outline-variant)] text-sm">
                  {data.labels.map((l, i) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-semibold">{l.lotNumber}</span>
                        <span className="block text-xs text-[var(--on-surface-variant)]">
                          {fmtDate(l.preparedAt)} · caduca{' '}
                          {fmtDate(l.frozenUseByDate ?? l.useByDate)}
                          {i === 0 && ' · se gasta primero'}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums">
                        <strong>{fmtPortions(l.portionsRemaining ?? 0)}</strong>
                        <span className="text-[var(--on-surface-variant)]">
                          {' '}
                          / {fmtPortions(l.portions ?? 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Platos de Cuiner que lo gastan</h3>
              {counter.dishes.length === 0 ? (
                <p className="text-sm font-medium text-error">
                  Ninguno: las ventas de Cuiner no descuentan este contador.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {counter.dishes.map((d) => (
                    <li
                      key={d.id}
                      className={`flex min-h-[40px] items-center gap-1 rounded-full border border-[var(--outline-variant)] py-1 pl-3 text-sm ${canManage ? 'pr-1' : 'pr-3'}`}
                    >
                      {d.name ?? d.producto}
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {d.tipo}-{d.producto}
                      </span>
                      {d.portionsPerSale !== 1 && (
                        <span className="text-xs text-[var(--on-surface-variant)]">
                          ×{fmtPortions(d.portionsPerSale)}
                        </span>
                      )}
                      {d.perPiece && (
                        <span className="text-xs text-[var(--on-surface-variant)]">por pieza</span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          aria-label={`Quitar ${d.name ?? d.producto}`}
                          onClick={() =>
                            unlink.mutate({ id: counter.id, dishId: d.id }, { onError: fail })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-container-high)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <PortionDishLinker
                  counterId={counter.id}
                  linkedKeys={new Set(counter.dishes.map((d) => `${d.tipo}|${d.producto}`))}
                  onPendingChange={setPendingDishes}
                />
              )}
            </section>

            {canManage && (
              <section>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="block text-[var(--on-surface-variant)]">
                      Avisar cuando queden
                    </span>
                    <input
                      inputMode="decimal"
                      value={minPortions}
                      onChange={(e) => setMinPortions(e.target.value)}
                      onBlur={saveMin}
                      className="mt-1 w-28 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={toggleActive}
                    className="ml-auto min-h-[44px] rounded-lg border border-[var(--outline-variant)] px-3 text-sm hover:bg-[var(--surface-container-high)]"
                  >
                    {counter.active ? 'Desactivar contador' : 'Volver a activar'}
                  </button>
                  <button
                    type="button"
                    onClick={deleteCounter}
                    className="flex min-h-[44px] items-center gap-1 rounded-lg border border-error/40 px-3 text-sm text-error hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Borrar contador
                  </button>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Historial</h3>
              {data.movements.length === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)]">Sin movimientos.</p>
              ) : (
                <ul className="divide-y divide-[var(--outline-variant)] rounded-lg border border-[var(--outline-variant)] text-sm">
                  {data.movements.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <span className="font-medium">{MOVEMENT_LABEL[m.type]}</span>
                        {m.shortfall && (
                          <span className="ml-2 rounded-full bg-error/10 px-2 py-0.5 text-xs font-semibold text-error">
                            sin raciones
                          </span>
                        )}
                        <span className="block text-xs text-[var(--on-surface-variant)]">
                          {fmtDateTime(m.createdAt)}
                          {m.userName && ` · ${m.userName}`}
                          {m.reason && ` · ${m.reason}`}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${m.quantity < 0 ? 'text-error' : ''}`}
                      >
                        {signed(m.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => void requestClose()} className="min-h-[44px]">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
