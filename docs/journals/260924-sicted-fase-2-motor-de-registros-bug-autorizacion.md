# SICTED fase 2: motor de registros backend, con un bug de autorización propio cazado por el test HTTP

**Fecha**: 2026-09-24 23:20
**Severity**: Media (bug de autorización real, corregido antes de commit; sin dato de producción afectado — fase apilada, sin fusionar)
**Componente**: `modules/checklists` (nuevo dominio), `modules/sicted/sicted-checklist.controller.ts`, `prisma/schema.prisma`
**Estado**: Commit `1a79537` en `feat/sicted-fase-2-motor-registros` (apilada sobre `feat/sicted-fase-1-fundamentos`, sin fusionar), sin push

## Qué pasó

Fase 2 de 10 del plan SICTED: el dominio real del motor de checklist compartido — Plantilla (el Plan) → Hoja por periodo (el Registro) → Marca append-only (la evidencia), sobre los triggers de inalterabilidad que fase 1 dejó listos. Tres modos sobre el mismo esqueleto (EXECUTION/INSPECTION/MEASUREMENT), confirmados contra los documentos reales de Warynessy, no inventados. `SictedChecklistController` expone la fachada; el dominio vive en `ChecklistsModule`, neutro, para que un futuro `appcc` lo comparta sin duplicar filas.

## La verdad brutal

**El test HTTP de extremo a extremo cazó un bug de autorización real que los tests a nivel de servicio no podían ver.** Cinco rutas (`GET runs/today`, `GET runs`, `GET runs/:id`, `POST runs/:id/entries`, `GET performers`) no tenían `@Roles` en el controlador — sin decorador, `RolesGuard` deja pasar a cualquier rol autenticado. Resultado: un usuario VIEWER podía marcar checklists y ver todas las hojas, violando tanto la tabla de la API del propio plan ("USER+") como el criterio de aceptación explícito ("VIEWER no marca"). El primer intento del test esperaba 403 para VIEWER y recibió 400 — porque el placeholder de `itemId` fallaba la validación del DTO antes de que la falta de guard se notara; al corregir el test para usar un `itemId` real del snapshot, salió 200 en vez de 403, confirmando el hueco. Arreglado con `@Roles("USER")` en las 5 rutas — la jerarquía de roles del proyecto (`SUPERADMIN > OWNER > ADMIN > USER > VIEWER`) ya deja pasar a todo lo que esté por encima de USER sin tener que listarlos.

Esto es exactamente la clase de bug que `checklist-engine.e2e-spec.ts` (llama a los servicios directamente, sin pasar por HTTP) no podía atrapar — los guards viven en el controlador, no en el servicio. Confirma que valía la pena escribir el test HTTP completo aunque el motor ya estuviera probado a nivel de servicio.

Segundo hallazgo, menor: `seedStarter` devolvía la plantilla sin `items` en el camino de "ya sembrada para este módulo" / "añadir módulo a una ya existente" — inconsistente con `create`/`update`, que sí los incluyen. Corregido con el mismo `include`.

## Detalles técnicos

- 133 suites / 2011 tests unitarios backend sin regresiones; 11 suites e2e (66 tests) contra `chefchek_test` real, incluida la nueva `sicted-checklist-controller.e2e-spec.ts` (login real, `Authorization: Bearer`, los 5 guards en cadena).
- `tsc --noEmit` limpio.
- Criterio "backup+restore sin 42703" verificado por lectura de código, no solo por inferencia: `buildScopeClause` resuelve el scope consultando `information_schema.columns` en tiempo real (no una lista estática `CHILD_SCOPE_RULES`), y las 4 tablas `checklist_*` tienen `tenantId` propio → caen en la rama directa, sin necesitar entrada en esa lista. El mecanismo de escape `SET LOCAL` ya se probó en fase 1 contra una tabla con el mismo prefijo/forma.
- `git diff --stat` confirmado sin tocar nada de `appcc/**`.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario, no solo de esta fase.
- Fase 2 apilada sobre fase 1 sin fusionar todavía — el orden de fusión a `develop` tiene que respetar esa dependencia (o adoptarse como PRs apilados).
- Fases 3-10 pendientes; fase 3 es la siguiente (editor de Plan / frontend de plantillas).
- El usuario prometió más documentos reales del "Plan de limpieza y desinfección" — las 3 plantillas iniciales sembradas son un conjunto representativo, no exhaustivo, a la espera de esos documentos (fase 3 los incorporará).
