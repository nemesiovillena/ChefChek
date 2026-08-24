---
title: 'Fix: subida de albarán multi-hoja pierde páginas 2+ silenciosamente'
description: >-
  createFromUpload solo procesa files[0]; el resto de archivos subidos (p.ej. la
  2ª hoja de un albarán de papel) se descartan sin aviso. Se fusionan los
  resultados OCR de todos los archivos en un único Albarán.
status: completed
priority: P2
branch: main
tags:
  - albaranes
  - ocr
  - bugfix
  - backend
blockedBy: []
blocks: []
created: '2026-08-06T16:16:09.493Z'
createdBy: 'ck:plan'
source: skill
---

# Fix: subida de albarán multi-hoja pierde páginas 2+ silenciosamente

## Overview

La pantalla de subida de albaranes permite seleccionar varias imágenes (input `multiple`, hasta 10), pensado para documentos de papel de varias hojas. El backend las recibe todas correctamente pero `AlbaranesService.createFromUpload` solo procesa `files[0]` — el resto se descarta en silencio, sin error ni aviso. Si un albarán llega en 2 hojas, los productos de la hoja 2 desaparecen sin que nadie se entere.

Fix acotado al backend: procesar todos los archivos vía OCR y fusionar sus resultados (productos concatenados, metadatos de cabecera del primer documento con datos, con aviso explícito si algún archivo falla) en un único Albarán, antes de continuar con el pipeline existente (match de proveedor, refine por layout hints, creación del albarán) sin tocarlo.

## Contexto

- Reportado por el usuario en conversación de consulta (`/ask`) sobre el flujo de recepción de pedidos: "hay pedidos que vienen en dos hojas, ¿subo las dos imágenes? ¿no habrá problema?".
- Confirmado leyendo el código (no es una hipótesis):
  - `frontend/src/app/dashboard/albaranes/subir/page.tsx` + `frontend/src/hooks/use-albaran-upload.ts`: UI ya soporta selección múltiple (`multiple`, `MAX_FILES = 10`), todas se mandan en un único `FormData` bajo la clave `'file'`.
  - `backend/src/modules/albaranes/albaranes.controller.ts:70-97`: `FilesInterceptor("file", 10, ...)` recibe correctamente el array de hasta 10 archivos.
  - **Bug**: `backend/src/modules/albaranes/albaranes.service.ts:402` — `const file = files[0];`. Solo esa imagen se manda a `PythonOcrService.processImage()` (que solo acepta un buffer). El resto de `files[1..n]` nunca se usan. Sin error, sin log de aviso al usuario.
  - `PythonOcrService.processImage()` (`backend/src/modules/ocr/python-ocr.service.ts:170-259`) solo acepta un archivo por llamada — no hay endpoint multi-página en el microservicio Python. El fix se hace fusionando resultados en el backend NestJS, sin tocar el microservicio.
- Alcance explícitamente excluido: el rework del módulo `production` (`plans/260805-1923-production-module-rework/`, no relacionado) y cualquier otra área de compras/albaranes tratada en la misma conversación de origen (revertir pedidos, vincular pedido↔albarán, facturas) — todo eso ya funciona, no es parte de este bug.
- Sin solapamiento real con otros planes de `plans/`: `260728-1425-ocr-config-server-side` toca el mismo método (`createFromUpload`) pero solo para resolver `aiModel`/`aiApiKey` — cambio compatible, no bloqueante.

## Decisión de diseño (no reabrir sin nueva evidencia)

**"Fusionar primero, procesar una vez"**: se llama a `pythonOcrService.processImage()` una vez por archivo (secuencial, no paralelo — el microservicio ya tiene timeouts largos de 120s/request y es un proceso único; procesar en paralelo no aporta nada para el caso típico de 2 archivos y añade complejidad sin necesidad — YAGNI), se recogen los documentos OCR exitosos, y se fusionan en UN solo objeto `document` antes de entrar al pipeline existente (match de proveedor, enrich, refine por layout hints, creación del albarán) — ese pipeline no se toca, solo pasa a operar sobre el documento fusionado en vez del de un único archivo.

Reglas de fusión:
- `products`: concatenación de los `products` de cada archivo exitoso, en el orden de subida (se asume que el usuario fotografía/selecciona las hojas en orden — limitación conocida, no se valida el orden).
- Campos de cabecera (`supplier_name`, `supplier_cif`, `document_number`, `document_date`, `gross_amount`, `tax_base`, `vat_total`, `vat_breakdown`, `total_amount`, etc.): "primer valor no vacío gana", recorriendo los documentos exitosos en orden de subida — no se asume que la cabecera esté siempre en la hoja 1.
- `confidence`: media de los documentos exitosos.
- `raw_text`: concatenado con separador, para que el refine por layout hints siga viendo todo el texto.
- Si ALGÚN archivo falla el OCR pero al menos uno tiene éxito: se crea el albarán igualmente con lo que se pudo extraer, y se añade un aviso explícito en `notes` (no volver a caer en el mismo patrón de pérdida silenciosa que es el bug original).
- Si TODOS los archivos fallan: mismo comportamiento de hoy (albarán `FALLBACK-` vacío con notas de error) — no regresión.
- Caso de un solo archivo (el 99% del uso actual): el resultado debe ser idéntico byte a byte al comportamiento actual — es el criterio de aceptación más importante de todo el plan.

## Fases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend: fusionar OCR multi-archivo](./phase-01-backend-fusionar-ocr-multi-archivo.md) | Completed |
| 2 | [Tests y validación manual](./phase-02-tests-y-validaci-n-manual.md) | Completed |

## Dependencias

Secuencial: fase 2 depende de fase 1 terminada. Sin dependencias cruzadas con otros planes (verificado en el escaneo de `plans/` — ver Contexto).

## Riesgo principal

Bajo. Cambio contenido en un único método de un servicio backend (`AlbaranesService.createFromUpload`), sin migración de schema ni cambios de infraestructura. El único riesgo real es romper sutilmente el caso de un solo archivo (el uso normal hoy) — cubierto explícitamente por el criterio de aceptación de "idéntico al comportamiento actual" y por los tests de regresión de fase 2 (los 5 tests `createFromUpload` ya existentes deben seguir pasando sin modificarlos). Rollback trivial: `git revert` del commit, sin datos ni migraciones involucradas.

## Criterios de aceptación (global)

- Subir 2 imágenes donde ambas se procesan bien → el albarán resultante tiene las líneas de las dos imágenes, en orden de subida.
- Subir 2 imágenes donde una falla el OCR → el albarán se crea igualmente con lo que se pudo extraer de la que sí funcionó, y sus notas mencionan el fallo parcial.
- Subir 2 imágenes donde ambas fallan → mismo comportamiento `FALLBACK-` que hoy con un solo archivo fallido.
- Subir 1 imagen (caso normal actual) → comportamiento idéntico al de antes del fix.
- `bun run test -- albaranes.service.spec` en verde (jest, no `bun test` — ver memoria `backend-tests-use-jest-not-bun-test`).

## Preguntas sin resolver
- Ninguna — alcance y diseño confirmados con el usuario en la conversación de origen antes de planificar.
