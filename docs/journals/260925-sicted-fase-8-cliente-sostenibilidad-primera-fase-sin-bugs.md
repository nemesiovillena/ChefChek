# SICTED fase 8: Cliente y sostenibilidad — la primera fase sin bugs propios

**Fecha**: 2026-09-25 22:10
**Severity**: Baja (sin hallazgos reales; solo un ajuste esperado de fixture de test)
**Componente**: `backend/src/modules/sicted/{services/sicted-feedback,services/sicted-satisfaction,services/sicted-lost-item,sicted-clientes.controller}.ts`, `backend/src/modules/checklists/constants/checklist-starter-templates.constant.ts`, `frontend/src/app/dashboard/sicted/{clientes/**,components/sicted-cliente-*}.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-8` (sobre `develop`, con fases 1-7 ya fusionadas)

## Qué pasó

Fase 8 de 10: bloque Cliente y sostenibilidad. Tres piezas de evidencia nuevas — quejas/sugerencias/felicitaciones (con hitos de respuesta y cierre, umbral de SLA configurable), satisfacción (muestras 1-5 con resumen mensual y tendencia), objetos perdidos (formulario simple confirmado contra el documento real de Warynessy, sin la opción "descartado" que el diseño anterior había inventado) — y una pieza que no necesitó tabla nueva en absoluto: sostenibilidad, que reutiliza el `kind: "SUSTAINABILITY"` que ya existía en el motor de checklist compartido desde la fase 2. Sembrar tres plantillas de ejemplo (residuos, ahorro de agua/energía, producto local) fue toda la implementación que hizo falta para ese criterio de éxito.

## La verdad brutal

**Por primera vez en las ocho fases de este plan, no hay un bug propio real que reportar.** Las siete fases anteriores encontraron al menos un fallo genuino cada una (bugs de autorización, de agregación, de renderizado de PDF, de límites de fecha, de datos filtrados entre proveedores, de metadata de `class-validator`...). Esta salió limpia: build, lint, los 9 tests e2e nuevos y la verificación completa en navegador (ciclo de queja recepción→respuesta→cierre, muestra de satisfacción con media visible al instante, objeto perdido marcado como devuelto, y las 3 plantillas de sostenibilidad apareciendo en el editor de Plan y 2 de ellas en "Hoy" sin tocar el motor) pasaron a la primera.

La explicación más probable, no una casualidad: esta fase no introduce ningún mecanismo nuevo. Reutiliza exactamente los mismos patrones ya golpeados y corregidos en fases anteriores — hitos "solo null→valor" con `forbid_milestone_rewrite` (fases 4, 6, 7), append-only puro con `forbid_mutation` (todo el módulo desde fase 1), `Configuration` por tenant para un umbral configurable (mismo patrón que el umbral de caducidad de `etiquetado`), y el motor de checklist compartido sin ningún cambio de esquema. Cuando el único "hallazgo" del pase es que un test propio intentó un `UPDATE` directo sobre una tabla append-only y el propio trigger lo rechazó correctamente en el primer intento — eso no es un bug, es el sistema de inalterabilidad funcionando exactamente como se diseñó; se corrigió el fixture (usar el escape `SET LOCAL chefchek.allow_evidence_purge='on'`, igual que el resto de la suite), no el código de producción.

## Detalles técnicos

- 134 suites/2020 tests unitarios backend (sin cambios) + 19 suites/127 tests e2e backend (9 nuevos: hitos de feedback no reescribibles, responder dos veces rechazado por la capa de aplicación, `overdue()` detecta quejas que superan el SLA de 72h, una queja respondida no aparece en `overdue()`, muestra de satisfacción no reescribible, resumen mensual con media y tendencia correctos, hitos de objeto perdido no reescribibles, marcar devuelto dos veces rechazado, aislamiento de tenant en los 3 modelos) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/clientes`, 3 pestañas: Quejas y sugerencias, Satisfacción, Objetos perdidos).
- Verificación en navegador contra un tenant de prueba desechable: los tres flujos completos de extremo a extremo, más la confirmación explícita del criterio "sostenibilidad usable desde Hoy sin código nuevo" — cargadas las plantillas de ejemplo desde el editor de Plan existente (sin botón nuevo), dos de las tres plantillas (`DAILY`) apareciendo automáticamente en la pantalla "Hoy".
- `git diff --stat` contra `appcc` sin salida.
- Tenant de prueba desechable creado/borrado en la BD de dev vía script — nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Alcance diferido

Implementation Step 7 (incluir libro de quejas con tiempos de respuesta, resumen de satisfacción y registro de objetos perdidos en el pack de auditoría de fase 5) no se implementó — ninguno de los 3 criterios de éxito de la fase lo exige explícitamente, mismo criterio de alcance ya aplicado en fase 7.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Fases 9-10 pendientes; fase 9 es la siguiente según el plan.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-8`.
