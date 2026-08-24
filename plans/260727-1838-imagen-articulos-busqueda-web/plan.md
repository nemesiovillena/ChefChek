# Plan: Imagen de artículo vía búsqueda web (Pexels)

## Status
Implementado (Fases 1-3). Fase 4 (backfill) pendiente de ejecutar por el usuario.

## Cambio de proveedor (2026-07-28)
Se implementó originalmente con Google Custom Search API (ver historial de este archivo), pero
el proyecto de Google Cloud daba `403 PERMISSION_DENIED: This project does not have the access
to Custom Search JSON API` de forma persistente (>13h, tras habilitar la API, reiniciarla,
confirmar facturación y key en el proyecto correcto — causa nunca resuelta, probablemente un
problema de aprovisionamiento del lado de Google). El usuario decidió descartar Google Cloud y
usar **Pexels API** en su lugar: gratis (200 req/hora, 20.000/mes), licencia de uso comercial sin
atribución obligatoria por foto (solo exige un enlace visible "Photos provided by Pexels" en la
app, ya añadido en el picker), y sin la complejidad de habilitación de Google Cloud. El servicio
backend se renombró de `GoogleImageSearchService` a `PexelsImageSearchService`
(`backend/src/modules/products/pexels-image-search.service.ts`); la interfaz `ImageSearchResult`
y el endpoint `GET /products/image-search` no cambiaron.

## Contexto
El modelo `Product` ya tiene `imageUrl: String?` (backend/prisma/schema.prisma:179). Ya existe:
- Endpoint de subida manual `POST /products/upload-image` (backend/src/modules/products/products.controller.ts:186), guarda en `uploads/products/` (efímero en prod, ver `[[backup-module-app-level]]`/nota `/app/uploads efímero`).
- El campo se muestra hoy en `articulo-cards.tsx` (vista tarjetas, sin fallback) y en el diálogo de borrado (`page.tsx:852`, con fallback icono `Tag`).
- El control de subida vive dentro de la pestaña **Alérgenos** del modal (`tab-alergenos.tsx`), etiquetado como "ficha técnica o etiqueta" — no como foto identificativa del artículo.
- El listado denso (`page.tsx:648`) **no muestra imagen** en ninguna columna hoy.
- `next.config.ts` solo permite `lh3.googleusercontent.com` en `images.remotePatterns` → `next/image` no sirve para imágenes de dominios arbitrarios (las que vendrán de la búsqueda web). Hay que usar `<img>` plano, igual que ya hace `page.tsx:854`.

## Decisiones (confirmadas con el usuario)
1. **Alcance**: ambas cosas — (a) construir la función permanente de búsqueda de imagen en la app, y (b) usarla después para rellenar los artículos ya existentes (backfill), sin construir una herramienta masiva aparte por ahora.
2. **Fuente de imágenes**: ~~Google Custom Search API~~ → **Pexels API** (cambio 2026-07-28, ver arriba). Key gratis en pexels.com/api, sin infraestructura de Google Cloud que aprovisionar.
3. **Almacenamiento**: se guarda solo la URL externa (hotlink a Pexels) en `imageUrl`, tal cual. No se descarga ni se sube a storage propio. Riesgo aceptado: si Pexels deja de servir esa imagen en esa URL, el enlace deja de funcionar (mitigado con fallback visual `onError`, no falla la página). Almacenamiento persistente propio queda para más adelante, fuera de este plan — destino ya decidido: **Bunny.net** (ver "No incluido en este plan").
4. **Reutilización de campo**: se reutiliza `imageUrl` (sin migración de esquema). Se reposiciona el control fuera de la pestaña Alérgenos (ver Fase 2) para reflejar que ahora es "foto del artículo", no solo etiqueta.
5. **Tamaño en listado**: miniatura pequeña (32–36px), no la vista de tarjetas grandes que ya existe.
6. **"No imagen"**: se reutiliza el mismo patrón visual que ya existe en `ArticleContextCard` (icono `Tag` de lucide sobre fondo `surface-container-highest`), consistente con la preferencia ya expresada por el usuario de iconos reales sobre emojis (`[[allergen-icons-project-standard]]`).

## Fases
1. [Backend: integración de búsqueda de imagen](phase-01-google-image-search-backend.md) (Pexels; el archivo conserva el nombre histórico)
2. [Frontend: selector de imagen reutilizable](phase-02-frontend-image-picker.md)
3. [Listado: miniatura + fallback + fix hotlink](phase-03-listing-thumbnail-and-fallback.md)
4. [Backfill de artículos existentes](phase-04-backfill-existing-articles.md)

## Dependencias
- Fase 2 depende de Fase 1 (endpoint de búsqueda).
- Fase 3 es independiente de 1/2 (solo toca render), pero conviene hacerla junto a la 2 para no dejar el listado sin miniatura mientras se prueba.
- Fase 4 depende de 1+2+3 en producción/local funcionando.

## Requisito externo (lo hizo el usuario)
Generar una API key gratuita en https://www.pexels.com/api/ (`PEXELS_API_KEY` en `.env`). Cuota gratis: 200 consultas/hora, 20.000/mes.

## Criterios de aceptación
- Al editar/crear un artículo, un botón "Buscar imagen en internet" muestra varias miniaturas candidatas; al elegir una se guarda su URL en `imageUrl`.
- Si no se elige ninguna (o se quita la imagen), el artículo queda sin `imageUrl` y en todos los sitios donde se muestra aparece el placeholder "No imagen" (icono `Tag`), nunca un icono roto.
- El listado denso de artículos muestra una miniatura pequeña (~32px) junto al nombre, sin romper el layout de la tabla.
- Imágenes de dominios externos arbitrarios se renderizan correctamente (sin error de `next/image` por dominio no permitido).
- Fallo de la API de Pexels (límite agotado, sin API key) da un mensaje claro en la UI, no rompe el modal ni el guardado del artículo.

## No incluido en este plan
- Descarga/almacenamiento propio de las imágenes — explícitamente pospuesto por el usuario. Destino decidido para cuando se aborde: **Bunny.net** (pendiente de configurar), no S3/R2 genérico. Cuando se implemente: descargar la imagen elegida del picker, subirla a Bunny.net, y guardar esa URL propia en `imageUrl` en vez del hotlink a Pexels (evita depender de que Pexels seguirá sirviendo esa imagen en esa URL indefinidamente).
- ~~Herramienta de revisión masiva dedicada~~ → **implementado 2026-07-28** como `POST /products/backfill-images` (`ProductImageBackfillService`, ADMIN-only, tenant-scoped): asigna automáticamente el primer resultado de Pexels a cada artículo activo sin `imageUrl`, sin revisión humana (el usuario pidió explícitamente automatizarlo para no ir uno a uno). Nunca sobrescribe una imagen ya asignada. Procesa por lotes (`limit`, por defecto 40, máx 100) para no arriesgar timeout; se puede llamar varias veces hasta que `remaining` sea 0.
- Cambios en exportación (CSV/Excel del listado) para incluir la imagen.

## Preguntas sin resolver
- Cuántos artículos existentes no tienen `imageUrl` hoy (no se pudo consultar la BD en esta sesión: Postgres docker de dev no estaba levantado en :5433, y el de :5432 no tiene las tablas). Afecta el esfuerzo real de la Fase 4.
- ¿El campo `imageUrl` ya tiene fotos de "etiqueta/ficha técnica" cargadas en algún artículo real? Si es así, esos artículos mostrarán esa foto como miniatura del listado tras este cambio (mismo campo, nuevo uso). No es destructivo, pero conviene que el usuario lo sepa antes de aprobar.
