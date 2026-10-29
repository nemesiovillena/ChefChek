'use client';

import { useMemo, useState } from 'react';
import { Ban, Link2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useRecipeOptions } from '@/hooks/use-recipes';
import { useProductSearch } from '@/hooks/use-product-search';
import type { Product } from '@/hooks/use-products';
import { useCuinerDishes, useDeleteCuinerDishMap, useServingMeasures, useSetCuinerDishMap } from '@/hooks/use-cuiner';
import { CUINER_DISH_TIPO_LABELS, type CuinerDishRow, type CuinerDishTipo } from '@/lib/cuiner-types';
import { formatMeasure, measuresForProduct, needsAvgUnitWeight, suggestMeasure } from '@/lib/cuiner-serving-measure-suggestion';
import { CuinerBulkLinkPanel } from './cuiner-bulk-link-panel';
import { Pager, inputCls } from './cuiner-link-cell';

type DishTarget = { recipeId: string } | { productId: string; servingMeasureId: string | null };

/**
 * Segundo paso al enlazar con un artículo: cuánto sale de él en cada venta.
 * Propone la medida que delata el nombre del plato («BARCELO CHUPITO» →
 * Chupito) y solo ofrece medidas compatibles con la unidad del artículo.
 */
function ServingMeasureStep({
  dish,
  product,
  onBack,
  onConfirm,
}: {
  dish: CuinerDishRow;
  product: Product;
  onBack: () => void;
  onConfirm: (servingMeasureId: string | null) => void;
}) {
  const measures = useServingMeasures();
  const options = useMemo(
    () => measuresForProduct(measures.data ?? [], product.referenceUnit, product.avgUnitWeight),
    [measures.data, product.referenceUnit, product.avgUnitWeight],
  );
  const suggested = useMemo(
    () => suggestMeasure(dish.nombre, options, `${product.name} ${product.category?.name ?? ''}`),
    [dish.nombre, options, product.name, product.category?.name],
  );
  // null = aún no tocado: se usa la sugerencia; '' = 1 unidad entera.
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? suggested?.id ?? '';

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <span className="font-medium">{product.name}</span>
        <span className="text-gray-500"> · se cuenta en {product.referenceUnit || 'sin unidad'}</span>
      </p>
      <label className="block text-sm font-medium" htmlFor={`measure-${dish.producto}`}>
        ¿Cuánto sale del artículo en cada venta?
      </label>
      {measures.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : (
        <select id={`measure-${dish.producto}`} className={inputCls} value={value} onChange={(e) => setPicked(e.target.value)}>
          <option value="">1 unidad entera ({product.referenceUnit || 'ud'})</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {formatMeasure(m)}
              {m.id === suggested?.id ? ' (sugerida)' : ''}
            </option>
          ))}
        </select>
      )}
      {!measures.isLoading && needsAvgUnitWeight(measures.data ?? [], product.referenceUnit, product.avgUnitWeight) && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Para venderlo por piezas (medida en unidades), indica su «Peso medio por pieza» en la ficha del artículo, pestaña Formato y
          precio.
        </p>
      )}
      {!measures.isLoading && options.length === 0 && (
        <p className="text-sm text-gray-500">
          No hay medidas para artículos en {product.referenceUnit || 'esa unidad'}: cada venta descontará 1 unidad entera.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onConfirm(value || null)}>
          Guardar enlace
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>
          Elegir otro artículo
        </Button>
      </div>
    </div>
  );
}

/**
 * Elige la receta (o el artículo de venta directa, p. ej. una bebida) que se
 * descontará del stock cada vez que se venda el plato en el TPV de Cuiner.
 */
