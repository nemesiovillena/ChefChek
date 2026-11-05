'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useCuinerDishSearch, useLinkPortionDish } from '@/hooks/use-raciones';

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

interface DishOption {
  tipo: string;
  producto: string;
  nombre: string;
}

const keyOf = (d: { tipo: string; producto: string }) => `${d.tipo}|${d.producto}`;

/**
 * Buscador de platos de Cuiner para enlazarlos al contador. Se marcan varios
 * (también de búsquedas distintas) y se enlazan de una vez. Cada venta gasta
 * `portionsPerSale` raciones (media ración = 0,5); si Cuiner lo vende al peso,
 * cada venta cuenta como una pieza en vez de por kilos.
 */
export function PortionDishLinker({
  counterId,
  linkedKeys,
  onPendingChange,
}: {
  counterId: string;
  /** `tipo|producto` ya enlazados a este contador. */
  linkedKeys: Set<string>;
  /** Avisa de cuántos platos hay marcados sin enlazar (para no perderlos al cerrar). */
  onPendingChange?: (count: number) => void;
}) {
  const addNotification = useNotification();
  const link = useLinkPortionDish();
  const [search, setSearch] = useState('');
  const [perSale, setPerSale] = useState('1');
  const [perPiece, setPerPiece] = useState(false);
  const [selected, setSelected] = useState<Map<string, DishOption>>(new Map());
  const term = search.trim();
  const { data: options = [], isFetching } = useCuinerDishSearch(term, term.length >= 2);

  const toggle = (o: DishOption) => {
    const next = new Map(selected);
    if (next.has(keyOf(o))) next.delete(keyOf(o));
    else next.set(keyOf(o), o);
    setSelected(next);
    onPendingChange?.(next.size);
  };

  const linkSelected = async () => {
    const portionsPerSale = Number(perSale.replace(',', '.'));
    if (!Number.isFinite(portionsPerSale) || portionsPerSale <= 0) {
      addNotification({
        type: 'error',
        title: 'Raciones por venta',
        message: 'Indica un número mayor que 0.',
      });
      return;
    }
    const linked: string[] = [];
    const failed: string[] = [];
    // Uno a uno: si un plato ya gasta otro contador, el resto se enlaza igual.
    for (const o of selected.values()) {
      try {
        await link.mutateAsync({
          id: counterId,
          tipo: o.tipo,
          producto: o.producto,
          portionsPerSale,
          perPiece,
        });
        linked.push(o.nombre);
      } catch (err) {
        failed.push(`${o.nombre}: ${(err as Error).message}`);
      }
    }
    if (linked.length) {
      addNotification({
        type: 'success',
        title: linked.length === 1 ? 'Plato enlazado' : `${linked.length} platos enlazados`,
        message: `${linked.join(', ')}: sus ventas descuentan raciones.`,
      });
    }
    if (failed.length) {
      addNotification({ type: 'error', title: 'No se pudo enlazar', message: failed.join(' · ') });
    }
    setSelected(new Map());
    onPendingChange?.(0);
    setPerSale('1');
    setPerPiece(false);
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="text-sm">
          <span className="text-[var(--on-surface-variant)]">Buscar platos de Cuiner</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ej. solomillo"
            className={fieldClass}
          />
        </label>
        <label className="w-28 text-sm">
          <span className="whitespace-nowrap text-[var(--on-surface-variant)]">Raciones/venta</span>
          <input
            inputMode="decimal"
            value={perSale}
            onChange={(e) => setPerSale(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={perPiece}
          onChange={(e) => setPerPiece(e.target.checked)}
          className="h-5 w-5"
        />
        <span>
          Se vende al peso
          <span className="block text-xs text-[var(--on-surface-variant)]">
            Cada venta resta una pieza, pese lo que pese (chuletón, parpatana…).
          </span>
        </span>
      </label>
      {term.length >= 2 && (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
          {isFetching && options.length === 0 ? (
            <li className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </li>
          ) : options.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[var(--on-surface-variant)]">
              Sin platos con ese nombre.
            </li>
          ) : (
            options.map((o) => {
              const key = keyOf(o);
              const already = linkedKeys.has(key);
              const marked = already || selected.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marked}
                    disabled={already || link.isPending}
                    onClick={() => toggle(o)}
                    className="flex min-h-[44px] w-full items-center gap-3 border-b border-[var(--outline-variant)] px-3 py-1 text-left text-sm last:border-b-0 hover:bg-[var(--surface-container-high)] disabled:opacity-60"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${marked ? 'border-primary bg-primary text-primary-foreground' : 'border-[var(--outline)]'}`}
                    >
                      {marked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      {o.nombre}
                      <span className="block text-xs text-[var(--on-surface-variant)]">
                        {already ? 'Ya enlazado · ' : ''}
                        {o.tipo === 'M' ? 'Menú' : 'Plato'} {o.producto}
                        {o.familia && ` · ${o.familia}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-error">
            {selected.size} {selected.size === 1 ? 'plato marcado' : 'platos marcados'}: aún sin
            enlazar
          </span>
          <Button onClick={linkSelected} disabled={link.isPending} className="min-h-[44px]">
            {link.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enlazar {selected.size === 1 ? 'plato' : `${selected.size} platos`}
          </Button>
        </div>
      )}
    </div>
  );
}
