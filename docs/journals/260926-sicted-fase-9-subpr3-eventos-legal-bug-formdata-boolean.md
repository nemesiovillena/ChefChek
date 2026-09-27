# SICTED fase 9 (sub-PR 3/4): eventos + documentos legales — FormData rompía un checkbox

**Fecha**: 2026-09-26 03:10
**Severity**: Media (bloqueaba el 100% de la creación de eventos, cazado y corregido antes de fusionar)
**Componente**: `backend/src/modules/sicted/{dto/sicted-event,dto/sicted-compliance-doc,services/sicted-event,services/sicted-compliance-doc,services/sicted-compliance-reminder,sicted-direccion-legal.controller}.ts`, `frontend/src/app/dashboard/sicted/components/sicted-direccion-{events,legal}-tab.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-9-eventos-legal` (sobre `develop`, con sub-PRs 1-2 de fase 9 ya fusionados)

## Qué pasó

Tercer sub-PR de la fase 9: eventos (grupos de mejora, formación del destino, evaluación externa) y documentos legales con caducidad. Dos entidades con perfiles de inmutabilidad opuestos y ambos ya vistos en fases anteriores — `SictedEvent` es evidencia append-only pura (participación registrada una vez, `forbid_mutation`, sin ningún hito que corregir después), `SictedComplianceDoc` es un documento vivo editable (como el catálogo de prácticas o los objetivos anuales) que se renueva subiendo una nueva fecha de caducidad. El aviso automático (cron diario a 30 días y al vencer) es una copia casi literal de `ChecklistMaintenanceReminderService` de fase 4 — mismo patrón `dueSoonAlertedAt`/`overdueAlertedAt` (aquí `expiredAlertedAt`), mismo reseteo al renovar.

## La verdad brutal

**El único bug real de esta fase es el tipo de error que solo aparece al usar la app de verdad, no leyendo el código.** El formulario de "Nuevo evento" incluye un checkbox "Asistió" y un selector de archivo opcional — para poder mandar ambos en la misma petición, el frontend usa `multipart/form-data` (`FormData`). En ese formato TODO viaja como string, incluido un booleano: `"true"`/`"false"`, no `true`/`false` nativos. El DTO tenía `@IsOptional() @IsBoolean() attended?: boolean` sin ninguna transformación previa — `class-validator` recibía el string `"true"` y lo rechazaba sin más: `attended must be a boolean value`. Resultado: **cualquier intento de crear un evento fallaba siempre**, no solo con archivo adjunto, porque el formulario manda `FormData` incondicionalmente (para no bifurcar la lógica según haya archivo o no).

Ni `tsc --noEmit` ni los tests e2e lo habrían atrapado nunca: los tests e2e de este proyecto llaman a los servicios de Nest directamente (`actions.create(tenantId, dto, undefined)`), sin pasar por el pipe de validación HTTP real — es una brecha de cobertura conocida y aceptada en este proyecto (documentada ya en el bug de `plannedDate`/`@IsDate()` de fase 7), y es exactamente la razón por la que la verificación manual en navegador es obligatoria en este plan, no opcional. Se corrigió con un `@Transform` explícito antes de `@IsBoolean()` que solo convierte cuando el valor llega como string (`typeof value === "string" ? value === "true" : value` — deja pasar intacto un booleano nativo si algún día se manda como JSON puro).

Segundo hallazgo, más pequeño y en un test, no en producción: el test `closedAt — hito solo null→valor` de sub-PR 2 (ya fusionado) empezó a fallar de forma intermitente al ejecutar la suite completa varias veces seguidas. Causa: comparaba dos `new Date()` consecutivas sin ninguna operación asíncrona real entre medias — en una máquina rápida (Bun sobre Apple Silicon, sin latencia de red porque el test llama al servicio directamente) ambas pueden caer en el mismo milisegundo. El trigger `forbid_milestone_rewrite` compara con `IS DISTINCT FROM`: si el valor "nuevo" es idéntico al viejo, no hay reescritura real, así que correctamente no lanza excepción — el trigger se comportó bien, el test tenía una condición de carrera de precisión de reloj. Corregido forzando `+1000ms` en la segunda fecha del test.

## Detalles técnicos

- `SictedEvent`: append-only (`forbid_mutation`), sin campos editables tras crear — a diferencia de `SictedFeedback`/`SictedLostItem` (que sí tienen hitos null→valor), un evento de participación no tiene ningún ciclo que avanzar.
- `SictedComplianceDoc`: `label` etiqueta libre con `<datalist>` de sugerencias en el frontend (Extintores, OCA Industria, Convenio colectivo...) — no un enum rígido, confirmado explícitamente en el plan porque la taxonomía que el usuario recordaba de memoria de la plataforma SICTED no coincide 1:1 con ningún documento verificado.
- Adjunto privado opcional en ambas entidades: mismo `storePrivateAttachment`/`readPrivateAttachment` (zona Bunny sin Pull Zone o disco local fuera de `uploads/`) ya usado en fase 4 (partes de avería) y fase 7 (certificados de formación).
- Controlador nuevo `SictedDireccionLegalController` en vez de seguir ampliando `sicted-direccion.controller.ts` (ya superaba las ~200 líneas tras sub-PR 2) — dos controladores comparten el mismo prefijo de ruta `api/v1/sicted/direccion` sin colisión; confirmado arrancando el servidor Nest real y viendo el log de `RouterExplorer` con las rutas de ambos registradas sin conflicto.
- 134 suites/2020 tests unitarios backend (sin cambios) + 23 suites/150 tests e2e backend (9 nuevos, sin regresiones tras el fix del test flaky).
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios — 2 pestañas nuevas en `/dashboard/sicted/direccion` (Eventos, Legal).
- Verificación manual en Chrome contra un tenant de prueba desechable (`fase9-subpr3-browser-test`): evento registrado con éxito tras el fix, documento legal creado/renovado (badge "Caducado" correcto para una fecha real ya pasada)/archivado (desaparece del listado activo). Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Alcance diferido

Sub-PR 4 de fase 9 (Informe anual agregado, el último bloque) — pendiente.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Sub-PR 4 (Informe anual) es el siguiente tras fusionar este — cierra la fase 9.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-9-eventos-legal`.
