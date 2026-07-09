# Fase 02 — Frontend: celda "Última Compra" editable inline + indicador de origen

**Depende de Fase 01** (respuesta expone `manualPurchaseDate`, `lastPurchaseDate` recalculado, `purchaseDateSource`).

## Contexto (ficheros verificados)

- `frontend/src/hooks/use-products.ts:48-84` — interfaz `Product` (ya tiene `lastPurchaseDate?: string | null` en `:81`). `UpdateProductData` (`:129-132`) extiende `Partial<CreateProductData>`.
- `frontend/src/hooks/use-products.ts:165-167` — `useUpdateProduct()` = `useUpdate` de `useCrud('/v1/products', ['products'])`.
- `frontend/src/hooks/use-api.ts:138-153` — `useUpdate`: hace `PATCH /v1/products/:id` con `{...data}` (sin `id`) y **onSuccess invalida `['products']` + `['products', id]`**. → invalidación de lista ya cubierta; NO se necesita invalidación manual aquí (a diferencia de `use-recipe-cost`, memoria `use-recipe-cost-cache-stale-after-update`, que era caso aparte).
- `frontend/src/app/dashboard/articulos/page.tsx:363-367` — `formatLastPurchaseDate()`.
- `frontend/src/app/dashboard/articulos/page.tsx:593-603` — celda "Última Compra" (rama emerald si `lastPurchaseDate`, gris `createdAt` si null).
- `frontend/src/app/dashboard/articulos/page.tsx:60-77` — export CSV, columna `ÚltimaCompra` (`:76`).
- `frontend/src/app/dashboard/articulos/page.tsx:407-411` — orden por `lastPurchaseDate ?? createdAt`.
- Patrón `<input type="date">` ya en uso en la misma página: `:538`, `:543` (mismas clases Tailwind a reutilizar).
- NO tocar `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx`.

## Requisitos

1. Celda SIEMPRE clickeable (con o sin albarán).
2. Click → `<input type="date">` inline sembrado con la fecha manual actual (o `lastPurchaseDate`).
3. onBlur o Enter → `useUpdateProduct().mutate({ id, manualPurchaseDate: value || null })`.
4. Escape → cancelar sin guardar.
5. Indicador de origen (`title`/icono) según `purchaseDateSource`.
6. CSV/orden intactos (verificación, sin cambios).

## Ficheros a modificar

- `frontend/src/hooks/use-products.ts`
- `frontend/src/app/dashboard/articulos/page.tsx`

## Pasos

### 1. Tipos (`use-products.ts`)

En `interface Product` (junto a `:81`):

```ts
lastPurchaseDate?: string | null;
manualPurchaseDate?: string | null;
purchaseDateSource?: 'albaran' | 'manual' | null;
```

En `UpdateProductData` (`:129-132`), añadir:

```ts
manualPurchaseDate?: string | null;
```

### 2. Estado de edición inline (`page.tsx`)

Junto al resto de `useState` del componente:

```ts
const [editingDateId, setEditingDateId] = useState<string | null>(null);
const [dateDraft, setDateDraft] = useState<string>('');
const updateProduct = useUpdateProduct();
```

Helpers:

```ts
// ISO → "YYYY-MM-DD" para el value del input
const toDateInputValue = (iso?: string | null): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';

const startEditDate = (product: Product) => {
  setEditingDateId(product.id);
  setDateDraft(toDateInputValue(product.manualPurchaseDate ?? product.lastPurchaseDate));
};

const commitDate = (product: Product) => {
  const next = dateDraft || null;
  const current = toDateInputValue(product.manualPurchaseDate);
  setEditingDateId(null);
  if ((next ?? '') === (current || '')) return; // sin cambios → no mutar
  updateProduct.mutate(
    { id: product.id, manualPurchaseDate: next },
    { onError: () => {/* toast useNotification si el patrón lo exige */} },
  );
};
```

> Verificar el patrón de notificación de errores existente en la página (memoria
> `m3-destructive-dialog-replaces-native-confirm`: usar `useNotification()`/toasts, no `alert()`).
> Aquí no hay confirmación destructiva; solo manejo de error opcional.

### 3. Celda editable (`page.tsx:593-603`)

Sustituir el `<td>` por: en modo edición, `<input type="date">` (clases de `:538`);
si no, la fecha mostrada + indicador, clickeable:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm">
  {editingDateId === product.id ? (
    <input
      type="date"
      autoFocus
      value={dateDraft}
      onChange={(e) => setDateDraft(e.target.value)}
      onBlur={() => commitDate(product)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitDate(product);
        if (e.key === 'Escape') setEditingDateId(null);
      }}
      className="px-2 py-1 bg-white dark:bg-zinc-850 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    />
  ) : (
    <button
      type="button"
      onClick={() => startEditDate(product)}
      title={
        product.purchaseDateSource === 'manual'
          ? 'Fecha editada manualmente — clic para editar'
          : product.purchaseDateSource === 'albaran'
            ? 'Según último albarán — clic para editar'
            : 'Sin compras — clic para fijar fecha manual'
      }
      className="inline-flex items-center gap-1 cursor-pointer hover:underline"
    >
      <span className={product.lastPurchaseDate ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-400 dark:text-gray-500'}>
        {formatLastPurchaseDate(product.lastPurchaseDate ?? product.createdAt)}
      </span>
      {product.purchaseDateSource === 'manual' && (
        <span aria-hidden className="text-[10px] text-indigo-500" title="Manual">✎</span>
      )}
    </button>
  )}
</td>
```

Mantiene el fallback a `createdAt` cuando `lastPurchaseDate` es `null` (comportamiento previo).

### 4. CSV / orden — verificación (sin cambios)

- CSV (`:76`) consume `product.lastPurchaseDate` → ahora es el `max`. Correcto, sin cambios.
- Orden `lastPurchaseDate` (`:407-411`) idem. Sin cambios.
- Filtro por rango de fecha (`:531-533`, `:340-348`) usa `lastPurchaseDate ?? createdAt`. Sin cambios.

Confirmar que no rompen tras el cambio (revisión visual, no edición).

## Validación

```bash
cd frontend
npm run lint
npm run build   # typecheck Next
```

Manual (frontend con hot-reload):
1. Producto sin albarán → clic celda → input → fecha futura → Enter → se guarda, aparece con ✎ "manual".
2. Producto con albarán → fecha manual más reciente → gana manual; fecha manual anterior → gana albarán (sin ✎).
3. Vaciar input + Enter → limpia manual; vuelve a albarán/createdAt.
4. Escape no guarda.
5. Exportar CSV: columna ÚltimaCompra coherente con lo mostrado. Ordenar por Última Compra: orden correcto.

## Riesgos

- `toISOString().slice(0,10)` usa UTC → posible desfase de 1 día en zonas negativas (ver riesgo TZ del `plan.md`). Consistente con el resto de fechas de la app; documentar. Si molesta, formatear con componentes locales.
- `onBlur` dispara al abrir el date-picker nativo en algunos navegadores; probar que no cierra la edición antes de elegir (si ocurre, confirmar solo en `onChange`/Enter y quitar `onBlur`).

## Rollback

Cambios aditivos en 2 ficheros; revertir el diff. Sin migración de datos.
