# Research Report: Recetas inactivas (`isActive=false`) — visibilidad para usuarios

**Fecha:** 2026-10-05 (investigación sobre repo, branch `develop`)
**Tema:** «Las recetas que no están activas no las pueden ver los usuarios»

## Executive Summary

`isActive` es un toggle de la UI independiente del soft-delete (`deletedAt`). El backend **no oculta las recetas inactivas en el listado principal**: `GET /recipes` devuelve activas e inactivas a los tres roles (ADMIN/USER/VIEWER), sin query param para filtrar. La ocultación ocurre **solo en el frontend**: la vista móvil (`<md`) las filtra fuera por diseño explícito, y los pickers (sub-recetas, fichas técnicas, etiquetado) consumen `GET /recipes/options`, que sí filtra `isActive: true` server-side.

Por tanto, la afirmación «los usuarios no pueden ver las recetas inactivas» es **cierta en móvil y en todos los selectores**, y **falsa en el listado desktop/tablet**, donde aparecen con badge rojo/verde y —si el rol tiene `recipes.edit`— se reactivan con un clic. El asistente IA también las encuentra por nombre (no filtra `isActive`).

Implicación práctica: si un usuario en teléfono reporta «no veo la receta X», la causa más probable es que esté desactivada (la oculta la vista móvil) o que la busque en un picker. Reactivarla solo es posible desde iPad/desktop.

## Metodología

- Scout de código (sin web): lectura dirigida de backend, frontend, schema y tests.
- Archivos fuente: `recipes.service.ts`, `recipes.controller.ts`, `schema.prisma`, `dashboard/recipes/page.tsx`, `use-recipes.ts`, tools del asistente IA.
- Criterio: mapear TODAS las superficies donde una receta puede aparecer y verificar el filtro `isActive` en cada una.

## Mapa de visibilidad de una receta con `isActive=false` (no borrada)

| Superficie | ¿Visible? | Evidencia |
|---|---|---|
| Listado desktop/tablet (≥md) | ✅ Sí, badge rojo + toggle | `page.tsx:921` mapea `sortedRecipes` (sin filtro); toggle en `page.tsx:988-1011` |
| Listado móvil (<md) | ❌ No, por diseño | `page.tsx:243-246` `mobileVisibleRecipes` filtra `isActive !== false`; render en `page.tsx:860-865` |
| Detalle / ficha visual por ID | ✅ Sí | `findOne` sin filtro `isActive` (`recipes.service.ts:360+`) |
| Búsqueda del listado (desktop) | ✅ Sí | `findAll` busca por nombre/descripción sin filtrar `isActive` |
| Picker de sub-recetas | ❌ No | `findAllOptions` → `where: { tenantId, isActive: true }` (`recipes.service.ts:330`) |
| Selector Fichas técnicas | ❌ No | usa `useRecipeOptions` → `/recipes/options` |
| Selector Etiquetado (nueva etiqueta) | ❌ No | usa `useRecipeOptions` → `/recipes/options` |
| Asistente IA (`get_recipe_details` / coste) | ✅ Sí | `findNameMatches` (`recipes.service.ts:55-98`) filtra solo `tenantId` + `deletedAt IS NULL` |
| Coste como sub-receta de otra receta | ✅ Sí (sigue computando) | `recipeInclude` no filtra `isActive` |
| API `GET /recipes` (crud) | ✅ Devuelve todas | controller `:79` `@Roles(ADMIN, USER, VIEWER)`; `RecipesQueryDto` no acepta `isActive` |

## Detalles clave

### 1. La decisión de diseño está documentada en el código
`page.tsx:243-244`:
> «Vista móvil (< md): solo lectura, sin recetas desactivadas — el toggle de estado y las demás acciones quedan reservadas a iPad/desktop.»

Y `recipes.service.ts:633-634` (en `remove`):
> «No basta con `isActive:false` (es un toggle aparte y no la oculta).»

Es decir: `isActive` se concibió como "fuera de carta/selectores", no como ocultación total. El borrado real es `deletedAt` (papelera).

### 2. El backend no ofrece filtro server-side en el listado
`RecipesQueryDto` solo acepta `search/category/sortBy/sortOrder/page/limit`. Contraste: el módulo `menus` sí acepta `isActive` como query param (`menus.controller.ts:62`, `menus.service.ts:130`) — patrón a imitar si se quisiera filtrar server-side.

### 3. Reactivación: solo desktop y solo con permiso
- El toggle existe en la columna de estado (`page.tsx:988`); requiere `canSee('recipes.edit')`.
- Roles sin `recipes.edit` (p. ej. VIEWER con recetas visibles) ven el badge pero no pueden reactivar.
- En móvil no hay ninguna acción: una receta desactivada es **invisible e inalcanzable** desde teléfono.

