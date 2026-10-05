---
phase: 5
title: "Informes legales y panel de gerencia"
status: pending
priority: P1
effort: "16-20h"
dependencies: [3, 4]
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

- [ ] PDF de registro de jornada completo y legible, con correcciones identificadas
- [ ] Export de un centro entero en una acción
- [ ] Enlace de inspección funciona sin sesión, caduca y deja rastro
- [ ] La verificación detecta una alteración manual
- [ ] Informe de un mes de hace 4 años en < 1 min
- [ ] Dar de baja a un empleado no altera sus informes históricos
- [ ] Oleada 1 lista para uso real

## Risk Assessment

- Formato oficial del RD aún inexistente → capa de export aislada.
- Enlace público expone datos personales → token largo, caducidad corta por defecto, revocable, solo lectura, auditado.
- Volumen en 4 años → índices de la Fase 2 y consulta por rango.
