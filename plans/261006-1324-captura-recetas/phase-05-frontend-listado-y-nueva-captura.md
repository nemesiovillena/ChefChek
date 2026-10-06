---
phase: 5
title: Frontend listado y nueva captura
status: in-progress
priority: P2
effort: 1d
dependencies:
  - 3
---

# Phase 5: Frontend listado y nueva captura

## Overview

Página `/dashboard/captura-recetas` con el listado de capturas y el formulario para crear una desde URL, texto o archivo.

## Requirements

- Functional:
  - Listado con nombre (o la URL/archivo mientras procesa), origen, estado y fecha.
  - Alta con tres modos: URL, pegar texto, subir foto/PDF.
  - `PROCESANDO` visible con actualización automática; `ERROR` muestra el motivo.
  - En una captura de texto con error, poder ver y copiar el texto que se pegó.
  - Descartar con confirmación.
  - IA sin configurar del todo: aviso con enlace a Configuración en vez del formulario.
- Non-functional: móvil primero; tokens M3 existentes; modo oscuro; sin `useEffect` directo.

## Architecture

```
frontend/src/hooks/use-recipe-captures.ts
frontend/src/lib/recipe-capture-types.ts
frontend/src/app/dashboard/captura-recetas/
  page.tsx
  components/recipe-capture-list.tsx
  components/recipe-capture-create-form.tsx
```

Calcar de `use-catalog-imports.ts`, `catalogos-tab.tsx` y `catalog-import-uploader.tsx`:
- `useRecipeCaptures()` con `refetchInterval` de 3 s mientras alguna fila esté `PROCESANDO` o `PASANDO`. El backend convierte las huérfanas en `ERROR` al listar, así que el sondeo siempre termina; el frontend no calcula antigüedades.
- Mutaciones `create`, `upload`, `discard` que invalidan el listado.
- `apiClient` ya desenvuelve `{ success, data }` y quita el `Content-Type` con `FormData`.

Selector de modo del formulario con `useState` (pestañas de un formulario, no rutas).

## Related Code Files

- Create: los 5 archivos de arriba
- Modify: ninguno (menú y ruta quedan en fase 1)

## Implementation Steps

1. Tipos (estados `PROCESANDO | PENDIENTE | ERROR | PASANDO | PASADA`; `DESCARTADA` no llega al listado) y hook.
2. `page.tsx`: título en `<div>` (no `<header>`: `globals.css` oculta `header:not(.fixed)`), formulario arriba y listado debajo.
3. Formulario:
   - URL: `type="url"`, validación `http(s)://` en cliente.
   - Texto: `textarea` con límite de 20 000 caracteres y contador (el servidor también lo impone).
   - Archivo: `accept="image/jpeg,image/png,image/webp,application/pdf"`, máximo 5 MB; HEIC rechazado en cliente con "usa JPG o PNG".
   - Inputs a 16 px mínimo (zoom en iOS).
   - 429 del tope de 3 simultáneas → mostrar el mensaje del backend.
4. Listado: tabla en escritorio y tarjetas en móvil; chips de estado (Procesando / Lista para revisar / Error / Pasando / Pasada a Recetas). Una `PASADA` sin `recipeId` se muestra como "Receta eliminada".
5. Fila con error de origen TEXTO: acción "Ver texto" que muestra `sourceText` con botón copiar.
6. Descartar con `useConfirm()` (no `confirm()` nativo).
7. Aviso de IA: consultar la config pública del asistente y usar `isReady` (no `hasApiKey`: puede haber clave sin modelo); si es falso, tarjeta con enlace a Configuración.
8. Si la página usa contenedores `fixed inset-0`, añadir `pb-28` por el menú inferior móvil.
9. `bun run build` y prueba en navegador (verificar que `:3000` sirve este worktree).

## Success Criteria

- [ ] Crear por URL muestra la fila en "Procesando" y pasa sola a "Lista para revisar" sin recargar.
- [ ] Texto y archivo funcionan igual.
- [ ] Un error muestra el mensaje del backend; el sondeo se detiene cuando no queda nada en curso.
- [ ] El texto pegado de una captura fallida se puede recuperar.
- [ ] Sin IA lista se ve el aviso y no el formulario.
- [ ] Usable a 375 px y en modo oscuro.
- [ ] Build de frontend sin errores de tipos.

## Risk Assessment

- **Foto de iPhone**: suele llegar como HEIC salvo que el navegador la convierta. Probar con un iPhone real; si el selector entrega HEIC, el mensaje debe decir cómo cambiarlo ("Ajustes → Cámara → Formatos → Más compatible").
- **Config del asistente legible por USER**: el endpoint público no depende del módulo `asistente-ia` ni devuelve la clave; comprobar que un USER puede leer `isReady`.
