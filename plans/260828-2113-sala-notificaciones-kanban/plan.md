---
title: "Notificaciones de Sala: CRUD + Kanban en dashboard"
description: "Módulo CRUD para que sala comunique reservas/menús/encargos a cocina; tablero Kanban drag-and-drop tipo Odoo, card resumen en el dashboard bajo Tareas."
status: completed
priority: P2
branch: "fix/albaranes-correct-price-dto-numeros"
tags: [sala, dashboard, kanban, crud]
blockedBy: []
blocks: []
created: "2026-08-28T19:16:57.018Z"
createdBy: "ck:plan"
source: skill
---

# Notificaciones de Sala: CRUD + Kanban en dashboard

## Overview

Nuevo módulo `SalaTask` para que el responsable de sala registre reservas, menús y encargos que cocina debe ver: CRUD completo (crear/editar/borrar), campos de reserva (título, fecha del evento, comensales, cliente, teléfono, menú/notas en texto largo), tablero Kanban por estado con drag-and-drop para reordenar prioridad y cambiar de columna, y una card resumen en el dashboard justo debajo de "Tareas de Prep. Próximas". La card de Tareas pasa de mostrar 6 a 4 elementos (mismo patrón "ver todas" que ya existe hoy). Clic en cualquier card del Kanban abre un modal con el detalle completo y las acciones de edición/borrado.

No implica tocar el módulo `sala` existente (QR/feedback de clientes) ni el modelo `Task`/`Sprint` (sprint tracker interno) — son dominios distintos, solo comparten palabra en español.

## Decisiones (confirmadas por el usuario)

1. **Nombre técnico del modelo**: `SalaTask` (evita colisión con el modelo `Task` del sprint-tracker, que es un dominio distinto). Nombre visible en UI: "Notificaciones de Sala".
2. **Kanban con 3 columnas fijas**: `PENDIENTE`, `EN_CURSO`, `COMPLETADO`. Sin columna "Cancelado" — confirmado por el usuario: si una reserva/encargo se cancela, se borra la card (soft-delete), no hace falta un estado aparte.
3. **"Mostrar todas" abre página propia**, no un modal — igual que "Tareas" hoy (`VER LISTA DE PREPARACIÓN COMPLETA` → `/dashboard/production/tasks`). Un Kanban con drag-and-drop necesita más espacio del que da un modal. Nueva ruta: `/dashboard/sala-notificaciones`.
4. **Prioridad = posición en la columna** (`sortOrder` por estado), no un campo numérico aparte — coherente con cómo ya funciona `ProductionOrder.sortOrder`.
5. **Sin ligar el "menú" a un `Menu` del catálogo existente** — el usuario pidió un textarea de texto libre, no un selector. Si luego se quiere enlazar a menús estructurados, es una iteración aparte.
6. **Gating por módulo**: se registra un `moduleId: 'sala-notificaciones'` nuevo en `MODULE_REGISTRY` con **`defaultEnabled: false`** — confirmado por el usuario: activación manual por tenant desde superadmin, no automática.
7. **Campos añadidos** a petición del usuario: email de contacto, observaciones y alergias — como campos independientes del textarea de menú (no mezclados en un solo campo de texto libre).
8. **Card resumen del dashboard**: muestra solo tareas en `PENDIENTE`/`EN_CURSO` (excluye `COMPLETADO`) — confirmado por el usuario.

## Modelo de datos propuesto (`SalaTask`)

| Campo | Tipo | Nota |
|---|---|---|
| id | String (cuid) | |
| tenantId | String | scoping multi-tenant |
| title | String | Título (obligatorio) |
| eventDate | DateTime | Fecha del evento (obligatorio) |
| guestCount | Int? | Número de comensales |
| customerName | String? | Nombre y apellidos |
| customerPhone | String? | Teléfono |
| customerEmail | String? | Email de contacto |
| menuNotes | String? @db.Text | Textarea largo: menú, encargos, texto libre |
| observations | String? @db.Text | Observaciones (campo independiente del menú) |
| allergies | String? @db.Text | Alergias (campo independiente) |
| status | String | `PENDIENTE` \| `EN_CURSO` \| `COMPLETADO` (default `PENDIENTE`) |
| sortOrder | Int | orden dentro de la columna, default 0 |
| createdBy | String | userId de quien crea |
| createdAt / updatedAt / deletedAt | DateTime | soft-delete, patrón estándar del proyecto |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend: modelo y API SalaTask](./phase-01-backend-modelo-y-api-salatask.md) | Completed |
| 2 | [Frontend: card dashboard y página Kanban](./phase-02-frontend-card-dashboard-y-p-gina-kanban.md) | Completed |
| 3 | [Frontend: modal de detalle/edición y ajustes finales](./phase-03-frontend-modal-de-detalle-edici-n-y-ajustes-finales.md) | Completed |

## Dependencies

Ninguna dependencia cruzada con otros planes activos detectada.

## Preguntas abiertas

Ninguna — las 4 decisiones pendientes de la versión anterior del plan quedaron resueltas por el usuario (ver sección "Decisiones" arriba).

## Verificación (post-implementación)

Implementado vía `/ck:cook`. Resumen (detalle por fase en cada `phase-XX-*.md`):
- **Tests:** 10 tests unitarios nuevos (`SalaTasksService`) + suite completa del backend (1711 tests) sin regresiones. Reporte: `reports/tester-260829-0003-test-verification-report.md`.
- **Code review:** score 6.5/10 en primera pasada; 2 bugs reales encontrados y corregidos (drag-and-drop del Kanban no reescribía `sortOrder` optimista → snap-back visual + riesgo de carrera; modal mostraba un borrador descartado al reabrir la misma tarea tras Cancelar), más 1 error de lint y 2 nits menores, todos corregidos. Reporte: `reports/code-reviewer-260829-0005-sala-notificaciones-review-report.md`.
- **No verificado manualmente:** smoke-test de CRUD vía curl y prueba de arrastre real en navegador (sin sesión de browser ni backend corriendo con datos en este pase) — cubierto en su lugar por tests unitarios + code-review. Recomendado antes de considerar la feature 100% validada en producción.
- **Desviación menor:** DTOs de la fase 1 consolidados en un solo archivo en vez de 3 (YAGNI, sin impacto funcional).
