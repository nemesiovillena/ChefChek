# Fase 2 — subida de imagen + componente de vista visual

## Contexto
Ver `plan.md`. Reutilizar el patrón de subida de avatar (`processImageForUpload`
+ `useApiMutation` FormData) y el patrón de PDF ya existente
(`openGeneratedPdf`/`handleViewRecipeCard`) para el icono de imprimir.

## Archivos a modificar/crear
- `frontend/src/hooks/use-recipes.ts` — nuevo `useUploadRecipeImage()`.
- `frontend/src/app/dashboard/recipes/page.tsx` — campo de imagen en el modal (tab General), nuevo botón "Vista visual" (desktop), cambiar el tap de fila en móvil, montar el nuevo componente.
- `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx` — NUEVO componente.

## 2.1 Hook de subida
En `use-recipes.ts`, junto a los demás hooks:
```ts
export function useUploadRecipeImage() {
  return useApiMutation<{ imageUrl: string }, FormData>(
    '/v1/recipes/upload-image',
    'POST',
  );
}
```
(mismo patrón que `useUploadUserAvatar` en `use-users.ts`).

## 2.2 Campo de imagen en el modal (tab General)
En `page.tsx`, tab `general` del formulario:
- Estado: añadir `imageUrl` a `formData` (o estado separado como hace
  `user-modal.tsx` con `avatarUrl`, para no meterlo en el payload de texto).
- Input file oculto + botón "Subir foto" / preview con `next/image` (igual
  patrón que `user-modal.tsx`: `processImageForUpload(file, 1600)` — usar
  dimensión mayor que el avatar (1600px) porque es una foto de plato, no un
  avatar redondo — luego `uploadRecipeImageMutation.mutateAsync(form)`.
- Al enviar el formulario (`handleSubmit`), incluir `imageUrl` en el payload
  de create/update.
- Al abrir "Editar", precargar `imageUrl` desde `selectedRecipe.imageUrl`.
- Al cerrar/resetear el modal, limpiar el estado de imagen igual que los
  demás campos.

## 2.3 Componente `recipe-visual-view.tsx`
Modal a pantalla completa (mismo patrón `fixed inset-0` que el modal de
crear/editar), responsivo:
- Móvil: una columna, imagen arriba (o placeholder), luego ingredientes,
  luego pasos.
- Desktop/tablet (`md:`+): dos columnas — ingredientes en sidebar (sticky),
  pasos en columna principal; imagen como hero arriba a todo el ancho o
  partida con el título.
- Header: nombre, descripción/notas, badges de alérgenos
  (`AllergenBadge`/`AllergenIcon` ya existen), categorías, porciones.
- Ingredientes: lista con cantidad + unidad + nombre de producto
  (`recipe.ingredients`), sin costes (vista de cocina, no de gestión).
- Pasos: parsear `recipe.elaboration` con `parseSteps()` (ya existe en
  `elaboration-step-editor.tsx`, exportado) → cada paso como tarjeta
  numerada con badges de equipo/tiempo/temperatura si existen.
- Placeholder de imagen: si no hay `imageUrl`, mostrar un bloque decorativo
  (no una foto genérica de stock) — icono + fondo con los tokens M3 del
  proyecto.
- Icono imprimir: llama al mismo flujo que ya existe para el PDF "Receta"
  (pasar como prop un callback `onPrint` desde `page.tsx` que reutiliza
  `handleViewRecipeCard`/`openGeneratedPdf` tal cual, sin tocar el backend
  de PDF).
- Botón cerrar (X).
- Seguir convenciones ya establecidas del proyecto: `role="dialog"`,
  tokens `var(--...)` sin `dark:` (globals.css ya redefine en `.dark`),
  `<div>` para títulos (no `<nav>`/`<header>` sin `.fixed`, ver memoria
  `globals-css-hides-page-header-too`/`globals-css-hides-nav-tabs`).

## 2.4 Puntos de entrada en `page.tsx`
- Desktop (tabla, fila de acciones ~L772-815): nuevo botón antes de
  "Receta"/"Ficha técnica" (icono `Eye` de lucide-react), `onClick` abre el
  componente con la receta seleccionada.
- Móvil (`md:hidden` card list ~L633-643): cambiar el `onClick` de
  `handleViewRecipeCard(recipe)` a abrir la vista visual en vez del PDF.
  El icono de imprimir queda DENTRO de la vista visual para no perder la
  función de imprimir en móvil.

## Validación
- `cd frontend && bun run typecheck` (o `bun run build`).
- Probar en el navegador: crear receta con imagen, abrir vista visual en
  viewport móvil/tablet/desktop (resize), pulsar imprimir y confirmar que
  abre el mismo PDF "Receta" de siempre.
