---
phase: 6
title: Frontend revisión y paso a Recetas
status: completed
priority: P2
effort: 2d
dependencies:
  - 4
  - 5
---

# Phase 6: Frontend revisión y paso a Recetas

## Overview

Vista de revisión de una captura, botón "Pasar a Recetas" que abre la receta en edición, y los cambios en la pantalla de Recetas que hacen visibles las notas y la fuente. Cierra con documentación.

## Requirements

- Functional:
  - Ver nombre, descripción, raciones, tiempos, pasos y enlace a la fuente.
  - Por ingrediente: texto original, cantidad/unidad normalizadas y artículo vinculado (cambiar, quitar o buscar otro), con indicación de si la sugerencia es automática y su confianza.
  - Resumen antes de pasar: cuántos pasarán como líneas y cuántos a notas, y aviso de que con pendientes la receta se crea inactiva.
  - "Pasar a Recetas" navega a la receta creada **abierta en edición**.
  - En Recetas, las notas se ven y se editan, y la fuente aparece como enlace.
  - Capturas `PASADA` son de solo lectura y enlazan a su receta.
- Non-functional: la revisión no edita el contenido de la receta (eso se hace en Recetas); modal con ancho suficiente para todas las columnas.

## Architecture

```
frontend/src/app/dashboard/captura-recetas/components/
  recipe-capture-review.tsx
  capture-ingredient-row.tsx
```

**Revisión**
- Abrir al pulsar una fila `PENDIENTE` o `PASADA`. Referencia: `catalog-import-review.tsx`.
- Selector de artículo: reutilizar `product-combobox.tsx` de Recetas (busca con `useProductSearch`, no `useProducts`).
- Cambio de vínculo → `PATCH /:id/ingredients/:ingredientId`, invalidando el detalle.
- Chip del artículo: "Sugerido" cuando `matchConfidence` no es nulo, con énfasis "Revisar" si es < 1.
- Fila sin artículo o sin cantidad: etiqueta "irá a notas". (La incompatibilidad de unidad la decide el backend al pasar; el resultado real llega en la respuesta.)
- Pasos: render de solo lectura del JSON `{steps:[...]}` (reutilizar lo que sirva de `recipe-visual-view.tsx`).

**Pasar a Recetas**
- `POST /:id/promote` → `{ recipeId, lines, toNotes }`.
- 409 "ya se está pasando" → refrescar el detalle, sin navegar.
- Navegar solo si `recipeId` es un string no vacío: `router.push('/dashboard/recipes?recipe=<id>&edit=1')`.
- Invalidar listado de capturas, listado de recetas y queries de coste.
- Si `toNotes` difiere del resumen previo (unidades incompatibles), mostrar un aviso con el recuento real.
- Botón visible solo con `recipes.edit`.

**Cambios en Recetas (`recipes/page.tsx` y componentes)**
- Deep link: hoy `?recipe=<id>` abre la **vista visual** de solo lectura. Añadir `&edit=1`: si está presente y el usuario tiene `canEditRecipes`, fija `selectedRecipe` y abre el modal de edición; sin él, comportamiento actual intacto (lo usa el asistente).
- Modal de edición: campo "Notas" (`textarea`, 5000 caracteres) y enlace "Fuente" (`target="_blank" rel="noopener noreferrer"`) cuando hay `sourceUrl`. Enviar `notes` al guardar.
- `recipe-visual-view.tsx`: mostrar las notas y la fuente.
- Si las notas empiezan por el bloque de ingredientes pendientes, destacarlo como aviso (color de advertencia) en modal y vista.

## Related Code Files

- Create: los 2 componentes de revisión
- Modify: `frontend/src/hooks/use-recipe-captures.ts` (detalle, patch, promote), `captura-recetas/page.tsx`
- Modify: `frontend/src/app/dashboard/recipes/page.tsx` (deep link de edición, notas, fuente)
- Modify: `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx`
- Modify: `frontend/src/hooks/use-recipes.ts` (enviar `notes` en create/update)
- Modify: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/api-documentation.md`

## Implementation Steps

1. Hook: `useRecipeCapture(id)`, `useUpdateCaptureIngredient`, `usePromoteCapture`.
2. Componente de revisión con las secciones Datos / Ingredientes / Elaboración.
3. Fila de ingrediente con chip, X para quitar y lápiz para cambiar.
4. Resumen y botón "Pasar a Recetas", deshabilitado durante la mutación.
5. Recetas: notas y fuente en modal y vista. `page.tsx` tiene 1680 líneas: extraer el bloque de notas/fuente a un componente pequeño en `components/` en vez de engordarlo.
6. Recetas: deep link `&edit=1`. Comprobar que funciona aunque haya un filtro de categoría activo (la receta nueva no tiene categoría; ya hubo un bug de receta oculta por filtro) y con una receta **inactiva** abierta por un ADMIN.
7. Comprobar el caso USER: pasa una captura con pendientes → la receta es inactiva y `findOne` puede no devolvérsela. Si es así, tras pasar mostrar "Receta creada como inactiva; un administrador debe completarla" en vez de navegar.
8. Prueba completa en navegador con los tres orígenes, móvil y escritorio.
9. Documentación: módulo nuevo, endpoints, flujo, barrera SSRF, notas/fuente en Recetas.

## Success Criteria

- [ ] Cambiar o quitar el artículo de un ingrediente se guarda y actualiza el resumen.
- [ ] Pasar a Recetas abre el **modal de edición** con líneas, notas y fuente correctas.
- [ ] Las notas se ven en el modal y en la vista de la receta, y sobreviven a guardar.
- [ ] Doble pulsación no navega a `?recipe=null` ni crea dos recetas.
- [ ] La captura queda como "Pasada a Recetas" y enlaza a su receta.
- [ ] Usuario sin `recipes.edit` no ve el botón.
- [ ] `?recipe=<id>` sin `edit=1` sigue abriendo la vista visual.
- [ ] Docs actualizadas y coherentes con lo implementado.

## Risk Assessment

- **Selector de artículo de otro módulo → 403** si el rol tiene oculta la sección Artículos (ya ocurrió en Etiquetado y SICTED). Probar con un USER restringido; si falla, exponer una búsqueda propia bajo `recipe-captures`.
- **`recipes/page.tsx` es grande y central**: los cambios (deep link, notas) son aditivos; probar crear, editar y duplicar una receta normal antes de dar la fase por buena.
- **Notas en ficha técnica PDF**: fuera de alcance; los ingredientes pendientes no aparecen en el PDF. La receta inactiva evita que esa ficha se use mientras tanto.
