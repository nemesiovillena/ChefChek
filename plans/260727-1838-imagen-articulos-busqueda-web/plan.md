# Plan: Imagen de artículo vía búsqueda web (Google Custom Search)

## Status
Draft — pendiente de aprobación para implementar.

## Contexto
El modelo `Product` ya tiene `imageUrl: String?` (backend/prisma/schema.prisma:179). Ya existe:
- Endpoint de subida manual `POST /products/upload-image` (backend/src/modules/products/products.controller.ts:186), guarda en `uploads/products/` (efímero en prod, ver `[[backup-module-app-level]]`/nota `/app/uploads efímero`).
- El campo se muestra hoy en `articulo-cards.tsx` (vista tarjetas, sin fallback) y en el diálogo de borrado (`page.tsx:852`, con fallback icono `Tag`).
- El control de subida vive dentro de la pestaña **Alérgenos** del modal (`tab-alergenos.tsx`), etiquetado como "ficha técnica o etiqueta" — no como foto identificativa del artículo.
- El listado denso (`page.tsx:648`) **no muestra imagen** en ninguna columna hoy.
- `next.config.ts` solo permite `lh3.googleusercontent.com` en `images.remotePatterns` → `next/image` no sirve para imágenes de dominios arbitrarios (las que vendrán de la búsqueda web). Hay que usar `<img>` plano, igual que ya hace `page.tsx:854`.

## Decisiones (confirmadas con el usuario)
1. **Alcance**: ambas cosas — (a) construir la función permanente de búsqueda de imagen en la app, y (b) usarla después para rellenar los artículos ya existentes (backfill), sin construir una herramienta masiva aparte por ahora.
2. **Fuente de imágenes**: Google Custom Search API (JSON API, `searchType=image`). Requiere crear un Programmable Search Engine (cse.google.com) con "buscar toda la web" + imágenes activado, y habilitar "Custom Search API" en el proyecto de Google Cloud (mismo proyecto que ya usa `GOOGLE_CLOUD_VISION_API_KEY` si se quiere reusar facturación, pero es una API distinta que hay que habilitar aparte).
3. **Almacenamiento**: se guarda solo la URL externa (hotlink) en `imageUrl`, tal cual. No se descarga ni se sube a storage propio. Riesgo aceptado: si la web de origen borra/mueve la imagen, el enlace deja de funcionar (mitigado con fallback visual `onError`, no falla la página). Almacenamiento persistente propio (S3/R2) queda para más adelante, fuera de este plan.
4. **Reutilización de campo**: se reutiliza `imageUrl` (sin migración de esquema). Se reposiciona el control fuera de la pestaña Alérgenos (ver Fase 2) para reflejar que ahora es "foto del artículo", no solo etiqueta.
5. **Tamaño en listado**: miniatura pequeña (32–36px), no la vista de tarjetas grandes que ya existe.
6. **"No imagen"**: se reutiliza el mismo patrón visual que ya existe en `ArticleContextCard` (icono `Tag` de lucide sobre fondo `surface-container-highest`), consistente con la preferencia ya expresada por el usuario de iconos reales sobre emojis (`[[allergen-icons-project-standard]]`).

## Fases
1. [Backend: integración Google Custom Search](phase-01-google-image-search-backend.md)
2. [Frontend: selector de imagen reutilizable](phase-02-frontend-image-picker.md)
3. [Listado: miniatura + fallback + fix hotlink](phase-03-listing-thumbnail-and-fallback.md)
4. [Backfill de artículos existentes](phase-04-backfill-existing-articles.md)

## Dependencias
- Fase 2 depende de Fase 1 (endpoint de búsqueda).
- Fase 3 es independiente de 1/2 (solo toca render), pero conviene hacerla junto a la 2 para no dejar el listado sin miniatura mientras se prueba.
- Fase 4 depende de 1+2+3 en producción/local funcionando.

## Requisito externo (bloqueante, lo hace el usuario)
Antes de la Fase 1: crear en https://programmablesearchengine.google.com/ un motor con "Search the entire web" + "Image search" activado (anotar el **Search Engine ID / cx**), y habilitar **Custom Search API** en Google Cloud Console + generar API key. Sin esto la Fase 1 no se puede probar (cuota gratis: 100 consultas/día).

## Criterios de aceptación
- Al editar/crear un artículo, un botón "Buscar imagen en internet" muestra varias miniaturas candidatas; al elegir una se guarda su URL en `imageUrl`.
- Si no se elige ninguna (o se quita la imagen), el artículo queda sin `imageUrl` y en todos los sitios donde se muestra aparece el placeholder "No imagen" (icono `Tag`), nunca un icono roto.
- El listado denso de artículos muestra una miniatura pequeña (~32px) junto al nombre, sin romper el layout de la tabla.
- Imágenes de dominios externos arbitrarios se renderizan correctamente (sin error de `next/image` por dominio no permitido).
- Fallo de la API de Google (cuota agotada, sin API key) da un mensaje claro en la UI, no rompe el modal ni el guardado del artículo.

## No incluido en este plan
- Descarga/almacenamiento propio de las imágenes (S3/R2) — explícitamente pospuesto por el usuario.
- Herramienta de revisión masiva dedicada para el backfill — se reutiliza el modal artículo a artículo; si el volumen resulta inviable, se revisa como fase adicional.
- Cambios en exportación (CSV/Excel del listado) para incluir la imagen.

## Preguntas sin resolver
- Cuántos artículos existentes no tienen `imageUrl` hoy (no se pudo consultar la BD en esta sesión: Postgres docker de dev no estaba levantado en :5433, y el de :5432 no tiene las tablas). Afecta el esfuerzo real de la Fase 4.
- ¿El campo `imageUrl` ya tiene fotos de "etiqueta/ficha técnica" cargadas en algún artículo real? Si es así, esos artículos mostrarán esa foto como miniatura del listado tras este cambio (mismo campo, nuevo uso). No es destructivo, pero conviene que el usuario lo sepa antes de aprobar.
