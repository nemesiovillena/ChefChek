# Fase 1 — Frontend + móvil

## Objetivo
Eliminar el vestigio OCR/IA, mover la subida de albaranes a `/dashboard/albaranes/subir` mobile-first, y limpiar código muerto. Cero riesgo backend.

## Archivos a crear
- `frontend/src/app/dashboard/albaranes/subir/page.tsx` — basado en `dashboard/ingestion/page.tsx`, **mobile-first**:
  - `<input type="file" accept="image/*,.pdf" capture="environment" multiple>` (cámara directa en móvil).
  - Layout táctil: botones grandes, dropzone con `role="button"`, resultados legibles en pantalla pequeña.
  - Reutiliza sin cambios: `useAlbaranUpload` (`POST /v1/albaranes/from-upload`), selector de modelo IA, estado de API key, tarjeta de resultados + importar.
  - Sin referencias a `/dashboard/ingestion` (links de resultado → `/dashboard/albaranes/{id}` y `/dashboard/albaranes`).

## Archivos a modificar
- `frontend/src/app/dashboard/albaranes/page.tsx`
  - L75 y L169: `router.push('/dashboard/ingestion')` → `'/dashboard/albaranes/subir'`.
- `frontend/src/app/dashboard/layout.tsx`
  - Quitar entrada "OCR / IA" (L126-128) e "Ingesta" (L129-131) del dropdown "MÁS".
  - Añadir **Albaranes** al nav móvil inferior (L236-256), que hoy no lo incluye.

## Archivos a eliminar
- `frontend/src/app/dashboard/ingestion/` (carpeta entera, incl. `page.tsx`).
- `frontend/src/app/dashboard/ocr-ai/` (carpeta entera).
- `frontend/src/hooks/use-ocr-analytics.ts` (sólo consumía ocr-ai).
- `frontend/src/hooks/use-ingesta.ts` (muerta, sin consumidor).
- `frontend/src/components/ocr/albaran-upload.tsx` (muerto; si la carpeta `components/ocr/` queda vacía, borrarla).

## Fuera de alcance (no tocar en esta fase)
- `frontend/src/app/dashboard/articulos/components/dashboard-cards/articles-summary-card.tsx` — orphan pero vive en módulo articulos; anotado para limpieza futura.

## Validación
- `bun run lint` + `bun run build` en frontend (o `npm`/`pnpm` según lockfile).
- Smoke manual: abrir `/dashboard/albaranes/subir` en móvil/emulador → cámara → subir → llega a `/albaranes/{id}`.
- Confirmar que `/dashboard/ocr-ai` y `/dashboard/ingestion` dan 404 (rutas borradas).

## Notas de implementación
- Antes de borrar `ingestion/page.tsx`, copiar su lógica a `subir/page.tsx`; NO reimportar nada de `ingestion/`.
- El selector de modelo IA y `getApiKeyForModel` (`@/lib/ai-api-keys`) se mueven intactos.
