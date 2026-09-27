---
phase: 6
title: "Proveedores y aprovisionamiento"
status: completed
priority: P2
effort: "S"
dependencies: [1]
---

# Phase 6: Proveedores y aprovisionamiento

## Overview

Cubre el módulo `PROV` (Relación con los Proveedores) del manual real. **Corrección de diseño**: la primera versión de esta fase inventaba una "evaluación de proveedores 1-5" que el manual **no pide**. Lo que pide, práctica por práctica — **revisado 2026-09-24** contra los formularios reales de Warynessy (`Prov.1.For_Relación de proveedores.doc`, `Prov.6.Doc_Directrices recepción pedidos.doc`, `Prov.7.For_Inventario.doc`, `Prov.7.For_Relación de stocks mínimos.doc`, `incidencias_proveedores.docx`):

| Práctica | Qué pide | Cómo se cubre |
|---|---|---|
| `PROV.1` ficha de proveedor: nombre/contacto/RSI **+ categorías de artículos suministrados, unidades de servicio, fichas de seguridad Sí/No, registro industrial Sí/No, fichas técnicas Sí/No, certificación de calidad, si se le entregaron las normas internas** | — | Nombre/contacto/RSI: **evidencia** (`Supplier`, con `sanitaryRegistry`). Los campos de cumplimiento que `Supplier` no tiene: **tabla nueva** `SictedSupplierComplianceProfile` (no se toca `Supplier`). |
| `PROV.2` criterios de selección (recomendable) | Documento | Protocolo con acuse (motor de fase 7), **no** un registro. |
| `PROV.3` incidencias: el formulario real es de **recepción** — fecha, proveedor, nº de albarán, ¿transporte correcto?, temperatura del producto, causa de rechazo, firma | Registro | **Nuevo**, pequeño, append-only, con enlace opcional al albarán. |
| `PROV.4` compras formalizadas (factura/albarán) | — | **Evidencia**: ya lo hace `albaranes`. |
| `PROV.5` horario de recepción comunicado (recomendable) | — | Protocolo (fase 7) si el tenant lo quiere documentar. |
| `PROV.6` directrices de recepción (temperatura, caducidad, etiquetado, registro sanitario) | Documento | Protocolo (fase 7); el control real ya lo hacen OCR+`Lot`+etiquetado — **evidencia**. |
| `PROV.7` stock mínimo/máximo + inventario semestral (el formulario real es **semestral**, no anual: "PROV.7 INVENTARIO SEMESTRAL", producto/stock real/stock mínimo/stock máximo) | — / Registro | Mínimo y máximo **ya existen** (`Stock.minimumStock`/`Stock.maximumStock`) y stock real es `Stock.quantity` — **evidencia**, sin reintroducir los datos a mano. El inventario es una **foto+firma** de `Stock` en una fecha, no un formulario de líneas nuevo. |
| `PROV.8` FIFO / rotación por caducidad | — | **Evidencia**: ya lo hace `Lot` + caducidades. |

Solo `PROV.1` (perfil de cumplimiento), `PROV.3` (incidencias de recepción) y `PROV.7` (sello de inventario) necesitan modelo nuevo, y los tres son pequeños. Todo lo demás es protocolo documental (fase 7) o evidencia de solo lectura.

## Requirements

- Funcional: perfil de cumplimiento por proveedor (fichas de seguridad/registro industrial/fichas técnicas/certificación/normas entregadas); registrar incidencia de recepción (proveedor, albarán opcional, transporte correcto, temperatura, causa de rechazo); sellar un inventario semestral (snapshot firmado de `Stock` en una fecha, no reintroducción manual); panel de evidencia de aprovisionamiento (recepciones confirmadas, lotes con caducidad, etiquetas emitidas, stock bajo mínimo/sobre máximo).
- No funcional: **cero escrituras** en `albaranes`, `etiquetado`, `almacenes`, `proveedores`; dependencia de módulo `proveedores` (añadir a `dependencies` del registro).

## Architecture

```
SictedSupplierComplianceProfile id, tenantId, supplierId (único por tenant+proveedor), suppliedCategories String[]
                                (p.ej. "Perecederos", "Congelados", "Limpieza"...), serviceUnits String[],
                                hasSafetyDataSheets(YES|NO|UNKNOWN), hasIndustrialRegistry(YES|NO|UNKNOWN),
                                hasTechnicalSheets(YES|NO|UNKNOWN), qualityCertification?, internalRulesGivenAt?,
                                firstContactAt?, updatedByName, updatedAt
SictedSupplierIncident         id, tenantId, supplierId, supplierName (snapshot), albaranId? (referencia opcional,
                               solo lectura), occurredAt, transportOk(bool)?, productTemperature?, rejectionCause?,
                               description, reportedByName, resolution?, resolvedAt?  -- SOLO INSERT (resolution: solo null→valor)
SictedInventorySnapshot         id, tenantId, performedAt, performedByName, scope? (área/almacén), itemCount,
                                belowMinimumCount, aboveMaximumCount, snapshotData Json (copia de
                                productId/quantity/minimumStock/maximumStock en ese instante, para el PDF de fase 5),
                                notes?                                                -- SOLO INSERT
```

