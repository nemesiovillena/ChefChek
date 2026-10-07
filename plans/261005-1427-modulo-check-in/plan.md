---
title: 'Módulo Check-In: control horario legal, turnos y RRHH'
description: >-
  Tres módulos tenant-activables (check-in, turnos, rrhh): fichaje con PIN y
  geovalla en PWA con modo sin conexión, registro de jornada inalterable con
  informes para Inspección, planificador de turnos, ausencias, portal del
  empleado y documentación
status: in-progress
priority: P1
effort: 180-220h
branch: develop
tags:
  - backend
  - frontend
  - prisma
  - check-in
  - turnos
  - rrhh
  - pwa
  - offline
  - legal
blockedBy: []
blocks: []
created: '2026-10-05T12:35:30.469Z'
createdBy: 'ck:plan'
source: skill
---

# Módulo Check-In: control horario legal, turnos y RRHH

## Overview

PDR completo: [docs/pdr-modulo-check-in.md](../../docs/pdr-modulo-check-in.md).

Decisiones confirmadas 2026-10-05: (1) PWA, sin app nativa; (2) antifraude por PIN solo en kiosco (sesión personal sin PIN), sin imagen ni facial; (3) Reclutamiento fuera (PDR propio); (4) módulos separados `check-in` / `turnos` / `rrhh`; (5) nóminas aplazadas; (6) aprueba ADMIN/OWNER, más roles en el futuro; (7) turno partido soportado; (8) prenómina aplazada; (9) Configuración: convenio seleccionable (Warynessy = hostelería), pausas computables on/off, centros y asignación de empleados; (10) XLSX incluido; (11) textos legales validados por el ADMIN del tenant antes de poder fichar.

Tres oleadas desplegables por separado. La Oleada 1 (fases 1-5) cubre por sí sola la obligación legal de registro de jornada. Regla innegociable: **cero pérdida de datos** (migraciones aditivas). Ninguna fase se empieza sin aprobación del PDR.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Fundaciones modulos empleados centros PIN](./phase-01-fundaciones-modulos-empleados-centros-pin.md) | In Progress |
| 2 | [Fichaje online personal y kiosco con PIN y geovalla](./phase-02-fichaje-online-personal-y-kiosco-con-pin-y-geovalla.md) | Pending |
| 3 | [PWA y fichaje sin conexion](./phase-03-pwa-y-fichaje-sin-conexion.md) | Pending |
| 4 | [Registro de jornada correcciones y hojas de horas](./phase-04-registro-de-jornada-correcciones-y-hojas-de-horas.md) | Pending |
| 5 | [Informes legales y panel de gerencia](./phase-05-informes-legales-y-panel-de-gerencia.md) | Pending |
| 6 | [Ausencias vacaciones y bajas](./phase-06-ausencias-vacaciones-y-bajas.md) | Pending |
| 7 | [Planificador de turnos](./phase-07-planificador-de-turnos.md) | Pending |
| 8 | [Plan vs real alertas legales y coste](./phase-08-plan-vs-real-alertas-legales-y-coste.md) | Pending |
| 9 | [Portal del empleado y solicitudes](./phase-09-portal-del-empleado-y-solicitudes.md) | Pending |
| 10 | [Documentacion laboral](./phase-10-documentacion-laboral.md) | Pending |
| 11 | [QA final (prenomina aplazada)](./phase-11-prenomina-y-qa-final.md) | Pending |

| Oleada | Módulo | Fases | Esfuerzo |
|---|---|---|---|
| 1 | `check-in` | 1-5 | In Progress |
| 2 | `turnos` | 6-8 | 56-66 h |
| 3 | `rrhh` | 9-11 | 36-42 h |

## Dependency Graph

```
1 (fundaciones) ─► 2 (fichaje) ─┬─► 3 (PWA/offline) ─┐
                                └─► 4 (jornada)      ─┴─► 5 (informes)   ══ Oleada 1 desplegable
1 ─► 6 (ausencias) ─► 7 (planificador) ─► 8 (plan vs real; necesita 4)  ══ Oleada 2
4, 6 ─► 9 (portal) ─► 10 (documentación) ─► 11 (QA final) ══ Oleada 3
```

Fases 3 y 4 pueden ir en paralelo (ficheros distintos: PWA/cliente vs cálculo/servidor).

## Key Insights

- **Módulos sin migración**: entrada en [registry.ts](../../backend/src/modules/modules/constants/registry.ts) + `@RequireModule` + `NAV_GROUPS`/`ROUTE_MODULE_MAP` en [nav-config.ts](../../frontend/src/features/modules/lib/nav-config.ts). Secciones por rol en [section-registry.ts](../../backend/src/modules/role-access/constants/section-registry.ts).
- **Inalterabilidad ya resuelta**: `forbid_mutation()` y `forbid_mutation_after_seal()` existen; solo se adjunta el trigger a las tablas nuevas. Escape `chefchek.allow_evidence_purge` para purge/restore.
- **Kiosco = cuenta compartida**: `User.isSharedAccount` ya modela el dispositivo de cocina; el kiosco es esa sesión + selección de empleado + PIN.
- **Net-new real**: `Employee`, PWA completa (manifest, service worker, IndexedDB), geolocalización, cálculo de jornada, planificador.
- **El naming "Equipo" ya está ocupado** por el módulo `sala` en el registro; el portal se llama "Mi espacio" para no colisionar.
- **Gotchas del repo**: importar `AuthModule` en cada módulo nuevo; `prisma migrate dev` sin TTY → `migrate diff` + `migration.sql`; soft-delete en transacción con `.update({deletedAt})`; `ValidationPipe` no convierte tipos; backend corre desde `dist` (build + relanzar); tests backend con jest; e2e contra `chefchek_test`; tabs con `role="tablist"` (no `<nav>`), títulos en `<div>` (no `<header>`); inputs ≥16px en iOS; overlays `fixed inset-0` con `pb-28`; `useConfirm()` en vez de `confirm()`; sin `useEffect` directo; apiClient desenvuelve `{success,data}`; reglas de Backup (`CHILD_SCOPE_RULES`) deben incluir tablas nuevas.

## Acceptance Criteria (plan)

- Cada fase termina con sus criterios marcados, tests en verde y build de backend y frontend sin errores.
- Oleada 1 validada en uso real antes de iniciar la Oleada 2.
- Textos legales revisados por asesor antes de activar en producción.

## Dependencies

Sin dependencias con otros planes abiertos. Toca `Location` (creada por el plan de Compras, ya completado) de forma aditiva.

## Open Questions

Ver PDR (2 puntos, ninguno bloqueante): cifras del convenio de hostelería de Warynessy y lista de convenios del selector.
