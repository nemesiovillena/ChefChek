# Fase 2 — Backend: DTO, service, response

## Archivos a modificar
- `backend/src/modules/recipes/dto/create-recipe.dto.ts`
- `backend/src/modules/recipes/dto/update-recipe.dto.ts` (si existe; si extiende Partial, nada)
- `backend/src/modules/recipes/recipes.service.ts`
- `backend/src/modules/recipes/dto/recipe-response.dto.ts`

## create-recipe.dto.ts
- `portions`: `@Min(1)` → `@Min(0.01)` (mantener `@IsNumber() @IsOptional()`).
- Añadir:
  ```ts
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalYieldWeight?: number;
  ```

## recipes.service.ts

### Helper de derivación (nuevo, privado)
La reconciliación entre los 3 campos según qué tocó el usuario vive en el FRONTEND
(fase 3): el cliente envía el trío ya coherente. El backend solo garantiza la
invariante y da retrocompat a clientes API que no manden `totalYieldWeight`.

```ts
/**
 * Devuelve el trío de rendimiento coherente (totalYieldWeight = portions × portionSize).
 * - Si llega totalYieldWeight → es el ancla; portionSize se recalcula desde él.
 * - Si no → se deriva de portions × portionSize (retrocompat).
 */
private resolveYield(input: { portions: number; portionSize: number; totalYieldWeight?: number | null }) {
  const portions = input.portions > 0 ? input.portions : 1;
  if (input.totalYieldWeight != null && input.totalYieldWeight > 0) {
    return {
      portions,
      totalYieldWeight: input.totalYieldWeight,
      portionSize: input.totalYieldWeight / portions,
    };
  }
  return {
    portions,
    portionSize: input.portionSize,
    totalYieldWeight: portions * input.portionSize,
  };
}
```
El FE, tras aplicar su regla de recálculo, manda siempre `portions` + `totalYieldWeight`
coherentes → `resolveYield` los respeta y `portionSize` sale exacto.

### create() (~l.142-195)
- Desestructurar `totalYieldWeight` del DTO.
- Antes de `prisma.recipe.create`, `const y = this.resolveYield({portions, portionSize, totalYieldWeight})`.
- Persistir `portions: y.portions, portionSize: y.portionSize, totalYieldWeight: y.totalYieldWeight`.
- `calculateCost(... y.portions, y.portionSize)`.

### update() (~l.396-460)
- Desestructurar `totalYieldWeight = recipe.totalYieldWeight`.
- `const y = this.resolveYield({portions, portionSize, totalYieldWeight})` usando los valores
  ya resueltos (con defaults del recipe).
- Persistir el trío `y.*` en `prisma.recipe.update`.
- `computeCostPerYieldUnit(totalCost, y.portions, y.portionSize)` — sin cambio de firma.
- NOTA: cambiar solo `totalYieldWeight`/`portionSize`/`portions` NO debe bump de versión
  (regla actual l.384-388 solo mira name/ingredients/subRecipes) — se mantiene.

### formatRecipeResponse / detailedCost (~l.860-970)
- Incluir `totalYieldWeight: recipe.totalYieldWeight` en `base`.
- El raw SQL de sub-recetas (l.655-675) no necesita el campo.

### Duplicar receta (~l.560-570)
- Copiar `totalYieldWeight: originalRecipe.totalYieldWeight`.

## recipe-response.dto.ts
- Añadir `totalYieldWeight: number | null;` (~l.90-93).

## Sin cambios necesarios
- `escandallos.service.ts`, `menus.service.ts`, `categories.service.ts`: leen
  `recipe.portions` en divisiones; float es transparente.
- `computeCostPerYieldUnit`: `totalYield = portions*portionSize` sigue == `totalYieldWeight`.

## Validación
- `bun run build` backend sin errores TS.
- `curl` PATCH receta con `{portionSize: 125}` → respuesta `portions` recalculada,
  `totalYieldWeight` intacto. Con `{totalYieldWeight: 2000}` → `portionSize` recalculado,
  `portions` intacto. (auth: [[api-testing-auth-session-tenant]])