function DishTargetPicker({
  dish,
  onPick,
  onCancel,
}: {
  dish: CuinerDishRow;
  onPick: (target: DishTarget) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'recipe' | 'product'>('recipe');
  const [product, setProduct] = useState<Product | null>(null);
  const [filter, setFilter] = useState(dish.nombre.toLowerCase());
  const recipes = useRecipeOptions();
  const products = useProductSearch(300);

  const recipeHits = useMemo(() => {
    const term = filter.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return (recipes.data ?? [])
      .filter((r) => r.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(term))
      .slice(0, 20);
  }, [recipes.data, filter]);

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="flex flex-wrap gap-2" role="tablist">
        {(['recipe', 'product'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              // Cada pestaña guarda su propio texto: al cambiar, se lleva el
              // que ya estaba escrito para no dejar el buscador vacío.
              if (m === mode) return;
              if (m === 'product') products.setSearch(filter);
              else setFilter(products.search);
              setMode(m);
              setProduct(null);
            }}
            className={`rounded-full px-3 py-1 text-sm ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 dark:bg-zinc-900 dark:text-zinc-300'}`}
          >
            {m === 'recipe' ? 'Receta de ChefChek' : 'Artículo de ChefChek (venta directa)'}
          </button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="ml-auto" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {product ? (
        <ServingMeasureStep
          dish={dish}
          product={product}
          onBack={() => setProduct(null)}
          onConfirm={(servingMeasureId) => onPick({ productId: product.id, servingMeasureId })}
        />
      ) : (
        <>
        <input
          className={inputCls}
          autoFocus
          placeholder={mode === 'recipe' ? 'Buscar receta de ChefChek' : 'Buscar artículo de ChefChek'}
          value={mode === 'recipe' ? filter : products.search}
          onChange={(e) => (mode === 'recipe' ? setFilter(e.target.value) : products.setSearch(e.target.value))}
        />
        <ul className="max-h-60 divide-y divide-gray-200 overflow-y-auto rounded-md bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {mode === 'recipe'
            ? recipeHits.map((r) => (
                <li key={r.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-zinc-800" onClick={() => onPick({ recipeId: r.id })}>
                    {r.name}
                  </button>
                </li>
              ))
            : products.products.slice(0, 20).map((p) => (
                <li key={p.id}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-zinc-800" onClick={() => setProduct(p)}>
                    {p.name}
                  </button>
                </li>
              ))}
        </ul>
        {(recipes.isLoading || products.loading) && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {!recipes.isLoading && mode === 'recipe' && recipeHits.length === 0 && (
          <p className="text-sm text-gray-500">Ninguna receta coincide. Cambia el texto de búsqueda.</p>
        )}
        {!products.loading && mode === 'product' && products.search.trim() && products.products.length === 0 && (
          <p className="text-sm text-gray-500">Ningún artículo coincide.</p>
        )}
        </>
      )}
    </div>
  );
}

export function CuinerDishesTab() {
  const notify = useNotification();
  const [tipo, setTipo] = useState<CuinerDishTipo>('P');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const { data, isLoading, error } = useCuinerDishes({ tipo, search, onlyUnmapped, page });
  const setMap = useSetCuinerDishMap();
  const deleteMap = useDeleteCuinerDishMap();

  async function save(action: () => Promise<unknown>) {
    try {
      await action();
      setEditing(null);
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo guardar el enlace', message: err instanceof Error ? err.message : '' });
    }
  }

  if (bulk) {
    return <CuinerBulkLinkPanel onClose={() => setBulk(false)} />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className={`${inputCls} max-w-[14rem]`}
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as CuinerDishTipo);
            setPage(1);
          }}
        >
          {(Object.keys(CUINER_DISH_TIPO_LABELS) as CuinerDishTipo[]).map((t) => (
            <option key={t} value={t}>
              {CUINER_DISH_TIPO_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          className={`${inputCls} max-w-sm`}
          placeholder="Buscar en la carta de Cuiner"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(draft.trim());
              setPage(1);
            }
          }}
          onBlur={() => {
            setSearch(draft.trim());
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(e) => {
              setOnlyUnmapped(e.target.checked);
              setPage(1);
            }}
          />
          Solo sin enlazar
        </label>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setBulk(true)}>
          Enlace rápido por marca
        </Button>
      </div>
      <p className="mb-2 text-sm text-gray-600 dark:text-zinc-400">
        Ordenados por unidades vendidas. Los platos sin enlazar no descuentan stock en ChefChek. Usa «No descontar»
        en platos a 0 € cuyo tamaño va en un extra (ración, doble): enlaza el extra y deja de salir aquí.
      </p>

      {isLoading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {data && (
        <>
          <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
            {data.items.map((dish) => {
              const key = `${dish.tipo}-${dish.producto}`;
              return (
                <li key={key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
                  <div>
                    <p className="font-medium">{dish.nombre}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{dish.producto}</span> · {dish.sold.toLocaleString('es-ES')} vendidos
                    </p>
                  </div>
                  {editing === key ? (
                    <DishTargetPicker
                      dish={dish}
                      onCancel={() => setEditing(null)}
                      onPick={(target) =>
                        save(() => setMap.mutateAsync({ tipo: dish.tipo, producto: dish.producto, ...target }))
                      }
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {dish.mapped?.kind === 'none' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
                          <Ban className="h-3.5 w-3.5" />
                          No descuenta stock
                        </span>
                      ) : dish.mapped ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <Link2 className="h-3.5 w-3.5" />
                          {dish.mapped.kind === 'recipe' ? 'Receta de ChefChek' : 'Artículo de ChefChek'}: {dish.mapped.name}
                          {dish.mapped.kind === 'product' && (
                            <span className="font-medium">
                              {' · '}
                              {dish.mapped.servingMeasure
                                ? `${dish.mapped.servingMeasure.name} ${formatMeasure(dish.mapped.servingMeasure)}`
                                : '1 unidad'}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Sin enlazar</span>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(key)}>
                        {dish.mapped && dish.mapped.kind !== 'none' ? 'Cambiar' : 'Enlazar'}
                      </Button>
                      {dish.mapped?.kind !== 'none' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title="Para platos a 0 € cuyo tamaño va en un extra (ración, doble): no descuenta y deja de salir sin enlazar"
                          onClick={() =>
                            save(() => setMap.mutateAsync({ tipo: dish.tipo, producto: dish.producto, noStock: true }))
                          }
                        >
                          No descontar
                        </Button>
                      )}
                      {dish.mapped && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={dish.mapped.kind === 'none' ? 'Volver a sin enlazar' : 'Quitar enlace'}
                          onClick={() => save(() => deleteMap.mutateAsync({ tipo: dish.tipo, producto: dish.producto }))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {data.items.length === 0 && <li className="py-6 text-center text-sm text-gray-500">Sin resultados.</li>}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </div>
  );
}
