---
phase: 4
title: "Pasar captura a Recetas"
status: pending
priority: P1
effort: "1.5d"
dependencies: [3]
---

# Phase 4: Pasar captura a Recetas

## Overview

Endpoint que convierte una captura `PENDIENTE` en una receta real de forma recuperable (sin duplicados aunque falle a medias), y cableado completo de `Recipe.notes` y `Recipe.sourceUrl` en el backend de Recetas.

## Requirements

- Functional:
  - Un ingrediente pasa como línea real solo si tiene artículo vinculado vigente, `quantity > 0`, unidad conocida **y compatible** con la unidad de referencia del artículo.
  - El resto va a `Recipe.notes`, con el motivo cuando no es simplemente "sin vincular".
  - Si algún ingrediente va a notas, la receta se crea **inactiva** (`isActive: false`) y no pública.
  - La receta guarda `sourceUrl` cuando la fuente fue una URL.
  - La captura queda `PASADA` con `recipeId`.
- Non-functional: nunca dos recetas para una captura; mismos permisos efectivos que crear una receta a mano; se reutiliza `RecipesService.create`.

## Architecture

### Notas y fuente en Recetas (backend)

Hoy `notes` y `sourceUrl` solo existen en el esquema: ni DTO, ni `create`/`update`, ni respuesta.

- `CreateRecipeDto`: `notes` (`@IsOptional() @IsString() @MaxLength(5000)`), `sourceUrl` (`@IsOptional() @IsUrl({ protocols: ["http","https"], require_protocol: true }) @MaxLength(2048)`).
- `create`: persistir ambos.
- `update`: persistir **solo si vienen definidos**; un guardado sin `notes` en el cuerpo no las borra.
- `recipe-response.dto.ts` y `formatRecipeResponse`: devolver ambos.
- Duplicar receta y snapshot de versión: copiar `notes`.
- `create` acepta un segundo parámetro opcional `opts?: { id?: string }` para crear con un id reservado.

### `POST /api/v1/recipe-captures/:id/promote` → `{ recipeId, lines, toNotes }`

1. **Reclamar**: `reservedRecipeId = createId()`; `updateMany({ where: { id, tenantId, status: PENDIENTE }, data: { status: PASANDO, reservedRecipeId, claimedAt: now } })`.
   - `count === 0` y la captura está `PASADA` → devolver su `recipeId` (idempotente).
   - `count === 0` y está `PASANDO` con `claimedAt` < 2 min → 409 "Ya se está pasando a Recetas".
   - `PASANDO` con `claimedAt` ≥ 2 min → **recuperar** (paso 6).
   - Otro estado → 409.
2. Recargar ingredientes con su artículo. Clasificar cada uno:
   - sin artículo, artículo borrado, sin cantidad o sin unidad → notas;
   - unidad incompatible: comparar `getUnitMeta(unit)` (`common/utils/product-costing.util.ts`) con la categoría de la unidad de referencia del artículo; si difiere → notas con "(unidad no compatible con el artículo)". El coste usa factor 1 ante un desajuste, así que "200 ml" contra un artículo en kg costaría 200 × €/kg sin error.
   - en otro caso → línea. Mapear `ud` → `units` (valor que guarda el editor).
3. Construir el DTO **y validarlo** con `plainToInstance` + `validate` (llamando al servicio directamente no pasa por el `ValidationPipe`):
   - `name`, `description`, `elaboration`, `portions ?? 1`, tiempos, `sourceUrl`;
   - `ingredients`: las líneas, con `note`;
   - `notes`: si hay pendientes, `Ingredientes pendientes de vincular (alérgenos incompletos):` + una línea por ingrediente (`rawText` + motivo);
   - `isActive: false` e `isPublic: false` si hay pendientes; si no, valores por defecto.
