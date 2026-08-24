---
phase: 2
title: Tests y validación manual
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 2: Tests y validación manual

## Overview

Cobertura jest para la lógica de fusión multi-archivo añadida en fase 1, siguiendo el patrón de mocks ya existente en `albaranes.service.spec.ts` (bloque `describe("createFromUpload", ...)`, línea ~626), más una verificación manual end-to-end con un documento real de 2 hojas.

## Requirements

- Los 5 tests `createFromUpload` ya existentes deben seguir pasando **sin modificarlos** — es la prueba de que el caso de 1 archivo no cambió.
- Los tests nuevos cubren: fusión con éxito total, "primer valor no vacío gana" en campos de cabecera, fallo parcial (aviso en notas, no fallback vacío), y fallo total (fallback vacío, sin regresión).
- Verificación manual real (no solo unitaria) subiendo 2 imágenes desde la UI.

## Architecture

Mismo patrón de test ya usado en el archivo (mocks manuales de `prisma`, `pythonOcrService`, `supplierMatching`, etc. — ver líneas 16-77 del spec). No se introduce ningún framework ni patrón nuevo.

## Related Code Files

- Modify: `backend/src/modules/albaranes/albaranes.service.spec.ts` (extender el `describe("createFromUpload", ...)` existente, línea ~626 en adelante).

## Implementation Steps

1. **Test — fusión con éxito total**: mockear `pythonOcrService.processImage` con `mockResolvedValueOnce` dos veces (documento A con producto "Tomate", documento B con producto "Cebolla"), llamar `service.createFromUpload([file(), file()], "t1")`, y comprobar que `prisma.albaran.create` recibió `data.lines.create` con AMBOS productos, en orden (Tomate antes que Cebolla).
2. **Test — "primer valor no vacío gana" en cabecera**: documento A sin `supplier_name` pero con `document_date`; documento B con `supplier_name: "Proveedor B"` pero sin `document_date`. Comprobar que `supplierMatching.matchSupplier` se llamó con `name: "Proveedor B"` (lo toma del segundo porque el primero no lo tenía) y que `prisma.albaran.create` recibió la `date` del primer documento.
3. **Test — fallo parcial**: `processImage` con `mockResolvedValueOnce` (éxito, 1 producto) seguido de `mockResolvedValueOnce({ success: false, error: "boom" })` (o `mockRejectedValueOnce`). Comprobar que `prisma.albaran.create` SE LLAMA (no se cae al fallback vacío), que `data.lines.create` solo tiene el producto del archivo que sí funcionó, y que `data.notes` contiene una mención del archivo fallido / "boom".
4. **Test — fallo total (no regresión)**: dos archivos, ambas llamadas a `processImage` fallan. Comprobar que `data.albaranNumber` empieza por `FALLBACK-`, igual que el test ya existente de un solo archivo fallido (línea ~704).
5. **Regresión**: ejecutar el spec completo y confirmar que los 5 tests `createFromUpload` preexistentes (líneas 634-726 aprox.) siguen en verde sin haber tocado sus expectativas.
6. Ejecutar `cd backend && bun run test -- albaranes.service.spec` (jest — no usar `bun test`, ver memoria `backend-tests-use-jest-not-bun-test`) y confirmar que todo el archivo pasa en verde.
7. **Validación manual real**: rebuild + relanzar el backend (`:3001` corre en modo `dist`, no watch — memoria `backend-dist-mode-not-watch`), confirmar que el microservicio OCR (`:8000`) está arriba (memoria: arranque manual, separado), y desde `/dashboard/albaranes/subir` subir 2 fotos reales (idealmente las 2 hojas de un albarán de papel real, o 2 imágenes de prueba con productos distintos si no hay una a mano). Confirmar en la pestaña "Líneas" del albarán resultante que aparecen productos de ambas imágenes.

## Success Criteria

- [ ] Los 5 tests `createFromUpload` preexistentes pasan sin modificaciones.
- [ ] 4 tests nuevos añadidos y en verde (fusión total, cabecera-primer-valor-gana, fallo parcial con aviso, fallo total sin regresión).
- [ ] `bun run test -- albaranes.service.spec` en verde.
- [ ] Verificación manual: álbaran creado desde 2 imágenes reales contiene líneas de ambas.

## Risk Assessment

Ninguno más allá del de fase 1 — esta fase es puramente de verificación, no introduce cambios de comportamiento.
