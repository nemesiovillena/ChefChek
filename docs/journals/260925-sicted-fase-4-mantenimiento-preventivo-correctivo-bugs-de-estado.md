# SICTED fase 4: mantenimiento preventivo y correctivo, con dos bugs de estado cazados en navegador

**Fecha**: 2026-09-25 14:15
**Severity**: Media (dos bugs reales de estado/notificaciones, corregidos antes de commit; sin dato de producción afectado)
**Componente**: `backend/src/modules/checklists` (equipos/planes/registros/incidencias, nuevo), `backend/src/modules/sicted/sicted-maintenance.controller.ts`, `backend/src/common/bunny`, `frontend/src/app/dashboard/sicted/mantenimiento/**`
**Estado**: Commit `6da5b1a` en `feat/sicted-fase-4-activos-mantenimiento` (sobre `develop`, con fases 1-3 ya fusionadas), sin push

## Qué pasó

Fase 4 de 10: inventario de equipos, calendario de revisiones con certificados adjuntos, y los dos formularios reales de incidencia que la fase 4 del plan había corregido de una revisión anterior — `Ins-Bas.16` (parte de avería simple: a quién se avisa, hitos de servicio técnico) y "PARTE ACCIONES CORRECTIVAS" (PAC: cualquier desviación de proceso/equipo/producto, con causa raíz, medida correctiva y una sección opcional "solo alimentos"). Una sola tabla `ChecklistIncident` con `kind` los distingue.

Novedad técnica: primer trigger de inalterabilidad "por hitos" del proyecto (`forbid_milestone_rewrite`) — a diferencia de `forbid_mutation`/`forbid_mutation_after_seal` de fase 1 (bloquean todo o nada), este permite `UPDATE` en general pero bloquea columna a columna cualquier intento de reescribir un campo de fecha/hora que ya tenga valor, recibiendo los nombres de columna por `TG_ARGV` para ser reutilizable en tablas futuras con el mismo patrón. Verificado en Postgres real con 6 escenarios (poner primera vez, reescribir bloqueado, tocar otro campo, no-op mismo valor, DELETE bloqueado, escape `SET LOCAL`) antes de construir nada encima.

También: primer uso de adjuntos privados tenant-scoped del proyecto — reutiliza la zona Bunny "backups" (sin Pull Zone) en vez de la zona pública de imágenes, con un directorio de fallback local (`private-uploads/`) deliberadamente fuera de `uploads/` para no quedar expuesto por el `useStaticAssets` de dev sin Bunny configurado.

## La verdad brutal

**Otra vez: `tsc`, `eslint`, `next build` y los 12 tests del motor pasaron limpios, y aun así había dos bugs de estado reales que solo aparecieron marcando hitos de verdad en el navegador.**

1. **El `status` (OPEN/NOTIFIED/RESOLVED) de una incidencia nunca avanzaba.** Marqué los 4 hitos de un parte de avería y resolví una PAC completa — la insignia se quedó en "Abierta" todo el tiempo, aunque `resolvedAt` estaba puesto correctamente y la ficha mostraba "Resuelta". El backend siempre aceptó `status` en el PATCH; el frontend simplemente nunca lo mandaba. Nada en los tests lo habría cazado porque ningún test comprobaba el campo `status` tras un update — comprobaban los campos de fecha, que sí funcionaban.
2. **El cron de avisos no miraba si el módulo seguía activo.** Lo encontré releyendo mi propio código al escribir el test del recordatorio (el primero que este servicio tuvo — no existía ninguno hasta este momento), comparándolo con el scheduler de hojas de fase 2, que sí hace esa comprobación. Un tenant que desactivara SICTED seguiría recibiendo campanas de sus equipos de mantenimiento indefinidamente. Corregido con el mismo criterio: solo avisa si al menos un módulo (`sicted`/`appcc`) que usa ese equipo sigue activo para ese tenant.

Ninguno de los dos es un bug de datos ni de seguridad — son de estado visible e higiene de notificaciones — pero ambos habrían llegado a producción sin la verificación en navegador real y, en el caso del cron, sin escribir el test que debí haber escrito desde el principio.

## Detalles técnicos

- 134 suites/2020 tests unitarios backend + 14 suites/90 tests e2e backend (motor de mantenimiento 12 tests, controlador HTTP con adjuntos 7 tests, recordatorio 4 tests) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/mantenimiento` con 3 pestañas en una ruta).
- Verificación en navegador cubrió: siembra de extintores (equipo+plan compartido), registro de revisión con recálculo de `nextDueAt`, avería completa con los 4 hitos (incluida la corrección de status), PAC completa con correlativo "Parte Nº" y resolución, modo claro/oscuro. Adjunto real (subida de PDF) verificado por el test HTTP, no por el navegador (el picker de fichero nativo no es automatizable con las herramientas disponibles).
- Tenant de prueba desechable creado/borrado en la BD de dev vía script — nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Fases 5-10 pendientes; fase 5 es la siguiente según el plan.
- Sin push ni PR todavía — commit local en `feat/sicted-fase-4-activos-mantenimiento`, a la espera del usuario.
