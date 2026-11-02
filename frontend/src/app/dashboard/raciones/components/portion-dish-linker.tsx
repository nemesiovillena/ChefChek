'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCuinerDishSearch, useLinkPortionDish } from '@/hooks/use-raciones';

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

/**
 * Buscador de platos de Cuiner para enlazarlos al contador. Cada venta del
 * plato gasta `portionsPerSale` raciones (media ración = 0,5).
 */
export function PortionDishLinker({ counterId }: { counterId: string }) {
  const addNotification = useNotification();
  const link = useLinkPortionDish();
  const [search, setSearch] = useState('');
  const [perSale, setPerSale] = useState('1');
  const term = search.trim();
  const { data: options = [], isFetching } = useCuinerDishSearch(term, term.length >= 2);

  const add = async (tipo: string, producto: string, nombre: string) => {
    const portionsPerSale = Number(perSale.replace(',', '.'));
    if (!Number.isFinite(portionsPerSale) || portionsPerSale <= 0) {
      addNotification({ type: 'error', title: 'Raciones por venta', message: 'Indica un número mayor que 0.' });
      return;
    }
    try {
      await link.mutateAsync({ id: counterId, tipo, producto, portionsPerSale });
      addNotification({ type: 'success', title: 'Plato enlazado', message: `${nombre}: sus ventas descuentan raciones.` });
      setSearch('');
      setPerSale('1');
    } catch (err) {
      addNotification({ type: 'error', title: 'No se pudo enlazar', message: (err as Error).message });
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--outline-variant)] p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="text-sm">
          <span className="text-[var(--on-surface-variant)]">Enlazar plato de Cuiner</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ej. solomillo"
            className={fieldClass}
          />
        </label>
        <label className="w-24 text-sm">
          <span className="text-[var(--on-surface-variant)]">Raciones/venta</span>
          <input
            inputMode="decimal"
            value={perSale}
            onChange={(e) => setPerSale(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      {term.length >= 2 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
          {isFetching && options.length === 0 ? (
            <li className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </li>
          ) : options.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[var(--on-surface-variant)]">
              Sin platos con ese nombre.
            </li>
          ) : (
            options.map((o) => (
              <li key={`${o.tipo}|${o.producto}`}>
                <button
                  type="button"
                  disabled={link.isPending}
                  onClick={() => add(o.tipo, o.producto, o.nombre)}
                  className="min-h-[44px] w-full border-b border-[var(--outline-variant)] px-3 py-1 text-left text-sm last:border-b-0 hover:bg-[var(--surface-container-high)]"
                >
                  {o.nombre}
                  <span className="block text-xs text-[var(--on-surface-variant)]">
                    {o.tipo === 'M' ? 'Menú' : 'Plato'} {o.producto}
                    {o.familia && ` · ${o.familia}`}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