4. `RecipesService.create(tenantId, dto, { id: reservedRecipeId })`.
5. `update` de la captura: `status: PASADA`, `recipeId: reservedRecipeId`.
6. **Si el paso 4 o el 5 lanzan, o al recuperar un `PASANDO` antiguo**: buscar la receta `reservedRecipeId` (consulta que incluya borradas).
   - Existe → terminar: `PASADA` + `recipeId`. (`create` confirma la fila y después hace más consultas para formatear la respuesta; puede rechazar con la receta ya creada.)
   - No existe → volver a `PENDIENTE`, limpiar `reservedRecipeId`/`claimedAt` y propagar el error.

A diferencia de la confirmación de albaranes, aquí el efecto no es idempotente, por eso no basta con revertir: hay que comprobar si la receta llegó a existir.

### Permisos

Crear una receta exige hoy módulo `recipes` + sección `recipes` + `recipes.edit`. El guard de secciones combina clase y handler y **no** infiere el padre, así que en este controlador:
- handler de promote: `@RequireSection("recipes.edit")`;
- en el servicio, antes de reclamar: `ModulesService.isModuleEnabled(tenantId, "recipes")` y `RoleAccessService` permite la sección `recipes` para el rol. Si no → 403.

## Related Code Files

- Modify: `backend/src/modules/recipe-capture/recipe-capture.service.ts`, `recipe-capture.controller.ts`, `recipe-capture.module.ts` (importar `RecipesModule`, módulo de `modules` y de `role-access`)
- Modify: `backend/src/modules/recipes/dto/create-recipe.dto.ts`, `dto/recipe-response.dto.ts`, `recipes.service.ts`
- Modify: specs de ambos módulos

## Implementation Steps

1. Cablear `notes` y `sourceUrl` en Recetas (DTO, create, update, respuesta, duplicar, snapshot) y el parámetro `opts.id`. Tests: se guardan y devuelven; update sin `notes` las conserva; `sourceUrl: "javascript:…"` → 400.
2. Clasificador de ingredientes como función pura con tests: vinculado correcto, sin vincular, sin cantidad, artículo borrado, `ml` contra artículo en kg, `ud` contra artículo por unidades, `ud` → `units`.
3. `promote` con reclamo, validación del DTO, creación con id reservado y recuperación.
4. Tests de `promote`:
   - mezcla de ingredientes → líneas y notas correctas, receta inactiva;
   - todos vinculados → receta activa, sin bloque de pendientes;
   - segunda llamada tras terminar → mismo `recipeId`, una sola receta;
   - llamada concurrente durante `PASANDO` → 409;
   - `create` rechaza **después** de crear la fila → captura termina `PASADA` enlazada, sin duplicado;
   - `create` rechaza sin crear → captura vuelve a `PENDIENTE`;
   - `PASANDO` de hace 5 min con receta existente → se recupera; sin receta → se rehace;
   - usuario con sección `recipes` oculta → 403; módulo `recipes` apagado → 403; otro tenant → 404.
5. Comprobar que las recetas inactivas no salen en `findAllOptions`, etiquetado ni menú digital (ya se filtra por `isActive`; verificar, no asumir).

## Success Criteria

- [ ] Una captura pasada genera exactamente una receta, también con doble envío y con fallo a medias.
- [ ] Ningún ingrediente con unidad incompatible llega como línea.
- [ ] Con pendientes, la receta queda inactiva y las notas listan cada uno.
- [ ] `notes` y `sourceUrl` se guardan, se devuelven y sobreviven a una edición normal.
- [ ] Promote exige lo mismo que crear una receta a mano.
- [ ] `recipes.service.spec.ts` y `recipes.controller.spec.ts` en verde.

## Risk Assessment

- **Contrato público de Recetas**: solo campos opcionales nuevos y un parámetro opcional; compatible hacia atrás. `forbidNonWhitelisted` está activo, así que el frontend no puede enviar `notes` hasta que exista en el DTO (orden: backend antes que fase 6).
- **Receta inactiva = solo la ve ADMIN**. Un USER que pasa una captura con pendientes no podrá abrirla después. La fase 6 lo avisa en el resumen antes de pasar.
- **Receta eliminada después**: `SetNull` deja la captura `PASADA` sin `recipeId`; se muestra como "receta eliminada". No se confunde con un paso a medias porque ese estado es `PASANDO`.
