# Buscador de recetas en Etiquetado (Plato elaborado)

Fecha: 2026-09-30 17:44 · Solo código del repo (sin búsqueda web: la solución ya existe en casa)

## Resumen
- Hoy: `frontend/src/app/dashboard/etiquetado/nueva/page.tsx:374-391` pinta un `<select>` nativo con TODAS las recetas (`useRecipeOptions` → `GET /v1/recipes/options`, sin paginar, activas, orden A-Z). Sin filtro → lista enorme.
- Ya existe `SubRecipeCombobox` (`frontend/src/app/dashboard/recipes/components/sub-recipe-combobox.tsx`): Popover + cmdk con input "Escribe para buscar...", filtro en cliente. Se usa en sub-recetas (modal Receta) y en Fichas técnicas (`technical-sheets/page.tsx:168`) con los mismos datos `useRecipeOptions`.
- Recomendación: sustituir el `<select>` por `SubRecipeCombobox`. Cambio solo de frontend, ~15 líneas, sin backend ni migración. DRY.

## Cambio propuesto
```tsx
// etiquetado/nueva/page.tsx
import SubRecipeCombobox from '@/app/dashboard/recipes/components/sub-recipe-combobox';

{labelType === 'ELABORATED' && !freeDish && (
  <div>
    <span className={labelClass}>Receta</span>
    <div className="flex">
      <SubRecipeCombobox
        items={(recipeOptions.data ?? []).map(({ id, name }) => ({ id, name }))} // sin €/kg en etiquetado
        value={recipeId ?? ''}
        label={recipeOptions.data?.find((r) => r.id === recipeId)?.name}
        onSelect={(r) => setRecipeId(r.id)}
        placeholder="Buscar receta…"
      />
    </div>
  </div>
)}
```
- Se quita `pricePerKgOrL` de los items: el componente muestra €/kg-L si viene; en etiquetado no aporta (ya va a null sin permiso de coste, pero ADMIN lo vería).
- Preselección `?recipeId=` sigue funcionando (el trigger lee el nombre de `recipeOptions`).
- Opcional: renombrar el componente a `RecipeCombobox` y moverlo a `components/shared/` (ya lo usan 3 pantallas). No imprescindible → YAGNI, a decidir.

## Alternativas descartadas
- Buscador server-side (como `useProductSearch` de Artículos): innecesario; `/recipes/options` es ligero (id+nombre) y ya se carga entero. Solo compensa con miles de recetas.
- Input + lista siempre visible (patrón del bloque Artículo, líneas 393-417): ocupa más en móvil y duplica lógica.

## Pegas a vigilar
1. **Tildes**: cmdk no ignora acentos → "rape" sí, pero "cafe" no encuentra "Café". Arreglo barato: `<Command filter={...}>` con `normalize('NFD')` quitando diacríticos (beneficia también sub-recetas y fichas).
2. **Nombres duplicados**: `CommandItem value={item.name}`; dos recetas con el mismo nombre se resaltan juntas. Usar `value={`${item.name} ${item.id}`}` lo evita.
3. **Móvil**: Popover `w-[320px]` cabe en 360px; zoom iOS ya cubierto por el suelo de 16px global (`globals.css:292`). Probar en móvil porque Etiqueta está en el menú inferior.
4. Rehacer build/verificar en `:3000` (dev server del checkout correcto).

## Pasos siguientes
1. Aplicar cambio en `etiquetado/nueva/page.tsx`.
2. (Recomendado) filtro sin tildes + value único en `sub-recipe-combobox.tsx`.
3. Probar escritorio + móvil: buscar, elegir, cambiar de tipo (reset a null), llegada con `?recipeId=`.
4. `bun run lint` + typecheck frontend.

## Preguntas abiertas
- ¿Aplicar también el filtro sin tildes (afecta a sub-recetas y fichas técnicas)?
- ¿Mover/renombrar el componente a `shared/RecipeCombobox` o dejarlo donde está?
