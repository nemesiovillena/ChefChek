'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRecipeOptions } from '@/hooks/use-recipes';
import { useLabelProductOptions } from '@/hooks/use-food-labels';

export type PortionCounterSourceType = 'recipe' | 'product';

export interface PortionCounterSourcePick {
  type: PortionCounterSourceType;
  id: string;
  name: string;
}

interface Props {
  initialType?: PortionCounterSourceType;
  value: PortionCounterSourcePick | null;
  onChange: (pick: PortionCounterSourcePick | null) => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base';

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Elige a qué se une un contador: una receta (etiquetas de elaborado) o un
 * artículo (etiquetas de manipulado). Lo usan el alta y «Cambiar» en la ficha.
 */
export function PortionCounterSourcePicker({ initialType = 'product', value, onChange }: Props) {
  const [type, setType] = useState<PortionCounterSourceType>(value?.type ?? initialType);
  const [search, setSearch] = useState('');

  const recipes = useRecipeOptions();
  const products = useLabelProductOptions(type === 'product' ? search : '');

  const options = useMemo(() => {
    if (type === 'product') return (products.data ?? []).slice(0, 30);
    const term = fold(search.trim());
    return (recipes.data ?? [])
      .filter((r) => !term || fold(r.name).includes(term))
      .slice(0, 30);
  }, [type, search, recipes.data, products.data]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué se cuenta">
        {(
          [
            ['product', 'Artículo'],
            ['recipe', 'Receta'],
          ] as const
        ).map(([option, label]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => {
              setType(option);
              onChange(null);
            }}
            className={`min-h-[44px] rounded-lg border text-sm font-semibold ${type === option ? 'border-primary bg-primary text-primary-foreground' : 'border-[var(--outline-variant)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2">
          <span className="font-medium">{value.name}</span>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div>
          <label className="block text-sm">
            <span className="text-[var(--on-surface-variant)]">
              Buscar {type === 'product' ? 'artículo' : 'receta'}
            </span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={type === 'product' ? 'ej. lubina' : 'ej. solomillo'}
              className={fieldClass}
            />
          </label>
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--outline-variant)]">
            {options.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--on-surface-variant)]">
                {type === 'product' && !search.trim() ? 'Escribe para buscar.' : 'Sin resultados.'}
              </li>
            ) : (
              options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ type, id: o.id, name: o.name })}
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
    </div>
  );
}
