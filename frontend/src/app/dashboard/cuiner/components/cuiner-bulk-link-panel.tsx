'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useProductSearch } from '@/hooks/use-product-search';
import { useCuinerBulkCandidates, useServingMeasures, useSetCuinerDishMapsBulk } from '@/hooks/use-cuiner';
import type { CuinerBulkGroup, CuinerBulkProduct, ServingMeasure } from '@/lib/cuiner-types';
import { formatMeasure, measuresForProduct, suggestMeasure, unitCategory } from '@/lib/cuiner-serving-measure-suggestion';
import { inputCls } from './cuiner-link-cell';

/** Valor del selector de medida que deja un plato fuera del enlace. */
const SKIP = 'skip';

const platos = (n: number) => (n === 1 ? '1 plato' : `${n} platos`);

const isMeasurable = (product: CuinerBulkProduct | null) => {
  const category = unitCategory(product?.referenceUnit);
  return category === 'volumen' || category === 'peso';
};

/** Buscador de artículo para cambiar el propuesto de un grupo. */
function GroupProductPicker({
  brand,
  onPick,
  onCancel,
}: {
  brand: string;
  onPick: (product: CuinerBulkProduct) => void;
  onCancel: () => void;
}) {
  const products = useProductSearch(300);
  const [touched, setTouched] = useState(false);
  const search = touched ? products.search : brand.toLowerCase();
  if (!touched && products.search !== search) products.setSearch(search);

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="flex gap-2">
        <input
          className={inputCls}
          autoFocus
          placeholder="Buscar artículo de ChefChek"
          value={search}
          onChange={(e) => {
            setTouched(true);
            products.setSearch(e.target.value);
          }}
        />
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <ul className="max-h-60 divide-y divide-gray-200 overflow-y-auto rounded-md bg-white dark:divide-zinc-800 dark:bg-zinc-900">
        {products.products.slice(0, 20).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-zinc-800"
              onClick={() =>
                onPick({ id: p.id, name: p.name, referenceUnit: p.referenceUnit, categoryName: p.category?.name ?? null })
              }
            >
              {p.name} <span className="text-xs text-muted-foreground">· {p.referenceUnit}</span>
            </button>
          </li>
        ))}
      </ul>
      {products.loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      {!products.loading && search.trim() && products.products.length === 0 && (
        <p className="text-sm text-gray-500">Ningún artículo coincide. Si falta, créalo en Artículos.</p>
      )}
    </div>
  );
}

interface GroupState {
  product: CuinerBulkProduct | null;
  selected: boolean;
}

/**
 * Asistente para enlazar de golpe los platos «MARCA + MEDIDA» del TPV:
 * un grupo por marca con el artículo propuesto y la medida de cada plato
 * sugerida por su nombre. Se revisa, se marca lo correcto y se enlaza.
 */
