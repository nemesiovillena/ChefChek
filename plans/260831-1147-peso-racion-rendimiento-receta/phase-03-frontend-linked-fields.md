# Fase 3 — Frontend: campos enlazados + tipos + fix parseFloat

## Archivos a modificar
- `frontend/src/hooks/use-recipes.ts` (tipos `Recipe`, `CreateRecipeInput`/`UpdateRecipeInput`)
- `frontend/src/types/api.types.ts` (~l.82, si el tipo Recipe vive también aquí)
- `frontend/src/app/dashboard/recipes/page.tsx` (formulario + submit + edit + display)
- `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx` (~l.76 display)

## Tipos
- `use-recipes.ts` l.52-53, 92-93: añadir `totalYieldWeight?: number | null;`.
- Inputs de create/update: añadir `totalYieldWeight?: number`.

## Formulario (`page.tsx`)

### Estado
`formData` gana `totalYieldWeight: string`. Defaults nuevos: `portions:'1'`,
`portionSize:'250'`, `totalYieldWeight:'250'` (l.186-187, 492-493, 928-929, 1331-1332).

### 3 campos enlazados (reemplaza el grid l.1049-1076)
Orden: **Peso total elaborado (g)** · **Raciones** · **Peso ración (g)**.
Invariante `T = R × P`. Handlers (regla "Raciones manda"):

| Campo editado | Recalcula | Fija |
|---|---|---|
| Peso total `T` | `P = T / R` | `R` |
| Raciones `R`   | `P = T / R` | `T` |
| Peso ración `P`| `R = T / P` | `T` |

```ts
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

function onYieldTotalChange(v: string) {
  const T = num(v), R = num(formData.portions);
  setFormData(f => ({ ...f, totalYieldWeight: v, portionSize: T && R ? round2(T / R).toString() : f.portionSize }));
}
function onPortionsChange(v: string) {
  const R = num(v), T = num(formData.totalYieldWeight);
  setFormData(f => ({ ...f, portions: v, portionSize: T && R ? round2(T / R).toString() : f.portionSize }));
}
function onPortionSizeChange(v: string) {
  const P = num(v), T = num(formData.totalYieldWeight);
  setFormData(f => ({ ...f, portionSize: v, portions: T && P ? round2(T / P).toString() : f.portions }));
}
// round2: Math.round(x*100)/100
```
- Los 3 inputs: `type="text" inputMode="decimal"`, sanitizado como el actual
  (`replace(',', '.').replace(/[^\d.]/g, '')`).
- Raciones deja de ser `type="number" min="1"` (permite decimales).

### Submit (l.446-467)
```ts
portions: parseFloat(formData.portions) || 1,
portionSize: parseFloat(formData.portionSize) || 250,
totalYieldWeight: parseFloat(formData.totalYieldWeight) || undefined,
```
Quitar los `parseInt`/`|| 250`/`|| 1` que fuerzan enteros y pisan el `0`.

### Edit (l.514-519)
```ts
portions: recipe.portions.toString(),
portionSize: recipe.portionSize?.toString() ?? '250',
totalYieldWeight: (recipe.totalYieldWeight ?? (recipe.portions * (recipe.portionSize ?? 0))).toString(),
```

### Display
- l.154 coste por ración inline: sin cambio (`totalCost / portions`).
- l.794 `{recipe.portions} ({recipe.portionSize}g)` → `{fmtRac(recipe.portions)} ({fmtG(recipe.portionSize)} g · total {fmtG(recipe.totalYieldWeight)} g)`.
- `recipe-visual-view.tsx` l.76: idem, mostrar `raciones` con `fmtRac`.
- `fmtRac`: hasta 2 decimales sin ceros de relleno (`Number(n.toFixed(2)).toString()`).

## Validación
- Editar Peso ración de una receta → Raciones cambia en vivo, guarda, reabre igual.
- Editar Peso total → Peso ración cambia, Raciones fija.
- Coste por Ración del modal coincide con `totalCost / portions` con portions decimal.
- `bun run build` / `next build` frontend sin errores TS.