### 4. Asistente IA y check-name comparten query sin filtro `isActive`
`findNameMatches` alimenta tanto al aviso advisory de duplicados como a `resolveRecipeByName` (tools IA). El comentario del controller (`recipes.controller.ts:114-115`) dice «devuelve recetas activas», pero el SQL no filtra `isActive` — drift documentación/código, menor.

## Interpretaciones posibles del reporte (ambigüedad)

**A. Lectura bug:** «los usuarios (en móvil/pickers) no ven recetas que deberían poder ver o reactivar». Causa: filtros descritos arriba. Fix candidado: mostrarlas en móvil con distintivo, o añadir toggle «Mostrar inactivas».

**B. Lectura feature:** «quiero que las recetas inactivas NO las vea nadie sin permiso de edición» (hoy VIEWER/USER las ve en desktop). Fix candidado: filtrar en `findAll` por rol/sección.

El código actual corresponde a ninguna de las dos al 100%: desktop las enseña a todos, móvil a nadie.

## Opciones de cambio (si procede)

1. **Mostrar inactivas en móvil** con badge «Inactiva» (sin acciones, igual que resto de móvil). Mínimo: quitar el filtro de `mobileVisibleRecipes` y añadir distintivo en la card.
2. **Toggle «Mostrar inactivas»** en desktop+móvil (estado local; el API ya devuelve todo). Igual patrón que otros filtros de la página.
3. **Ocultarlas a roles sin `recipes.edit` en el listado**: filtrar client-side sobre `sortedRecipes` (ojo: quien las desactive dejaría de verlas y no podría reactivarlas — restringir el filtro a `!canEditRecipes`).
4. **Filtro server-side** con param `isActive` en `RecipesQueryDto` siguiendo el patrón de `menus`. Solo necesario si hay razón de peso (paginación cuenta total, permisos server-enforced); hoy la paginación ya cuenta todas.
5. **Excluir inactivas del asistente IA**: añadir `AND r."isActive"` en `findNameMatches` — pero rompería el check de duplicados (que debe ver inactivas para avisar). Si se quiere, separar queries.

## Riesgos / efectos colaterales

- Filtrar `isActive` server-side en `findAll` rompería el flujo de reactivación (la receta desaparecería del listado al desactivarla y no habría forma de reactivarla desde la UI). Cualquier fix server-side necesita excluir del filtro a roles con edición o un param `includeInactive`.
- `isActive` no afecta al cálculo de costes ni a sub-recetas ya vinculadas: desactivar una receta usada como sub-receta no cambia escandallos. Coherente con la semántica actual; documentarlo si cambia.
- Comentario drift en `check-name` (dice «activas», no filtra) — corregir si se toca esa query.

## Preguntas sin resolver

1. ¿Lectura A (bug móvil) o B (ocultar también en desktop a no-editores)? Define el fix.
2. ¿Debe el asistente IA poder abrir recetas inactivas, o excluirse?
3. ¿Los pickers (fichas técnicas, etiquetado, sub-recetas) deben seguir excluyendo inactivas? (Hoy sí, y parece correcto.)

---

## Decisión del usuario (2026-10-05) e implementación

**Decisiones:** (1) Las recetas inactivas solo las ve el ADMIN. (2) El asistente IA las excluye.

**Implementado** (branch `develop`, sin commit):

- `recipes.service.ts` `findAll`: nuevo param `role`; `where` añade `isActive: true` salvo para ADMIN. Cubre desktop y móvil de USER/VIEWER en un solo punto (server-side), y la paginación/total queda coherente.
- `recipes.controller.ts`: `findAll` pasa `req.user?.role`. Corregido comentario drift de `check-name` (considera activas E inactivas a propósito — un duplicado de una desactivada sigue siendo duplicado).
- `recipe-match.util.ts` `resolveRecipeByName`: filtra `isActive !== false` antes de decidir not_found/ambiguous/unique → cubre `get_recipe_details` y `get_recipe_cost` (ambas pasan por el util). El check de duplicados NO se toca.
- Tests: service (USER/VIEWER filtran, ADMIN no), controller (reenvío de role), tool IA (inactiva = not_found; ignora inactivas al desambiguar). 65/65 pass; `tsc --noEmit` limpio.

**Sin cambios necesarios:** pickers (`/recipes/options` ya filtraba), móvil (ya ocultaba para todos; para ADMIN sigue ocultándolas por su diseño solo-lectura), frontend en general.

**Consecuencias aceptadas / residual:**
- Un USER con `recipes.edit` puede desactivar una receta → desaparece de SU lista; solo el ADMIN puede reactivarla.
- `GET /recipes/:id` sigue devolviendo inactivas a cualquier rol (enlace directo/bookmark antiguo). Si se quiere blindaje total, seguiría pendiente; no se consideró necesario.
- ADMIN en móvil no ve inactivas (diseño preexistente de móvil solo-lectura).

