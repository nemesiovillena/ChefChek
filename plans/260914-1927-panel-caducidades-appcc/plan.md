---
title: Panel de caducidades APPCC + alertas en dashboard
description: >-
  Panel de gestión de caducidades/consumo preferente bajo APPCC sobre FoodLabel
  existente, más rediseño de 2 cards del dashboard (sin popup, decisión del
  usuario).
status: completed
priority: P2
branch: develop
tags:
  - backend
  - frontend
  - appcc
  - etiquetado
  - dashboard
blockedBy: []
blocks: []
created: '2026-09-14T17:29:37.009Z'
createdBy: 'ck:plan'
source: skill
---

# Panel de caducidades APPCC + alertas en dashboard

## Overview

Diseño acordado con el usuario en consultoría `/ask` previa (no reabrir decisiones).
`FoodLabel` (backend/prisma/schema.prisma:2014) ya es la fuente de verdad de
lotes/caducidad/trazabilidad de elaboraciones y artículos manipulados — **no se
crea ningún modelo nuevo ni migración de schema**. El trabajo es: exponer un
umbral configurable + campos derivados de caducidad sobre `FoodLabel`, un panel
de gestión bajo APPCC, y sustituir 2 cards del dashboard principal (una de ellas
con datos simulados que nunca fueron reales) por un teaser de alertas y la card
de recetas reubicada.

**Sin popup/modal.** El aviso vive en una card del dashboard (decisión
explícita del usuario, mismo patrón que
`plans/260901-1410-programaciones-hoy-estados-dashboard` — precedente directo:
"reforzar card del dashboard, sin popup").

### Contrato nuevo (resumen)

`GET /api/v1/etiquetado/config` añade:
```ts
expiryWarningDays: number; // umbral por tenant, editable en Settings
```

`GET /api/v1/etiquetado/labels` (`ListFoodLabelsDto`) añade filtros:
```ts
expiringWithinDays?: number;
sortBy?: 'preparedAt' | 'useByDate';
```
Cada `FoodLabel` en la respuesta añade campos derivados:
```ts
daysUntilExpiry: number;   // negativo si ya caducó
expiryStatus: 'ok' | 'expiring_soon' | 'expired';
```

`GET /api/v1/dashboard/kpis` añade:
```ts
expiringLabels: {
  count: number;
  nearest: { id: string; itemName: string; labelType: 'ELABORATED' | 'HANDLED'; useByDate: string } | null;
} | null;
```

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend umbral y calculo caducidad](./phase-01-backend-umbral-y-calculo-caducidad.md) | Completed |
| 2 | [Backend resumen en dashboard KPIs](./phase-02-backend-resumen-en-dashboard-kpis.md) | Completed |
| 3 | [Frontend panel caducidades APPCC](./phase-03-frontend-panel-caducidades-appcc.md) | Completed |
| 4 | [Frontend dashboard cards reubicadas](./phase-04-frontend-dashboard-cards-reubicadas.md) | Completed |
| 5 | [Frontend settings umbral](./phase-05-frontend-settings-umbral.md) | Completed |
| 6 | [Verificacion](./phase-06-verificacion.md) | Completed |

## Dependencies

Ninguna. Sin planes vivos solapados (etiquetado/appcc/dashboard-kpis: los 3
planes previos en esa área están `done`/`completed`). Sin cambios de schema ni
migraciones — solo `Configuration` (key/value genérico, ya usado por
`EtiquetadoConfigService` para `thermalProfiles`/`defaultFormat`).

## Fuera de alcance (descartado en `/ask` previa)

- Popup/modal de aviso, `alert()`/`confirm()` nativos.
- Notificación proactiva vía campana/WebSocket.
- Modelo de datos nuevo para "elaboraciones" (se reusa `FoodLabel`).

## Validation Log

### Verification Results (Step 2.5, tier Full — 6 fases)

- **Claims checked:** 9 (rutas de archivo, nombres de método, imports de
  módulo, estructura de retorno de servicio)
- **Verified:** 7 | **Failed:** 2 | **Unverified:** 0

#### Failures (corregidas en el plan)

1. [Fact Checker] Fase 1 decía `findOne()` — el método real es `getById()`
   (`food-label.service.ts:291`). `FoodLabelService` no tiene mapeador de
   salida compartido: `list()` (línea 245) devuelve `data` crudo de Prisma;
   `getById()`, `create()` (línea 53) y `update()` (línea 337) devuelven el
   objeto `FoodLabel` de Prisma sin transformar. Corregido en
   `phase-01-backend-umbral-y-calculo-caducidad.md`.