`SictedSupplierComplianceProfile` **no** es append-only (es un perfil, se actualiza); el resto sí. Evidencia adicional (solo lectura, sin tablas nuevas): recepciones del periodo (`albaranes`), lotes con caducidad próxima (`Lot`, mismo dato que alimenta `/dashboard/appcc/caducidades`, cuyo `moduleId` real es `etiquetado`), etiquetas emitidas (`FoodLabel`), artículos bajo `minimumStock` o sobre `maximumStock` (`Stock`).

## Related Code Files

- Create: modelos + migración + triggers (fase 1); `backend/src/modules/sicted/services/{sicted-supplier-compliance.service.ts, sicted-supplier-incident.service.ts, sicted-inventory-snapshot.service.ts, sicted-procurement-evidence.service.ts}`, controladores/DTOs.
- Create (front): `frontend/src/app/dashboard/sicted/proveedores/page.tsx` (pestañas Perfil de cumplimiento / Incidencias / Inventario / Evidencia).
- Modify: `registry.ts` (dependencia `proveedores`), `sicted.module.ts`.
- Solo lectura sobre: `modules/albaranes`, `modules/etiquetado`, `modules/almacenes`, `modules/proveedores`.

## Implementation Steps

1. Modelos + trigger forbid (con la variante "solo null→valor" para `resolution`) + migración.
2. Servicio de perfil de cumplimiento (upsert por proveedor, no append-only).
3. Servicio de incidencias de recepción (con `albaranId` opcional validado contra el tenant).
4. Servicio de inventario: genera el snapshot leyendo `Stock` en el momento, no formulario de líneas manual.
5. Servicio de evidencia; verificar los agregados contra un tenant de prueba antes de confiar en los números.
6. UI: ficha de proveedor con pestaña de cumplimiento, alta de incidencia (con selector de albarán reciente), botón "Generar inventario" (snapshot+firma), panel de evidencia con enlace a la pantalla origen.
7. Marcar `PROV.1` (datos base)/`PROV.4`/`PROV.7` (stock mín/máx)/`PROV.8` como prácticas cubiertas automáticamente por evidencia en el catálogo de fase 9 (sin acción del usuario); `PROV.1` (cumplimiento) y `PROV.3` se cubren cuando el tenant rellena el perfil/registra incidencias.
8. Incluir en el pack de auditoría (fase 5): libro de incidencias de recepción y último inventario semestral con su desglose.

## Tests

- Incidencia: `resolution` no reescribible una vez puesta; snapshot de nombre de proveedor persiste si el proveedor se archiva; `albaranId` de otro tenant rechazado.
- Perfil de cumplimiento: upsert idempotente, no append-only (a diferencia del resto del módulo).
- Inventario: snapshot refleja `Stock` real en el momento de generarlo, no se recalcula después aunque `Stock` cambie (evidencia histórica); semestral no forzado (solo el manual lo recomienda).
- Evidencia: agregados = consulta manual sobre fixtures; aislamiento tenant.

## Success Criteria

- [x] Cada proveedor activo muestra su perfil de cumplimiento y su última incidencia de recepción (si la hay). Verificado en navegador: tarjeta de proveedor con "Perfil actualizado por…" y "Última incidencia: abierta · fecha".
- [x] Un inventario generado queda como evidencia permanente e inmutable, con el desglose bajo-mínimo/sobre-máximo del momento. Verificado: trigger `forbid_mutation` bloquea `UPDATE`/`DELETE` (test e2e); snapshot congelado aunque `Stock` cambie después (test e2e + navegador).
- [x] Evidencia de aprovisionamiento del mes visible en un clic y exportable (panel, no descarga — el manual solo pide visibilidad; no hay práctica que exija un PDF/CSV de este panel). Verificado en navegador con datos sembrados: 4 agregados correctos.
- [x] `git diff` no toca los módulos leídos. Confirmado con `git diff --stat -- backend/src/modules/albaranes backend/src/modules/etiquetado backend/src/modules/almacenes backend/src/modules/proveedores` (sin salida).

## Risk Assessment

- *Confundir "evaluación de calidad" con "incidencia"*: por eso se eliminó el modelo de evaluación inventado; solo se construye lo que el manual pide.
- *Datos de evidencia inexactos* (p. ej. albaranes sin lote): mostrar "n de m con lote", no un % que oculte huecos.
- *Rollback*: migración aditiva; sin acoplamiento de escritura a otros módulos.
