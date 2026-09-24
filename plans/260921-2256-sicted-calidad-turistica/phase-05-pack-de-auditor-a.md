---
phase: 5
title: "Pack de auditoría"
status: pending
priority: P1
effort: "M"
dependencies: [2, 3, 4]
---

# Phase 5: Pack de auditoría

## Overview

Convertir el dato en lo que el evaluador pide ver: **Plan** (manual PDF), **Registros** (cuadrantes mensuales PDF con firmas y observaciones), **calendario y partes de mantenimiento**, y un **panel de cobertura** que responde "¿qué días/tareas no están registrados?" antes de que lo descubra el auditor.

## Requirements

- Funcional: PDFs de Plan por área, cuadrante mensual por plantilla/área, calendario anual y libro de averías; CSV de marcas de un periodo; panel de cobertura por área y periodo.
- No funcional: PDF determinista (mismo dato → mismo contenido), pie con fecha de generación, nº de registros y **huella SHA-256** de los datos incluidos (barata evidencia de integridad; no es hash-chain).

## Architecture

- `sicted-audit-pdf.service.ts` sobre PDFKit siguiendo `etiquetado/services/food-label-pdf.service.ts` (fuentes con acentos, tests de texto: los content streams van comprimidos con Flate y el texto sale en hex WinAnsi por operador `TJ` → reutilizar el helper `pdfText()` de los tests de etiquetas).
- Cuadrante A4 apaisado: filas = ítems, columnas = días 1..31; celda con ✓ / ✗ / vacío + iniciales de quien lo hizo; columna de observaciones; fila inferior con validación del supervisor por día; leyenda. Varias páginas si excede.
- Plan PDF: por área → tabla qué/frecuencia/productos/dosis/EPI/procedimiento/responsable (sale del `snapshot` vigente o de la plantilla actual según parámetro).
- Cobertura: consulta agregada `expected = hojas esperadas por plantilla y periodo` vs `existentes / completadas / validadas`; lista de "días sin hoja" (cron caído o plantilla creada después) y "hojas INCOMPLETE". Solo lectura.
- Endpoints: `GET /sicted/audit/plan.pdf?area=`, `GET /sicted/audit/registros.pdf?templateId|area&month=`, `GET /sicted/audit/mantenimiento.pdf?year=`, `GET /sicted/audit/registros.csv?from&to`, `GET /sicted/audit/coverage?from&to`. ADMIN/OWNER (+ USER lectura si sección lo permite).
- iOS: `window.open` debe ser síncrono dentro del gesto (abrir vacío y luego navegar al blob) al descargar/abrir PDF; mismo patrón que Ficha técnica.

## Related Code Files

- Create: `backend/src/modules/sicted/services/{sicted-audit-pdf.service.ts, sicted-audit-csv.service.ts, sicted-coverage.service.ts}`, controlador `sicted-audit.controller.ts`.
- Create (front): `frontend/src/app/dashboard/sicted/auditoria/page.tsx` (selector de mes/área, botones de descarga, panel de cobertura con huecos accionables → enlace a la hoja).
- Reutilizar: patrón PDF de etiquetas/fichas técnicas.

## Implementation Steps

1. Servicio de cobertura (define la verdad de "esperado"; testear con calendarios semanales/mensuales).
2. PDF de cuadrante mensual (el de mayor valor) + huella.
3. PDF de Plan y de mantenimiento.
4. CSV.
5. Pantalla de auditoría y descargas (iOS-safe).
6. Prueba con un mes real simulado en tenant de prueba; revisar el PDF impreso en A4 (legibilidad de 31 columnas).

## Tests

- Cobertura: mes con 1 día sin cron → aparece como hueco; plantilla creada el día 15 → esperado desde el 15.
- PDF: contiene nombre de plantilla, ítems, iniciales, observación de un "no realizado", nombre del supervisor y huella; mismo input → misma huella.
- Autorización y aislamiento por tenant.

## Success Criteria

- [ ] Un mes completo de una plantilla diaria de 15 ítems cabe en 1–2 páginas A4 apaisado y es legible impreso.
- [ ] El panel lista exactamente los días/hojas sin registro o incompletas del periodo.
- [ ] Descarga funciona en desktop y en iOS Safari.

## Risk Assessment

- *PDF pesado con muchos meses*: limitar a 1 mes por PDF; CSV para volúmenes mayores.
- *Huella ≠ garantía legal*: documentarlo como evidencia de integridad interna, no firma electrónica cualificada. Si el auditor exige firma electrónica, es otro proyecto.
- *Definición de "esperado" ambigua* (festivos/cierre): MVP asume que se genera hoja todos los días; añadir "día de cierre" como excepción explícita solo si el usuario lo pide.
