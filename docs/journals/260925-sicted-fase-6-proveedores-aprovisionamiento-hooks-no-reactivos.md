# SICTED fase 6: proveedores y aprovisionamiento, con dos bugs en un selector que "parecía" funcionar

**Fecha**: 2026-09-25 19:35
**Severity**: Media (datos de otro proveedor expuestos en un desplegable antes del primer fix; ningún dato de producción afectado)
**Componente**: `backend/src/modules/sicted/{services/sicted-supplier-compliance,services/sicted-supplier-incident,services/sicted-inventory-snapshot,services/sicted-procurement-evidence,sicted-suppliers.controller}.ts`, `frontend/src/app/dashboard/sicted/{proveedores/**,components/sicted-suppliers-*}.tsx`
**Estado**: Commit `b9aeceb` en `feat/sicted-fase-6` (sobre `develop`, con fases 1-5 ya fusionadas), sin push

## Qué pasó

Fase 6 de 10: módulo `PROV` (Relación con los Proveedores). La primera versión de este plan (escrita antes de leer los formularios reales de Warynessy) inventaba una "evaluación de proveedores 1-5" que el manual SICTED no pide — corregido en el propio plan antes de implementar. Lo que sí pide: ficha de cumplimiento por proveedor (fichas de seguridad, registro industrial, fichas técnicas, certificación — campos que `Supplier` no tiene), incidencias de recepción (formulario real: proveedor, albarán, ¿transporte correcto?, temperatura, causa de rechazo), y un inventario semestral que no es más que una foto+firma de `Stock` en un instante, no un formulario de líneas a mano. Todo lo demás (compras formalizadas, FIFO, directrices de recepción) ya lo hace Chefchek — aquí solo se muestra como evidencia de solo lectura, sin escribir nada en `albaranes`/`etiquetado`/`almacenes`/`proveedores`.

Tres tablas nuevas, deliberadamente sin relación Prisma a `Supplier`/`Albaran` (mismo patrón de desacoplo de todo el módulo): `SictedSupplierComplianceProfile` (la única que **no** es append-only — es un perfil, se actualiza), `SictedSupplierIncident` (append-only, `resolution`/`resolvedAt` solo null→valor, reutilizando el `forbid_milestone_rewrite` genérico de fase 4), `SictedInventorySnapshot` (append-only puro).

## La verdad brutal

**Dos bugs propios en el mismo componente, y el segundo es el más instructivo de las seis fases hasta ahora: un selector que parecía funcionar por completo — valor correcto en el DOM, petición HTTP con 200 y los datos correctos — pero cuya lista de opciones nunca se actualizaba.**

1. **El primer intento de "desactivar" una consulta antes de elegir proveedor exponía datos de todos los proveedores.** El selector de "albarán reciente" del formulario de incidencia usaba `useAlbaranes({ supplierId } o { limit: 0 })` para no traer nada mientras no hubiera proveedor elegido. Pero `listAlbaranes` construye la query con `if (filters.limit) params.append(...)` — `0` es falso en JS, así que el parámetro nunca se enviaba, la API caía a su límite por defecto (20) y el desplegable (deshabilitado visualmente, pero con datos ya cargados) listaba los últimos 20 albaranes del tenant **de cualquier proveedor**, no ninguno. Arreglado con un `supplierId` centinela inexistente en vez de `limit: 0`.
2. **El arreglo anterior reveló uno más de fondo al verificarlo en el navegador.** Tras elegir un proveedor real, el desplegable de "albarán reciente" se quedaba vacío para siempre — pero no por falta de datos: `read_network_requests` confirmó una petición `GET /api/v1/albaranes?supplierId=...&limit=10` con `200` y el albarán correcto en el cuerpo. El problema estaba en `useAlbaranes` mismo: guarda su filtro en un `useState(initialFilters)` que React solo lee en el **montaje** del componente — llamar al hook de nuevo en cada render con un `supplierId` distinto (justo el patrón que usé, esperando que se comportara como un `useQuery` con `queryKey` reactivo) no actualiza nada, porque `useState` ignora su argumento después del primer render. `useAlbaranes` está diseñado para pantallas de listado con sus propios `setFilters`/`setPage`, no como hook prop-driven. Sustituido por un `useQuery` + `listAlbaranes` directos, con `queryKey: ['albaranes', 'sicted-incident-picker', form.supplierId]` — ese sí reacciona.

Ninguno de los dos bugs rompía `tsc`, `eslint` ni el build. El primero tampoco rompía nada visible salvo mirar el contenido real de un desplegable deshabilitado. El segundo ni siquiera se veía en el DOM (`<select>` mostraba el `value` correcto porque yo mismo lo forcé al probar) — solo se detectó comparando "la API devolvió lo correcto" contra "la UI no lo refleja", que es justo el tipo de discrepancia que ninguna herramienta estática atrapa.

## Detalles técnicos

- 134 suites/2020 tests unitarios backend (sin cambios) + 17 suites/110 tests e2e backend (7 nuevos: upsert idempotente de cumplimiento — a diferencia del resto del módulo, que es append-only; `resolution` no reescribible; snapshot de nombre de proveedor persiste tras archivar el proveedor; `albaranId` de otro tenant rechazado; snapshot de inventario congelado aunque `Stock` cambie después; snapshot append-only; evidencia = consulta manual sobre fixtures con aislamiento de tenant) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (ruta nueva `/dashboard/sicted/proveedores`, 4 pestañas: Perfil de cumplimiento, Incidencias, Inventario, Evidencia).
- Verificación en navegador contra un tenant de prueba desechable (proveedor + artículo con stock bajo mínimo + albarán confirmado con lote sembrados a propósito): upsert de perfil con tristate+certificación, alta de incidencia con selector de albarán reciente (los dos bugs de arriba se encontraron aquí), resolución de incidencia, generación de inventario con desglose bajo-mínimo correcto, panel de evidencia con los 4 agregados coincidiendo con los datos sembrados.
- `git diff --stat` contra `albaranes`/`etiquetado`/`almacenes`/`proveedores` sin salida — confirmado el criterio de éxito "cero escrituras".
- Tenant de prueba desechable creado/borrado en la BD de dev vía script — nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Fases 7-10 pendientes; fase 7 es la siguiente según el plan.
- Sin push ni PR todavía — commit local en `feat/sicted-fase-6`, a la espera del usuario.
