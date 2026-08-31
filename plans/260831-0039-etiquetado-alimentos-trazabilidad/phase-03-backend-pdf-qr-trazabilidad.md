---
phase: 3
title: Backend PDF+QR+trazabilidad
status: completed
priority: P2
effort: ~1 sesión
dependencies:
  - 2
---

# Phase 3: Backend PDF + QR + trazabilidad

## Overview

Render de la etiqueta a PDF con pdfkit en 3 presets (térmica 57 mm, térmica 100 mm, A4 rejilla) con QR embebido y endpoint de PDF. El endpoint de trazabilidad por `qrToken` se define en la fase 2 (controller público); aquí solo se ajusta la URL que codifica el QR.

<!-- Updated: Validation Session 1 - QR apunta a ruta pública /e/{qrToken}; qrcode ya es dependencia -->
**Validación 2026-08-31:** `qrcode ^1.5.4` y `pdfkit ^0.18.0` **ya son dependencias** — no se añade nada a `package.json`. El QR codifica la ruta **pública** del frontend (`/e/{qrToken}`), no una ruta bajo `/dashboard`.

## Requirements

- Funcional:
  - `GET /api/v1/etiquetado/labels/:id/pdf?format=thermal-57|thermal-100|a4&copies=N` → `application/pdf` (autenticado, sección `etiquetado.emit`).
  - Layout con: nombre, lote grande + legible, fecha elaboración/manipulación, consumo preferente (destacado), condición de conservación + rango °C, alérgenos, responsable (iniciales o nombre — en el PDF impreso en cocina sí puede ir el nombre), cantidad/raciones, (ELABORATED) lista compacta de ingredientes con lote, (HANDLED) proveedor + lote proveedor + caducidad fabricante, nombre del establecimiento, QR.
  - QR codifica `${FRONTEND_URL}/e/${qrToken}` (ruta pública del frontend, fuera de `/dashboard`).
  - Al generar PDF de una etiqueta ya existente (no en el alta), `reprintCount++` (param `reprint=1`).
- No funcional: reutilizar patrón de `technical-sheets.service.ts` (pdfkit, streaming a `Res`). QR vía módulo `qr` existente o `qrcode` npm si el módulo no expone generación de buffer reutilizable.

## Architecture

### `services/food-label-pdf.service.ts`

- `LABEL_PRESETS`: constante con medidas en puntos (mm × 2.8346). Decisión de medidas (usuario, 2026-08-31):
  - `thermal-57x40`: 57×40 mm, 1 etiqueta/página. **Preset principal** (QR ~18 mm + todos los campos).
  - `thermal-57x32`: 57×32 mm, 1 etiqueta/página. Compacto: omite/trunca la lista de ingredientes.
  - `a4-70x37`: A4, rejilla `{ cols: 3, rows: 8, labelW: 70, labelH: 37, ... }` (Apli 3×8, 24/hoja).
  - `a4-63x38`: A4, rejilla `{ cols: 3, rows: 7, labelW: 63.5, labelH: 38.1, ... }` (Apli 3×7, 21/hoja).
  - (Se descarta el `thermal-100` del plan original: es tamaño de etiqueta de envío.)
  - Márgenes/gutters de las rejillas A4 en constantes, ajustables con un PDF real sin tocar lógica.
- `renderLabel(doc, label, box)`: dibuja una etiqueta dentro de un rectángulo `box` (reutilizable por los 3 presets). Tipografía: lote y consumo preferente en negrita grande; resto en cuerpo pequeño. Sin dependencia de assets salvo, si hace falta, iconos de alérgeno (`technical-sheets/assets/allergens` ya existe — reutilizar si caben).
- `generate(label, format, copies)`:
  - `thermal-*`: `copies` páginas, cada una `renderLabel` a página completa.
  - `a4`: pagina la rejilla, repite `copies` veces la misma etiqueta.
- QR: `buildTraceUrl(qrToken)` (usa `${FRONTEND_URL}/e/${qrToken}`) + `qrcode.toBuffer(url, { margin: 0, errorCorrectionLevel: 'M' })` → `doc.image(...)`. Tamaño mínimo 18 mm en térmica 57.

### `FRONTEND_URL`

- Config existente (revisar `configuration-guide.md` / env). Si no hay una var canónica, añadir `FRONTEND_PUBLIC_URL` a config y documentarla. Debe ser la URL pública del frontend (la que abre un móvil externo).

### Controller (añadir a `etiquetado.controller.ts`, autenticado)

| Método | Ruta | Sección |
|---|---|---|
| `GET` | `/api/v1/etiquetado/labels/:id/pdf` | `etiquetado.emit` |

(El endpoint público `GET /api/v1/etiquetado/public/trace/:qrToken` vive en `etiquetado-public.controller.ts` — definido en la fase 2, sin guards.)

- `pdf`: `res.setHeader('Content-Type','application/pdf')`, `Content-Disposition: inline; filename="etiqueta-<lotNumber>.pdf"`. Llama `markReprinted` **solo** si la petición no forma parte del alta (flag `?firstPrint=1` omitido en re-impresiones, o distinguir por `Referer`/param explícito `reprint=1`). Simplest: param `reprint=1` que el frontend envía desde la vista de detalle.

## Related Code Files

- Create: `backend/src/modules/etiquetado/services/food-label-pdf.service.ts`
- Create: `backend/src/modules/etiquetado/constants/label-presets.ts`
- Modify: `backend/src/modules/etiquetado/etiquetado.controller.ts` / `etiquetado.module.ts`
- (`backend/package.json` sin cambios — `qrcode ^1.5.4` y `pdfkit ^0.18.0` ya presentes)
- Reference: `backend/src/modules/technical-sheets/technical-sheets.service.ts` (pdfkit streaming)
- Reference: `backend/src/modules/qr/qr.service.ts`
- Create: `food-label-pdf.service.spec.ts` (smoke: buffer no vacío, cabecera `%PDF`, nº de páginas por `copies`)

## Implementation Steps

1. Confirmar con el usuario medidas de etiqueta térmica y stock A4 (bloqueante para medidas exactas; se puede empezar con placeholders).
2. `label-presets.ts` con las 3 configuraciones.
3. `food-label-pdf.service.ts`: `renderLabel` + los 3 modos (`qrcode` ya disponible).
4. Endpoint `pdf` (autenticado) + `buildTraceUrl`.
5. `FRONTEND_URL` en config + `configuration-guide.md`.
7. Spec smoke + `npx jest src/modules/etiquetado` verde.
8. Revisión visual con `/ck:preview` sobre PDFs reales de *Jarrete* y *Lubina*.

## Success Criteria

- [ ] `GET /labels/:id/pdf?format=thermal-57` → PDF 1 página, QR escaneable que abre la ruta de trazabilidad.
- [ ] `format=a4&copies=6` → A4 con 6 etiquetas idénticas en rejilla.
- [ ] `format=thermal-100` → PDF ancho 100 mm.
- [ ] `reprint=1` incrementa `reprintCount`; alta inicial no.
- [ ] El QR del PDF apunta a `${FRONTEND_URL}/e/{qrToken}` y es escaneable a tamaño térmico 57.
- [ ] Spec smoke verde; sin regresiones en suite backend.

## Risk Assessment

- Medidas térmicas dependientes de hardware → presets parametrizados + confirmación previa; márgenes en constantes.
- QR ilegible si va muy pequeño en térmica 57 → tamaño mínimo 18 mm, `errorCorrectionLevel: 'M'`, quiet zone.
- pdfkit no hace layout automático → `renderLabel` con posiciones absolutas dentro del `box`; truncado de texto largo con elipsis.
