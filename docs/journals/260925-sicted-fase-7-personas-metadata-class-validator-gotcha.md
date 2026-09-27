# SICTED fase 7: Personas, con un `Date` que "no existía" para el validador

**Fecha**: 2026-09-25 21:15
**Severity**: Media (una acción formativa no se podía crear en absoluto hasta el fix; sin dato de producción afectado)
**Componente**: `backend/src/modules/sicted/{services/sicted-job-profile,services/sicted-training,services/sicted-protocol,sicted-personas.controller,dto/sicted-training}.ts`, `frontend/src/app/dashboard/sicted/{personas/**,components/sicted-personas-*}.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-7` (sobre `develop`, con fases 1-6 ya fusionadas)

## Qué pasó

Fase 7 de 10: bloque Personas del manual — fichas de puesto (tareas y responsabilidades exactas), plan anual de formación (con los 4 temas mínimos: atención al cliente, idiomas, sostenibilidad, alérgenos) y protocolos con acuse versionado (imagen/higiene personal, bienvenida, etc.). Tres modelos nuevos, solo uno de ellos (`SictedJobProfile`) editable — el resto de la fase es append-only: asistencia registrada y acuses de protocolo son evidencia permanente.

El diseño de "acuse versionado" es el corazón de la fase: `SictedProtocol.version` solo sube cuando se publica contenido nuevo (`publishVersion`), nunca al editar metadatos (`updateMeta`) — así una corrección de fecha de revisión no obliga a todo el equipo a volver a leer y firmar. Publicar contenido nuevo sí invalida los acuses de la versión anterior, sin borrarlos (quedan como evidencia histórica de qué se acusó y cuándo).

## La verdad brutal

**Dos bugs, y el segundo es un recordatorio de que "compila y pasa `tsc`" no significa "el validador del framework lo va a aceptar en runtime".**

1. **Encontrado razonando, no en el navegador**: el registro de asistencia en lote necesitaba ser idempotente ("reenviar el mismo lote no debe fallar", para que un doble-tap en la tablet no rompa nada). Mi primer instinto fue un `upsert` de Prisma — pero un `upsert` en Postgres se traduce a `INSERT ... ON CONFLICT DO UPDATE`, y la tabla de asistencia lleva el trigger `forbid_mutation` que bloquea cualquier `UPDATE`. Si hubiera probado esto en el navegador primero, el segundo envío del mismo lote habría fallado con un error de Postgres. Lo até antes de escribir el test: `createMany` + `skipDuplicates` en su lugar, que solo genera `DO NOTHING` — nunca toca el trigger.
2. **Encontrado en el navegador, invisible para todo lo demás**: crear una acción formativa fallaba con `Error: property plannedDate should not exist`. La causa: `CreateTrainingActionDto.plannedDate` llevaba `@Type(() => Date)` (class-transformer, para convertir el string del body a `Date`) pero ningún decorador de `class-validator`. El `ValidationPipe` global del proyecto usa `whitelist: true` + `forbidNonWhitelisted: true`, y esas dos opciones deciden qué propiedades "existen" leyendo la metadata que **class-validator** registra — no la de class-transformer. Una propiedad con solo `@Type()` es invisible para el whitelist, así que se trataba como "no debería existir" y la petición entera se rechazaba. Ni `tsc --noEmit` ni `eslint` lo detectan: el campo es sintácticamente correcto, TypeScript ve un `Date` válido; el problema es puramente de qué metadata queda registrada en tiempo de ejecución. Arreglado añadiendo `@IsDate()` junto a `@Type(() => Date)` — el mismo patrón que ya llevaban correctamente los campos `Date` de fase 6 (`sicted-protocol.dto.ts`, `sicted-supplier-compliance.dto.ts`), que sí revisé como referencia antes de escribir esta fase pero aun así se me escapó en el DTO nuevo.

## Detalles técnicos

- 134 suites/2020 tests unitarios backend (sin cambios) + 18 suites/118 tests e2e backend (8 nuevos, incluida una regresión explícita para "reenviar el mismo lote de asistencia es un no-op seguro (no dispara el trigger)") sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/personas`, 3 pestañas).
- Verificación en navegador contra un tenant de prueba desechable con un OWNER y un USER sembrados: ficha de puesto → asignar persona (cierra la asignación anterior de esa persona automáticamente) → plan de formación 2026 → acción de alérgenos → marcar hecha (cobertura pasó de "Pendiente" a "Cubierto" en tiempo real) → asistencia en lote → protocolo → acusar (matriz reflejó el ✓) → publicar nueva versión (el protocolo volvió a "Mis pendientes" y la matriz volvió a "—" para todos, exactamente el comportamiento diseñado).
- `git diff --stat` contra `appcc` sin salida — módulo intacto, como exige el criterio de aceptación global del plan.
- Tenant de prueba desechable creado/borrado en la BD de dev vía script — nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Alcance diferido

El paso de implementación 5 (exportables al pack de auditoría: PDF de fichas de puesto, plan formativo con asistencia, matriz protocolo×empleado) no se hizo en este pase — ninguno de los 3 criterios de éxito de la fase lo exige, y se documentó explícitamente como pendiente en vez de darlo por completo.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Fases 8-10 pendientes; fase 8 es la siguiente según el plan.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-7`.