2. [Contract Verifier] Fase 2 asumía condicionalmente que
   `EtiquetadoConfigService` podía no estar exportado — confirmado:
   `etiquetado.module.ts` lo tiene en `providers` pero no en `exports`
   (`exports: [FoodLabelService]` únicamente). Corregido a afirmación directa
   en `phase-02-backend-resumen-en-dashboard-kpis.md`. De paso, verificado
   sin riesgo de import circular `DashboardModule`↔`EtiquetadoModule`
   (`dashboard.module.ts` solo importa `AuthModule` hoy).

Roles Flow Tracer y Scope Auditor: sin hallazgos — no hay lógica async
compleja nueva ni estado compartido/singleton añadido (el umbral vive en la
tabla `Configuration` existente, mismo patrón ya usado por
`thermalProfiles`/`defaultFormat`).

### Interview (6 preguntas, dentro del rango 3-8 configurado)

| Decisión | Respuesta | Fase afectada |
|---|---|---|
| Umbral por defecto (`expiryWarningDays`) | **5 días** (no 2, propuesta descartada por el usuario) | 1 |
| Vista por defecto del panel | Todo, ordenado por caducidad más próxima; toggle aparte para "solo por caducar" | 3 |
| Card dashboard sin alertas (count=0) | Estado neutral, visible y clicable (no se oculta) | 4 |
| Contenido de la card con alertas | Contador + nombre del ítem más próximo (`nearest.itemName`) | 4 |
| Posición en orden móvil | Justo después de `notificacionesCard` (mismo nivel que otras alertas) | 4 |
| Rango válido del umbral | 1–30 días | 1 |

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `phase-01` a `phase-06` (las 7 archivos del
  directorio).
- Decision deltas checked: 6 (umbral default 2→5, método `findOne`→`getById`,
  export de `EtiquetadoConfigService` confirmado, posición móvil concretada,
  vista por defecto del panel confirmada, contenido de card confirmado).
- Reconciled stale references: 4 (las 3 menciones de "default 2" en fase 1 +
  la posición "razonable" de la card en fase 4).
- Unresolved contradictions: 0.

**Recomendación:** el plan es implementable tal cual. `Failed: 0` tras
propagar las correcciones — apto para `/ck:cook`.

## Code Review (post-implementación)

`code-reviewer` subagent, score 7/10, `HARD-GATE-NO-SIDE-EFFECTS: YES`. Hallazgos y resolución:

1. **HIGH — corregido.** Grid de 3 columnas del dashboard (Atmospheric
   Secondary Layer) podía quedar con un hueco visible: las 3 columnas usaban
   `&&` (se ocultan del todo) en vez de ternario con fallback. Un tenant con
   `recipes` activo pero `etiquetado` desactivado (o viceversa) perdía una
   columna. Fix: las 3 columnas ahora son ternarios con placeholder neutral
   ("Caducidades no disponible" / "Recetas no disponible"), igual que ya
   hacía la columna central. `frontend/src/app/dashboard/page.tsx`.
2. **MEDIUM — corregido para `nearest` (dashboard), aceptado para `list()`
   (panel).** El "más próximo a caducar" ordenaba por `useByDate` crudo, sin
   distinguir congeladas (`frozenUseByDate`) — desviaba de la decisión de
   validación ("fecha efectiva más próxima"). `DashboardService`: ahora
   compara 2 candidatos (fresca vs. congelada, cada una con su propio
   `findFirst` indexado) y elige la fecha efectiva real — sin SQL crudo.
   `FoodLabelService.list()` (orden del listado paginado completo): Prisma no
   soporta `ORDER BY COALESCE(...)` sin SQL crudo; **decisión del usuario**:
   se deja la aproximación (ordena por `useByDate`, no distingue congeladas)
   — congeladas son minoría y su vida útil suele ser mucho más larga, no
   compensa el riesgo de SQL crudo para el listado paginado. Documentado en
   el propio código, no en comentarios con referencias a planes.
3. **LOW — corregido.** Comentario engañoso en
   `etiquetado-config-section.tsx` sobre el alcance del gate `ADMIN`
   (`PUT /etiquetado/config` ya exigía `@Roles("ADMIN")` en todo el endpoint
   antes de este cambio, no es "fuera de alcance" — corregido el comentario).
4. **LOW — corregido.** Test añadido para el límite exacto
   `daysUntilExpiry === 0` → `'expiring_soon'` (no `'expired'`).

Tras los fixes: build backend limpio, 115 tests (`etiquetado`+`dashboard`,
incluye 3 tests nuevos de comparación fresca/congelada del `nearest`),
typecheck + lint frontend limpios.
