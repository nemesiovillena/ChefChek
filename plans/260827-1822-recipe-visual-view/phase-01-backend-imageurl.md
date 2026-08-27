# Fase 1 — completar imageUrl en el CRUD de recetas

## Contexto
`Recipe.imageUrl` existe en Prisma y `POST /v1/recipes/upload-image` ya sube
el archivo y devuelve la URL, pero nada del CRUD lo persiste ni lo devuelve:
falta en `CreateRecipeDto`, en `create()`/`update()` de `recipes.service.ts`,
en `formatRecipeResponse()` y en `RecipeResponse`.

## Archivos a modificar
- `backend/src/modules/recipes/dto/create-recipe.dto.ts`
- `backend/src/modules/recipes/dto/recipe-response.dto.ts`
- `backend/src/modules/recipes/recipes.service.ts`

## Cambios
1. `create-recipe.dto.ts`: añadir `@IsOptional() @IsString() imageUrl?: string;`.
2. `recipe-response.dto.ts`: añadir `imageUrl?: string;` a `RecipeResponse`.
3. `recipes.service.ts`:
   - `create()`: desestructurar `imageUrl` del DTO y añadirlo a `data` del `prisma.recipe.create`.
   - `update()`: desestructurar `imageUrl = recipe.imageUrl` y añadirlo a `data` del `prisma.recipe.update`. Permitir borrar la imagen enviando `imageUrl: null` explícito (no confundir con `undefined` = no tocar; usar el mismo patrón `??`/default que el resto de campos, pero sin pisar con `undefined`).
   - `formatRecipeResponse()`: añadir `imageUrl: recipe.imageUrl ?? null,` al objeto devuelto.

## Validación
- `cd backend && bun run typecheck` (o `tsc --noEmit` si no hay script typecheck).
- Test manual vía curl: crear receta con `imageUrl`, hacer GET y confirmar que vuelve.
