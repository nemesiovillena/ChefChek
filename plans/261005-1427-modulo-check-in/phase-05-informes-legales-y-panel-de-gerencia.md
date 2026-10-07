---
phase: 5
title: Informes legales y panel de gerencia
status: completed
priority: P1
effort: 16-20h
dependencies:
  - 3
  - 4
---

# Phase 5: Informes legales y panel de gerencia

## Overview

Informes exportables para Inspección de Trabajo y para el control interno, enlace de solo lectura para un inspector, verificación de integridad y panel de gerencia. Cierra la Oleada 1.

## Requirements

- Funcional: registro de jornada por empleado y periodo (PDF + CSV/XLSX); resumen de horas extra; export masivo por centro; enlace temporal de solo lectura; panel con indicadores.
- No funcional: cualquier mes de los últimos 4 años en < 1 min; el informe muestra original y correcciones; accesos del enlace auditados.

## Architecture

- `ReportExportService` aislado del cálculo (el formato oficial del futuro RD puede cambiar): toma jornadas ya calculadas y produce PDF (`pdfkit`), CSV y XLSX (`exceljs`).
- Contenido del registro: empresa (CIF de `Tenant`), centro, empleado (nombre, DNI, NAF), periodo; por día: entradas/salidas, pausas, total, origen, correcciones con motivo y autor; totales ordinarias/extra; espacio de conformidad; huella de integridad.
- Verificación de integridad: recorre la cadena de hash del tenant y devuelve la primera discrepancia.
- `InspectionAccessLink`: `tokenHash`, `locationId?`, `from`, `to`, `expiresAt`, `createdByUserId`, `revokedAt`, contador y registro de accesos (`AuditLog`). Ruta pública de solo lectura, con throttling, sin sesión.
- Panel: presencia actual, incidencias y solicitudes pendientes, horas por empleado/centro, horas extra acumuladas, fichajes fuera de zona, pendientes de revisión.
- SQL analítico crudo: filtrar `deletedAt IS NULL` a mano donde aplique.

## Related Code Files

- Create: `backend/src/modules/check-in/reports.controller.ts`, `services/report-export.service.ts`, `services/workday-report-pdf.ts`, `services/integrity-check.service.ts`, `services/inspection-link.service.ts`, `inspection-public.controller.ts`, `dto/`
- Modify: `backend/prisma/schema.prisma` (+ `InspectionAccessLink`), `backend/package.json` (`exceljs`)
- Create: `frontend/src/app/dashboard/check-in/informes/`, `frontend/src/app/inspeccion/[token]/`, widgets del panel en `frontend/src/app/dashboard/check-in/page.tsx`
- Create: `docs/check-in-system-architecture.md`, `docs/check-in-guia-inspeccion.md`

## Implementation Steps

1. Añadir `exceljs` (Excel confirmado por el usuario).
2. PDF del registro de jornada con datos reales de la Fase 4; revisión visual.
3. Export CSV/XLSX y export masivo por centro (ZIP o PDF múltiple).
4. Resumen de horas extra por periodo.
5. Verificación de integridad + test que altera una fila con el escape y la detecta.
6. Enlace de inspección: crear, caducar, revocar, auditar; página pública de solo lectura.
7. Panel de gerencia con recharts (ya instalado).
8. Documentación: arquitectura y guía "qué hacer ante una inspección".
9. Prueba de rendimiento con datos sintéticos (p. ej. 30 empleados × 4 años) en `chefchek_test`.

## Success Criteria

- [x] PDF del registro de jornada: una página por persona, con correcciones identificadas, totales, firmas y huella de integridad (revisado visualmente)
- [x] Excel con tres hojas (registro diario, resumen, correcciones) y CSV con BOM y separador ";" (e2e)
- [x] Export de todo el equipo o de una persona en una acción (e2e)
- [x] Enlace de inspección: funciona sin sesión, limitado a sus meses, caduca, se revoca y cuenta los accesos (e2e + navegador)
- [x] El token no se guarda ni se lista: solo su huella (e2e)
- [x] La verificación de integridad detecta una fila alterada a mano (e2e)
- [x] Solo gerencia, y nunca desde cuenta compartida (e2e)
- [x] Guía "qué hacer ante una inspección" (`docs/check-in-guia-inspeccion.md`)
- [ ] Rendimiento con 4 años de datos (sin probar; los informes son mensuales y usan el índice por empleado y fecha)
- [ ] Panel de gerencia ampliado: se mantiene el existente (presencia, fichajes a revisar, hojas de horas)

## Risk Assessment

- Formato oficial del RD aún inexistente → capa de export aislada.
- Enlace público expone datos personales → token largo, caducidad corta por defecto, revocable, solo lectura, auditado.
- Volumen en 4 años → índices de la Fase 2 y consulta por rango.

## Desviaciones (2026-10-06)

- **Informes por mes natural**, no por rango libre: es la unidad que se aprueba y se firma. Cuatro años son 48 descargas o un enlace de inspección que los cubra.
- **Enlace de inspección por meses** (desde/hasta) y para toda la plantilla; sin filtro por centro ni por persona en la vista pública.
- **Accesos del enlace contados en la propia fila** (`accessCount`, `lastAccessAt`), no en `AuditLog`.
- **Sin panel nuevo**: los indicadores de gerencia ya están repartidos entre Fichar (presencia, a revisar) y Registro de jornada (hojas, solicitudes). No se añadieron gráficas.
- **Sin `docs/check-in-system-architecture.md`**: la arquitectura está descrita en el PDR y en los ficheros de fase.
- Dependencia nueva: `exceljs`.
- Corregido durante la revisión visual: el pie del PDF generaba páginas en blanco.
