'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/components/notification-system';
import { useRecipeOptions } from '@/hooks/use-recipes';
import { useLabelProductOptions } from '@/hooks/use-food-labels';
import { useCreatePortionCounter } from '@/hooks/use-raciones';

type Source = 'recipe' | 'product';

interface Props {
  onClose: () => void;
  /** Recibe el id del contador creado (para abrir su detalle y enlazar platos). */
  onCreated: (id: string) => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Alta de un contador: qué etiquetas suman (las de una receta elaborada o las
 * de un artículo manipulado) y el mínimo con el que avisar.
 */
export function PortionCounterCreateDialog({ onClose, onCreated }: Props) {
  const addNotification = useNotification();
  const create = useCreatePortionCounter();
  const [source, setSource] = useState<Source>('product');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [minPortions, setMinPortions] = useState('3');

  const recipes = useRecipeOptions();
  const products = useLabelProductOptions(source === 'product' ? search : '');

  const options = useMemo(() => {
    if (source === 'product') return (products.data ?? []).slice(0, 30);
    const term = fold(search.trim());
    return (recipes.data ?? [])
      .filter((r) => !term || fold(r.name).includes(term))
      .slice(0, 30);
  }, [source, search, recipes.data, products.data]);

  const min = Number(minPortions.replace(',', '.'));
  const valid = picked && Number.isFinite(min) && min >= 0;

  const submit = async () => {
    if (!valid || !picked) return;
    try {
      const res = await create.mutateAsync({
        ...(source === 'recipe' ? { recipeId: picked.id } : { productId: picked.id }),
        minPortions: min,
      });
      const created = (res as { data: { id: string } }).data;
      addNotification({
        type: 'success',
        title: 'Contador creado',
        message: `${picked.name}: ahora enlaza sus platos de Cuiner.`,
      });
      onCreated(created.id);
    } catch (err) {
      addNotification({ type: 'error', title: 'No se pudo crear', message: (err as Error).message });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo contador</DialogTitle>
          <DialogDescription>
            Sumarán las etiquetas de lo que elijas. Pescados y carnes que se racionan
            suelen ser <strong>artículos</strong>; los platos elaborados, <strong>recetas</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué se cuenta">
            {(
              [
                ['product', 'Artículo'],
                ['recipe', 'Receta'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={source === value}
                onClick={() => {
                  setSource(value);
                  setPicked(null);
                }}
                className={`min-h-[44px] rounded-lg border text-sm font-semibold ${source === value ? 'border-primary bg-primary text-primary-foreground' : 'border-[var(--outline-variant)]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2">
              <span className="font-medium">{picked.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <div>
              <label className="block text-sm">
                <span className="text-[var(--on-surface-variant)]">
                  Buscar {source === 'product' ? 'artículo' : 'receta'}
                </span>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={source === 'product' ? 'ej. lubina' : 'ej. solomillo'}
                  className={fieldClass}
                />
              </label>
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
                {options.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-[var(--on-surface-variant)]">
                    {source === 'product' && !search.trim()
                      ? 'Escribe para buscar.'
                      : 'Sin resultados.'}
                  </li>
                ) : (
                  options.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setPicked({ id: o.id, name: o.name })}
                        className="min-h-[44px] w-full border-b border-[var(--outline-variant)] px-3 text-left text-sm last:border-b-0 hover:bg-[var(--surface-container-high)]"
                      >
                        {o.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          <label className="block text-sm">
            <span className="text-[var(--on-surface-variant)]">Avisar cuando queden</span>
            <input
              inputMode="decimal"
              value={minPortions}
              onChange={(e) => setMinPortions(e.target.value)}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">
              Raciones o menos. 0 = solo avisar al agotarse.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
