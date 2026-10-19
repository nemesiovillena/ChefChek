# Fase 2 — Agregación y exportación (servidor)

## Archivos
- nuevo `backend/src/modules/cuiner/cuiner-sales-report.service.ts` (+ spec)
- nuevo `backend/src/modules/cuiner/cuiner-sales-report-export.service.ts` (exceljs, CSV, pdfkit; patrón de `check-in/services/report-export.service.ts`)
- `cuiner.controller.ts`: `GET reports/sales?from&to&groupBy=day|week|month|year&familyLevel=1|2|3&format=json|xlsx|csv|pdf` con `@Roles(ADMIN, OWNER, SUPERADMIN)`

## Reglas
- Fecha = fecha de caja (`fecha`), semana ISO lunes-domingo, zona Europe/Madrid.
- Excluir anuladas. Invitaciones: unidades en columna aparte, importe 0.
- Menús: importe en la línea M; platos del menú suman unidades, no euros.
- Familia: `split('-')` por nivel; sin familia → «Sin familia».
- SQL agregado (`$queryRaw` con date_trunc) — no traer líneas sueltas.

## Tests
- Agrupación día/semana/mes/año con fechas frontera (domingo→lunes, 31/12→1/1).
- Niveles de familia y «Sin familia».
- Totales = suma de filas.

## Resultado (2026-10-19)
- `GET cuiner/reports/sales` (JSON) y `GET cuiner/reports/sales/export?format=xlsx|csv|pdf` (descarga, `@Res`), ambos `@Roles(ADMIN, OWNER, SUPERADMIN)`.
- SQL agrega por periodo + plato (excluye anuladas; rango sobre índice tenantId+fecha); familias por nivel, filtro de familia y % en TS (`cuiner-sales-report-grouping.ts`).
- Por días máximo 400 días (si no, 400).
- Respuesta incluye `missingAmounts` (líneas sin euros) e `history {done, oldestDate}` para la pantalla.
- Exportador: CSV «;» + BOM + coma decimal; Excel con formato €/% y cabecera fija; PDF A4 apaisado. Mismas filas que pantalla (detalle, subtotal por periodo si hay varios, TOTAL).
- Verificado contra BD dev (solo lectura): día/semana/mes/total suman lo mismo (1.204,63 ud); dev sin euros ni familias hasta desplegar conector.
- Jest Cuiner 88/88.
