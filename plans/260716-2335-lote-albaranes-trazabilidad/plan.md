---
title: "Lote en artículos de albarán → base para trazabilidad APPCC/recetas/etiquetas"
description: "Modelo Lot (aditivo) + wiring en flujo OCR y manual de albaranes + fix de extracción de lote en el microservicio OCR + UI de lote en líneas de albarán"
status: done
priority: P2
effort: "~1 sesión"
branch: develop
tags: [backend, frontend, prisma, ocr, albaranes, trazabilidad]
created: 2026-07-16
---

# Plan: Lote en artículos de albarán → base para trazabilidad APPCC/recetas/etiquetas

## Estado
**Implementado y verificado (2026-07-17).** 7 fases completas. Code review: 2 críticos + 1 alto encontrados y arreglados (spec sin mock de `LotService`; emparejamiento posicional inseguro en `manual-albaran.service.ts` reescrito a creación de línea con id directo). Testing independiente: 95 test suites / 1488 tests backend en verde, typecheck frontend limpio, sin regresiones en el radio de impacto (products, almacenes, compras, recipes).

Nota: `backend/src/modules/recipes/recipes.service.ts` y su spec aparecieron modificados en el working tree durante la ejecución — confirmado que es trabajo ajeno de otra sesión, no forma parte de este plan y no se ha tocado ni incluido en el commit de este plan.

## Contexto
Ver scouting completo: `../reports/scout-260716-2335-albaran-lote-trazabilidad-report.md`

Resumen: el campo `lot` (número de lote) ya existe en `AlbaranLine` y `Product` desde la migración inicial, y en los DTOs/servicios del flujo OCR y del prompt de IA — pero se pierde en el camino en dos puntos concretos, y no hay ningún modelo de stock por lote (necesario para trazabilidad real: qué lote hay en almacén, qué lote se consumió en qué preparación, qué lote imprimir en una etiqueta).

## Decisiones de producto (confirmadas con el usuario, 2026-07-16)
1. **Alcance: modelo de datos completo ahora**, no solo propagación superficial. Se crea un modelo `Lot` propio (aditivo, sin tocar la unicidad de `Stock`) para que APPCC/recetas/etiquetas puedan construirse más adelante sin re-migrar.
2. **Ambos flujos de entrada de mercancía** (escaneo OCR y alta manual desde `dashboard/compras`) deben capturar y propagar el lote.
3. **Fuera de alcance en este plan**: consumo/decremento de lote por receta, impresión de etiquetas, e integración con el módulo APPCC existente (`GoodsReception`) — esos módulos aún no están construidos; este plan solo deja la base de datos y la captura correctas para que se apoyen en `Lot` cuando se construyan (YAGNI).

## Diseño de datos
Modelo nuevo `Lot`, 100% aditivo (sin columnas `NOT NULL` nuevas en tablas existentes, sin romper `Stock.@@unique([productId, warehouseId])`):
- Un registro `Lot` por línea de albarán con `lot` no vacío (granularidad = evento de recepción, no acumulado por número de lote — más simple y con mejor trazabilidad de origen).
- `StockMovement.lotId` opcional, enlaza el movimiento de entrada al lote recibido.
- `Product.lot` (ya existente) se sigue actualizando como "último lote conocido" — conveniencia de visualización, no autoritativo.

## Fases
| Fase | Nombre | Depende de |
|------|--------|------------|
| 00 | Fundación: schema Prisma (`Lot`, `StockMovement.lotId`) | — |
| 01 | Backend: `LotService` compartido | 00 |
| 02 | Backend: wiring flujo OCR/confirmación (`AlbaranStockService`) | 01 |
| 03 | Backend: wiring flujo manual (`ManualAlbaranService` + DTO) | 01 |
| 04 | OCR microservice: fix bug de extracción de lote | — (independiente) |
| 05 | Frontend: UI línea de albarán OCR/PENDIENTE | 02 |
| 06 | Frontend: UI albarán manual | 03 |

Fases 02/03 pueden ejecutarse en paralelo entre sí (ficheros distintos, ambas dependen solo de 01). Fase 04 es independiente (repo/proceso distinto — microservicio Python). Fases 05/06 en paralelo entre sí tras sus respectivas fases backend.

## Criterios de aceptación
- Migración Prisma aplicada sin pérdida de datos (aditiva, reversible, sin backfill destructivo).
- Al confirmar un albarán (flujo OCR) con líneas que tienen `lot`, se crea un registro `Lot` vinculado a `AlbaranLine`, `Product` y el `StockMovement` de entrada.
- Al dar de alta un albarán manual con líneas que tienen `lot`, mismo resultado.
- El microservicio OCR devuelve `lot` (y `article_number`, `vat_percent`, `price_with_vat`) en la respuesta de extracción IA — verificado con un albarán de prueba.
- La UI de líneas de albarán permite ver y editar el lote en ambos flujos (edición de línea existente + alta manual de línea + alta de albarán 100% manual).
- Tests unitarios existentes (`albaran-stock.service.spec.ts`, `manual-albaran.service` si tiene spec) siguen en verde; se añaden casos para `lot`.

## Riesgos
- Migración toca tablas con datos reales en producción (`stock_movements`) — mitigado siendo 100% aditiva (columna nullable, sin default forzado, sin rename/drop).
- Doble creación de código entre flujo OCR y manual — mitigado con `LotService` compartido dentro del mismo módulo Nest (`AlbaranesModule`), evita duplicar lógica (DRY).

## Preguntas sin resolver
- ¿`Lot.expiryDate` (caducidad) se captura ahora manualmente en la UI, o se deja solo como columna reservada en el schema para cuando el OCR/APPCC lo necesite? (el prompt de IA actual no extrae caducidad). Quedó sin UI (decisión tomada durante la implementación: no forzar alcance no pedido).
- ¿El módulo `almacenes` (que también crea `Stock`/`StockMovement` fuera del flujo de albaranes) necesita también lote? No se ha tocado en este plan — fuera de alcance salvo que el usuario lo pida.

## Resultado de la ejecución
- Migración `20260716215419_add_lot_traceability` aplicada en dev (brew Postgres :5432, única BD activa en ese momento) — 100% aditiva, verificado por revisión manual del SQL antes de aplicar.
- Hallazgos del code review arreglados: mock de `LotService` en `albaran-stock.service.spec.ts`; `manual-albaran.service.ts` ya no empareja líneas por índice tras un `include` (creaba riesgo de vincular `Lot.albaranLineId` a la línea equivocada) — ahora crea cada `AlbaranLine` individualmente y captura su id real.
- Añadido `lot.service.spec.ts` (no exigido por el plan original, sugerido por el reviewer).
- Testing: `npx jest src/modules/albaranes` (8 suites/113 tests) y suite completa backend (95 suites/1488 tests) en verde; `tsc --noEmit` limpio en backend y frontend.
