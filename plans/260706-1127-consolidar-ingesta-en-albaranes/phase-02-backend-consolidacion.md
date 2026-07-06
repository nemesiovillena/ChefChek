# Fase 2 — Backend: extraer módulo `ocr`, borrar `ingesta`

## Objetivo
Quitar el pipeline `ingesta` paralelo. Mover los 2 servicios que Albaranes realmente usa a un módulo `ocr` compartido, repuntar Albaranes, y eliminar `ingesta` completo (incl. Telegram y cola).

## Precondición
Fase 1 terminada: el frontend ya no llama a `/api/v1/ingesta/*`.

## Crear módulo compartido `backend/src/modules/ocr/`
- `python-ocr.service.ts` (+ `python-ocr.service.spec.ts`) — movido desde `ingesta/`. **Leer antes de mover** para confirmar imports propios (`IOcrService`, tokens `PRIMARY_OCR_SERVICE`/`FALLBACK_OCR_SERVICE`); si importa `services/ocr-service.interface.ts`, mover también esa interface al módulo `ocr` o eliminar el `implements` (YAGNI: sólo queda una implementación).
- `product-recognition.service.ts` (+ spec) — movido desde `ingesta/`. Verificar que no tenga deps internas de `ingesta`.
- `ocr.module.ts` — `@Module({ providers: [PythonOcrService, ProductRecognitionService], exports: [PythonOcrService, ProductRecognitionService] })`.

## Repuntar Albaranes
- `albaranes.service.ts:12` → import desde `'../ocr/python-ocr.service'`.
- `albaranes/services/line-matching.service.ts:3` → import desde `'../../ocr/product-recognition.service'`.
- `albaranes.module.ts:11,18` → sustituir `forwardRef(() => IngestaModule)` por `OcrModule` (rompe la ref circular).
- Specs: `albaranes.service.spec.ts:9` y `line-matching.service.spec.ts:4` → actualizar rutas de import.

## Eliminar `backend/src/modules/ingesta/` completo (21 archivos)
- Controller (18 endpoints: `/document`, `/manual`, `/telegram/*`, `/documents/*`, `/stats`, `/extractions`, `/products-extracted`, `/cost-updates`, `/process-for-stock`).
- `ingesta.service.ts`, `ocr-ai.service.ts`, `telegram-bot.service.ts`, `document-queue.processor.ts`, `services/google-vision.service.ts`, `dto/*`, y todos sus `.spec.ts`.

## Desregistro
- `app.module.ts`: quitar `IngestaModule` de imports (L47, L81) y `IngestaController` de controllers (L103).
- **BullMQ**: si `app.module` registra la cola `document-processing` sólo para ingesta, quitar ese `registerQueue`. Verificar antes (no romper si la cola es global/compartida).

## Validación
- `bun test` backend: specs de `albaranes.service`, `line-matching.service`, `python-ocr.service`, `product-recognition.service` deben compilar y pasar.
- Boot del backend (sin `IngestaModule`, arranca limpio).
- Smoke: `POST /v1/albaranes/from-upload` con una imagen → OCR + líneas + matching OK.
- `grep -r "ingesta\|Ingesta" backend/src` → sólo debe quedar en migraciones/historial git, no en código vivo.

## Riesgos
- Imports colgados tras mover servicios → falla de compilación (detectable en build).
- Cola Bull sin desenchufar → IngestaModule no instancia (irrelevante si se borra el módulo, pero confirmar que nada más la inyecta).
- Rollback: revert del commit de fase 2.

## Addendum — reubicación del alta manual (descubrimiento durante la ejecución)
El modal "Nuevo Albarán" (`use-manual-albaran.ts` + `manual-albaran-form.tsx`, en la propia página de Albaranes) llamaba a `POST /v1/ingesta/manual` (`IngestaService.processManualAlbaran`). NO era un repunte trivial: ese endpoint, además de crear productos y mover stock, **creaba un `Albaran`** y un `Document` ingesta. Repuntar a `POST /v1/albaranes` (create simple) habría cambiado la semántica (pérdida de auto-creación de productos y entrada inmediata de stock).

Decisión: **reubicar** `processManualAlbaran` al módulo albaranes:
- Nuevo `modules/albaranes/services/manual-albaran.service.ts` (+ `dto/manual-albaran.dto.ts`) con la misma lógica de productos + albarán (REVISADO) + stock.
- Se **eliminó** la creación del `Document` ingesta (sólo lo consumía el dashboard OCR, ya borrado). El `reason` del movimiento conserva `albaran.id` → idempotencia con `AlbaranStockService` intacta.
- Nuevo endpoint `POST /v1/albaranes/manual` en `AlbaranesController`.
- Frontend repuntado: `/v1/ingesta/manual` → `/v1/albaranes/manual`.
- Especificaciones: añadido mock de `ManualAlbaranService` en `albaranes.controller.spec.ts`.

## Resultado de validación
- `nest build` (tsc): OK.
- `jest` completo: 76 suites / 1309 tests OK.
- `grep ingesta backend/src`: sólo comentarios documentales.
