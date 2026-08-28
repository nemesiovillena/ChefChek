# Scout Report — Reusar el picker de imagen de Artículos en Recetas

## Objetivo
En el modal de Receta, sustituir el bloque "Foto" actual (input file + botón "Subir foto")
por el mismo control de Artículos: **Buscar imagen** (Pexels) · **Subir archivo** · **Quitar**.

## Componente a reutilizar
- `frontend/src/app/dashboard/articulos/components/product-image-picker.tsx` — `ProductImagePicker`.
  - Props ya genéricas: `imageUrl`, `onChange(url)`, `defaultQuery`, `onUploadFile(file)`, `uploading?`.
  - Único acoplamiento a "product":
    - importa `useProductImageSearch` (`frontend/src/hooks/use-product-image-search.ts`) → GET `/api/v1/products/image-search?q=` — **es una búsqueda Pexels genérica por texto**, sin lógica de producto; reutilizable tal cual desde Recetas.
    - importa `ProductThumbnail` (`.../product-thumbnail.tsx`) — genérico (img plano + fallback icono).
  - Panel de búsqueda usa `<img>` plano (no next/image) → dominios Pexels OK dentro del picker.

## Recomendación (DRY, mínimo cambio)
Mover el picker y el thumbnail a ubicación compartida y renombrar (sin sufijo "product"):
- `frontend/src/components/image-picker.tsx`  (desde `product-image-picker.tsx`)
- `frontend/src/components/image-thumbnail.tsx` (desde `product-thumbnail.tsx`)
- Actualizar imports en `articulo-modal.tsx` (línea 10) y en `product-image-picker.tsx` (import de thumbnail).
- `use-product-image-search.ts`: dejar donde está (el endpoint vive bajo `/products`), o renombrar a `use-image-search.ts`. Endpoint backend sin cambios.

## Cambios en Recetas
Archivo: `frontend/src/app/dashboard/recipes/page.tsx`
- Bloque "Foto" actual: **líneas ~997-1034** (label + input file oculto + preview `next/image` + botón "Subir foto").
- Sustituir por:
  ```tsx
  <ImagePicker
    imageUrl={recipeImageUrl}
    onChange={setRecipeImageUrl}
    defaultQuery={formData.name}
    onUploadFile={handleRecipeImageUpload}
    uploading={isUploadingRecipeImage}
  />
  ```
- `handleRecipeImageFileChange` (líneas 404-431) pasa a `handleRecipeImageUpload(file: File)`:
  quitar el desempaquetado del `event`; mantener `processImageForUpload(file, 1600)`, límite 4 MB,
  `uploadRecipeImageMutation` y `setRecipeImageUrl(result.imageUrl)`.
- Se puede eliminar `recipeImageInputRef` y el `<input type="file">` inline (los aporta el picker).
- Estado/guardado sin cambios: `recipeImageUrl`, línea 450 (`imageUrl: recipeImageUrl || (... ? null : undefined)`), reset en 498/907/1335, hidratación en 537.

## Renderizado next/image vs dominio Pexels (evidencia en conflicto)
- Recetas renderiza la foto con `next/image`:
  - `frontend/src/app/dashboard/recipes/page.tsx:1009` (preview del modal)
  - `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx:41` (vista visual pantalla completa)
- `frontend/next.config.ts` `images.remotePatterns` solo permite `lh3.googleusercontent.com`.
  Subidas propias van a `/uploads/recipes/...` (mismo origen, OK). Resultados de búsqueda vienen de
  **`images.pexels.com`** (`pexels-image-search.service.ts:84` usa `photo.src.large2x`).
- Artículos resuelve esto usando `<img>` plano en todos lados (histórico: antes era Google CSE, dominios arbitrarios).
- **Recomendado aquí:** añadir `{ protocol: "https", hostname: "images.pexels.com" }` a `remotePatterns`
  (única fuente externa, dominio estable) → `next/image` sigue funcionando en modal y vista visual sin tocar JSX.
  Alternativa: cambiar ambos `next/image` de receta a `<img>` plano (más invasivo, pero alineado con Artículos).

## Backend
Sin cambios.
- `POST /api/v1/recipes/upload-image` ya existe (`recipes.controller.ts:215`) → `{ imageUrl: "/uploads/recipes/..." }`.
- `GET /api/v1/products/image-search?q=` genérico, reutilizable.
- `CreateRecipeDto.imageUrl` es `@IsOptional() @IsString()` (acepta cualquier URL).

## Nota UX
El picker de Artículos limita subida a **2 MB** (`product-image-picker.tsx:49`); Recetas usa **4 MB**
tras `processImageForUpload(file, 1600)`. Al compartir componente: parametrizar el límite por prop
(`maxSizeMB`, default 2) o mover la validación de tamaño al callback `onUploadFile` de cada feature.
Recetas ya valida 4 MB en su handler → basta con subir/quitar el guard de 2 MB del picker o hacerlo configurable.

## Preguntas abiertas
1. ¿`next/image` + remotePattern Pexels (recomendado) o `<img>` plano como Artículos?
2. ¿Renombrar `use-product-image-search` → `use-image-search` o dejarlo (endpoint sigue bajo `/products`)?
3. Límite de subida en Recetas: mantener 4 MB (parametrizar el picker) — confirmar.