export function CuinerBulkLinkPanel({ onClose }: { onClose: () => void }) {
  const notify = useNotification();
  const candidates = useCuinerBulkCandidates();
  const measures = useServingMeasures();
  const save = useSetCuinerDishMapsBulk();
  // Solo se guarda lo que el usuario cambia; el resto sale de la propuesta.
  const [groupEdits, setGroupEdits] = useState<Record<string, Partial<GroupState>>>({});
  const [measureEdits, setMeasureEdits] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);

  const groups = candidates.data?.groups ?? [];
  const allMeasures: ServingMeasure[] = measures.data ?? [];

  /** Medida que delata el nombre del plato para ese artículo (id), o '' si ninguna. */
  const suggestedMeasureId = (product: CuinerBulkProduct, dish: CuinerBulkGroup['dishes'][number]) => {
    const options = measuresForProduct(allMeasures, product.referenceUnit);
    return suggestMeasure(dish.nombre, options, `${product.name} ${product.categoryName ?? ''}`)?.id ?? '';
  };

  /**
   * Un grupo viene marcado solo si el artículo casa con toda la marca, se
   * cuenta en volumen o peso y cada plato tiene su medida: lo dudoso se
   * deja para que el usuario lo revise.
   */
  const stateOf = (group: CuinerBulkGroup): GroupState => {
    const edits = groupEdits[group.brand];
    const product = edits?.product !== undefined ? edits.product : group.suggestedProduct;
    const selected =
      edits?.selected ??
      (!!product && group.exactMatch && isMeasurable(product) && group.dishes.every((d) => suggestedMeasureId(product, d) !== ''));
    return { product, selected };
  };
  const editGroup = (brand: string, patch: Partial<GroupState>) =>
    setGroupEdits((prev) => ({ ...prev, [brand]: { ...prev[brand], ...patch } }));

  const measureOf = (product: CuinerBulkProduct | null, dish: CuinerBulkGroup['dishes'][number]) => {
    if (measureEdits[dish.producto] !== undefined) return measureEdits[dish.producto];
    return product ? suggestedMeasureId(product, dish) : SKIP;
  };

  const items: { tipo: CuinerBulkGroup['dishes'][number]['tipo']; producto: string; productId: string; servingMeasureId: string | null }[] = [];
  for (const group of groups) {
    const { product, selected } = stateOf(group);
    if (!selected || !product) continue;
    for (const dish of group.dishes) {
      const measure = measureOf(product, dish);
      if (measure === SKIP) continue;
      items.push({ tipo: dish.tipo, producto: dish.producto, productId: product.id, servingMeasureId: measure || null });
    }
  }

  async function submit() {
    try {
      const { linked } = await save.mutateAsync(items);
      notify({ type: 'success', title: `${platos(linked)} ${linked === 1 ? 'enlazado' : 'enlazados'}`, message: 'Pulsa «Reintentar las sin enlazar» en Ventas para descontar sus ventas pendientes.' });
      setGroupEdits({});
      setMeasureEdits({});
    } catch (err) {
      notify({ type: 'error', title: 'No se pudieron enlazar', message: err instanceof Error ? err.message : '' });
    }
  }

  const loading = candidates.isLoading || measures.isLoading;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Platos
        </Button>
        <p className="flex-1 text-sm text-gray-600 dark:text-zinc-400">
          Platos sin enlazar con medida en el nombre (CHUPITO, PIEDRA, COPA, CAÑA…), agrupados por marca. Revisa el artículo y la
          medida de cada uno, marca los grupos correctos y enlázalos de una vez.
        </p>
        <Button type="button" onClick={submit} disabled={items.length === 0 || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Enlazar ${platos(items.length)}`}
        </Button>
      </div>

      {loading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />}
      {candidates.error && <p className="text-sm text-red-600">{candidates.error.message}</p>}
      {!loading && groups.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">No quedan platos con medida en el nombre sin enlazar.</p>
      )}

      <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
        {groups.map((group) => {
          const { product, selected } = stateOf(group);
          const options = product ? measuresForProduct(allMeasures, product.referenceUnit) : [];
          return (
            <li key={group.brand} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex min-w-[12rem] items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!product}
                    onChange={(e) => editGroup(group.brand, { selected: e.target.checked })}
                  />
                  {group.brand}
                  <span className="text-xs font-normal text-muted-foreground">{group.sold.toLocaleString('es-ES')} vendidos</span>
                </label>
                {product ? (
                  <span className="text-sm">
                    → <span className="font-medium">{product.name}</span>
                    <span className="text-muted-foreground"> · {product.referenceUnit || 'sin unidad'}</span>
                    {group.suggestedProduct?.id === product.id && !group.exactMatch && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        revisar
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin artículo propuesto</span>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setPicking(group.brand)}>
                  {product ? 'Cambiar artículo' : 'Elegir artículo'}
                </Button>
              </div>

              {product && !isMeasurable(product) && (
                <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  «{product.name}» se cuenta en {product.referenceUnit || 'sin unidad'}: cada venta descontaría el artículo entero.
                  Corrige su unidad en Artículos o elige otro.
                </p>
              )}

              {picking === group.brand && (
                <GroupProductPicker
                  brand={group.brand}
                  onCancel={() => setPicking(null)}
                  onPick={(picked) => {
                    editGroup(group.brand, { product: picked, selected: isMeasurable(picked) });
                    setMeasureEdits((prev) => {
                      const next = { ...prev };
                      for (const d of group.dishes) delete next[d.producto];
                      return next;
                    });
                    setPicking(null);
                  }}
                />
              )}

              <ul className="grid gap-2 pl-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.dishes.map((dish) => (
                  <li key={dish.producto} className="space-y-1">
                    <p className="text-sm">
                      {dish.nombre} <span className="text-xs text-muted-foreground">· {dish.sold.toLocaleString('es-ES')} vend.</span>
                    </p>
                    <select
                      aria-label={`Medida de ${dish.nombre}`}
                      className={inputCls}
                      disabled={!product}
                      value={measureOf(product, dish)}
                      onChange={(e) => setMeasureEdits((prev) => ({ ...prev, [dish.producto]: e.target.value }))}
                    >
                      <option value={SKIP}>No enlazar este plato</option>
                      <option value="">1 unidad entera</option>
                      {options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {formatMeasure(m)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
