---
phase: 1
title: "Fundamentos y andamiaje"
status: completed
priority: P1
effort: "S"
dependencies: []
---

# Phase 1: Fundamentos y andamiaje

## Overview

Registrar el módulo `sicted` en toda la infraestructura multi-tenant (registro, sección, nav, guards, backup), crear el módulo neutro `checklists` que alojará el motor compartido con APPCC (fases 2 y 4), y dejar decididas las reglas de inalterabilidad **antes** de escribir dominio. Sin lógica de negocio aún.

**Revisado 2026-09-24**: el motor de checklist (limpieza, mantenimiento, averías, temperatura) es **compartido** entre `sicted` y `appcc` — decisión final del usuario tras valorar el trade-off (ver `plan.md`). Vive en un módulo NestJS propio `checklists`, con tablas `Checklist*` (sin prefijo de módulo), **no** en `sicted`. `sicted` (y, en un futuro plan, `appcc`) lo consumen cada uno con su propio guard/rutas — la independencia de activación es una propiedad de las rutas, no de dónde vive el dato.

## Requirements

- Funcional: módulo `sicted` activable por tenant, oculto por defecto; roles USER/VIEWER restringibles por sección; motor `checklists` sin nav/sección propia (infraestructura interna, siempre disponible a los módulos que lo consumen).
- No funcional: cero cambios en el **código** de `appcc` (no se toca ni se arregla su bug de rutas en este plan); todas las tablas `sicted_*` y `checklist_*` con `tenantId`; migración aditiva.

## Related Code Files

- Modify: `backend/src/modules/modules/constants/registry.ts` (añadir `sicted`, `defaultEnabled: false`, sin dependencias en MVP; fase 6 añade `proveedores`). `checklists` **no** se añade aquí: no es un producto que el tenant activa/desactiva, es infraestructura interna.
- Modify: `backend/src/modules/role-access/constants/section-registry.ts` (sección `sicted`, grupo nuevo "Calidad" o junto a APPCC; **sin** subcapacidades: supervisar se gobierna por rol).
- Modify: `backend/src/app.module.ts` (importar `ChecklistsModule` y `SictedModule`).
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (nuevo grupo `NAV_GROUPS` "Calidad" con enlace SICTED; **no** colgarlo del grupo APPCC para no mezclar conceptos).
- Create: `backend/src/modules/checklists/checklists.module.ts` (motor compartido: servicios de plantilla/hoja/marca de fase 2 y de activo/mantenimiento/incidencia de fase 4; **sin controlador propio** — lo consumen los controladores de `sicted`/`appcc`, cada uno con su `@RequireModule`).
- Create: `backend/src/modules/sicted/sicted.module.ts` (+ controlador vacío con `@Controller("api/v1/sicted")`, `@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard)`, `@RequireModule("sicted")`, `@RequireSection("sicted")`, igual que `appcc.controller.ts:37-41`; importa `ChecklistsModule`).
- Create: `backend/prisma/migrations/<ts>_immutability_guard/migration.sql` (función/trigger genérico, sin prefijo de módulo — se aplica a tablas `checklist_*` de fases 2/4 y a las `sicted_*` propias de fases 6-9).
- Modify: `backend/src/modules/backup/backup.constants.ts` / `backup-restore.service.ts` (excluir `checklist_*`/`sicted_*` del restore por defecto, decisión confirmada).

## Implementation Steps

1. Decisiones ya confirmadas (ver `plan.md`): supervisor = rol ADMIN/OWNER sin flag nuevo; identidad = selector de persona sin PIN; restore excluye `checklist_*`/`sicted_*` por defecto.
2. Añadir `sicted` a `MODULE_REGISTRY` y `SECTION_REGISTRY`; comprobar que `ModulesService` lo lista y que un tenant sin activar recibe 403.
3. Crear `ChecklistsModule` vacío (sin controlador) y `SictedModule` vacío (con controlador) y registrarlos en `AppModule`. Recordar: `AuthGuard` exige importar `AuthModule`; un provider usado en el módulo va también en `exports` si otro módulo lo reutiliza (si no, controladores duplicados).
4. Nav: grupo "Calidad" en `NAV_GROUPS` con `moduleId: 'sicted'`; icono Material Symbols (`verified`), con el guard de FOUC ya usado (width/height 1em).
5. **Guarda de inalterabilidad** (`migration.sql` a mano; `prisma migrate dev` no funciona sin TTY → `migrate diff`):
   - Función `forbid_mutation()` (genérica, sin prefijo) que hace `RAISE EXCEPTION` en UPDATE/DELETE **salvo** si `current_setting('chefchek.allow_evidence_purge', true) = 'on'`. Se adjunta tanto a tablas `checklist_*` como `sicted_*`.
   - Variante `forbid_mutation_after_seal()` para filas con sello (p. ej. hoja supervisada): permite UPDATE solo mientras `supervisedAt IS NULL`.
   - El escape `SET LOCAL chefchek.allow_evidence_purge = 'on'` solo lo activan: purge de tenant (`superadmin.service.ts:50`) y restore confirmado (decisión 4).
6. Backup: como todas las tablas llevan `tenantId`, **no** se añaden `CHILD_SCOPE_RULES`. Verificar con un backup+restore de prueba en `chefchek_test` cuando exista la primera tabla (fase 2). Aplicar decisión 4 (excluir `checklist_*`/`sicted_*` del restore por defecto).
7. Documentar en `ChecklistsModule` (comentario de cabecera) el contrato: "motor compartido sicted+appcc; evidencia append-only; nunca añadir estas tablas a la extensión de soft-delete ni a Papelera; nuevo consumidor = nuevo controlador con su propio `@RequireModule`, filtrando por `usedByModules`".

## Success Criteria

- [x] `GET /api/v1/sicted/ping` (temporal en tests) → 403 con módulo off, 200 con módulo on, 403 para VIEWER si la sección está restringida. Probado en `backend/test/e2e/sicted-module-access.e2e-spec.ts` (3/3 verde).
- [x] Nav muestra "SICTED" solo con módulo on; desaparece con off. Grupo "Calidad" en `nav-config.ts`, gateado por `moduleId: 'sicted'` igual que el resto de entradas (mismo mecanismo ya probado en producción para otros módulos).
- [x] Migración de guarda aplica limpia en `chefchek_test` y en la BD dev (baseline previo resuelto sin tocar datos: 9 tenants/10 usuarios sin cambios); función testeada con INSERT/UPDATE/DELETE reales en `backend/test/e2e/evidence-immutability-trigger.e2e-spec.ts` (7/7 verde) — UPDATE/DELETE fallan sin escape, pasan con `SET LOCAL`.
- [x] `git diff --stat` no toca `modules/appcc/**` ni `dashboard/appcc/**` — confirmado.
- [x] (añadido en revisión) el escape `SET LOCAL` del restore con `includeEvidenceTables=true` funciona de extremo a extremo contra una tabla real con el trigger — `backend/test/e2e/backup-restore-evidence-escape.e2e-spec.ts` (2/2 verde); bug encontrado y corregido durante la revisión (faltaba activar el escape).

## Risk Assessment

- *Trigger + cascada de tenant*: sin el escape, borrar un cliente falla. Mitigación: escape por `SET LOCAL` dentro de la transacción de purge + test de purge de un tenant con registros.
- *Restore pisa evidencia reciente*: decisión 4; por defecto excluir. Rollback: quitar la exclusión no borra datos.
- *Rollback de la fase*: migración aditiva; revertir = `DROP FUNCTION` + quitar registro del módulo. Sin datos aún.
