# SICTED fase 3: registros diarios y editor de Plan UI, con dos bugs reales cazados solo por probar en el navegador

**Fecha**: 2026-09-25 13:35
**Severity**: Media (dos bugs de UI/agregación reales, corregidos antes de commit; sin dato de producción afectado)
**Componente**: `frontend/src/app/dashboard/sicted/**` (nuevo), `frontend/src/hooks/use-sicted.ts`, `frontend/src/lib/sicted-types.ts`, `backend/src/modules/checklists/services/checklist-run.service.ts`
**Estado**: Commit `9a09b75` en `feat/sicted-fase-3-editor-plan` (sobre `develop`, con fases 1-2 ya fusionadas), sin push

## Qué pasó

Fase 3 de 10: la primera pantalla de verdad de SICTED. Hub con progreso por área, "Hoy" (marcar apertura/cierre/limpieza), editor de Plan (crear/editar/archivar plantillas), matriz mensual de registros para detectar huecos, detalle solo lectura de hoja. El checklist se adapta a los 3 modos del motor de fase 2 (EXECUTION/INSPECTION/MEASUREMENT) con el mismo componente.

Fases 1 y 2 ya estaban fusionadas a `develop` (PRs #166 y #167, fusionadas esta sesión), así que esta fase arrancó limpia sobre `develop` en vez de apilada sobre una rama sin fusionar.

## La verdad brutal

**`tsc`, `eslint` y `next build` pasaron limpios a la primera. Ninguno de los tres encontró los dos bugs reales.** Los encontré porque, en vez de dar la fase por terminada con el build verde, monté un tenant de prueba desechable (`sicted-browser-test`, creado y borrado en la propia BD de dev vía script — nunca toqué el tenant real de Warynessy) y probé el flujo completo en Chrome de verdad: login, sembrar plantillas, marcar una hoja EXECUTION, corregir una marca, marcar y validar una hoja INSPECTION completa.

1. **El progreso "X/Y" mentía tras una corrección.** Lo implementé con `_count: {entries: true}` de Prisma — cuenta filas de `checklist_entries`, no ítems distintos. Como una corrección añade una fila nueva sin añadir un ítem nuevo (el histórico se conserva, ver fase 2), en cuanto corregí una marca el hub pasó a mostrar "3/9" con solo 2 ítems realmente marcados. Nadie que solo mirara el código o el tipo TypeScript lo habría visto — el bug es semántico, no de tipos. Lo arreglé cambiando el backend a un `groupBy` por `(runId, itemId)` (ítems distintos de verdad) y le añadí un test de regresión específico que falla contra la implementación vieja.

2. **El motivo desaparecía en cuanto se guardaba.** Marqué "No realizado" con el motivo "Sin tiempo antes del servicio", guardé, y el motivo simplemente no se veía en ningún sitio — ni en la marca vigente ni en el histórico. Es exactamente la evidencia que un auditor SICTED viene a buscar ("lo que no está registrado, no se ha hecho" — pero aquí SÍ estaba registrado, solo que la UI no lo mostraba). Lo vi porque miré la pantalla después de guardar, no porque un test lo señalara.

Un tercer hallazgo, más de UX que de bug: tras validar una hoja INSPECTION, el botón "Corregir" seguía ahí aunque el backend ya rechaza cualquier marca sobre una hoja supervisada (409). Lo oculté también en cliente en vez de dejar que el usuario lo descubriera con un error.

## Detalles técnicos

- 133 suites/2011 tests unitarios backend + 11 suites/67 tests e2e backend (incluido el test de regresión nuevo) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint` limpios; `next build` genera las 5 rutas nuevas (`/dashboard/sicted`, `/hoy`, `/plan`, `/registros`, `/registros/[runId]`) sin errores.
- Verificación en navegador cubrió: siembra de plantillas de ejemplo, EXECUTION con motivo obligatorio, corrección con histórico visible, INSPECTION completo (10/10 → Guardar → Validar → diálogo `useConfirm()` M3 con el texto exacto del plan → hoja bloqueada), matriz mensual con datos reales, modo claro y oscuro.
- Tenant de prueba: creado y borrado con el mismo patrón transaccional (`SET LOCAL chefchek.allow_evidence_purge`) que usan los tests e2e contra tablas de evidencia reales. Recuento de tenants/usuarios verificado idéntico antes/después (9/10) — cero impacto en datos reales.
- Componentes divididos por debajo de 200 líneas (`sicted-checklist-mode-controls.tsx` separado de `sicted-checklist-item-row.tsx` cuando el primero pasó de 200).

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Documentos reales adicionales del "Plan de limpieza y desinfección" prometidos por el usuario siguen sin llegar; las 3 plantillas iniciales sembradas son representativas, no exhaustivas.
- Fases 4-10 pendientes; fase 4 es la siguiente (activos/mantenimiento/incidencias, según el plan).
- Sin push ni PR todavía — commit local en `feat/sicted-fase-3-editor-plan`, a la espera del usuario.
