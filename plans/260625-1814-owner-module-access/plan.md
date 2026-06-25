---
title: "Super Admin OWNER + Module Access Control"
description: "Sistema de rol OWNER que activa/desactiva módulos según pagos del tenant"
status: pending
priority: P2
branch: "main"
tags: ["roles", "modules", "payments", "saas"]
blockedBy: []
blocks: []
created: "2026-06-25T16:16:31.603Z"
createdBy: "ck:plan"
source: skill
---

# Super Admin OWNER + Module Access Control

## Overview

Implementar rol **OWNER** (super administrador que paga) y sistema de control de acceso a módulos basado en suscripción. El OWNER tiene privilegios exclusivos para activar/desactivar módulos en settings. Los demás roles solo pueden VER el estado de módulos pero NO modificarlo.

## Problem Statement

El sistema actual de módulos permite que cualquier usuario autenticado active/desactive módulos desde `/dashboard/settings`. Esto es problemático para un SaaS donde:
- El OWNER paga por módulos específicos
- Solo el OWNER debe tener control sobre qué módulos están activos
- Los ADMIN/USER del equipo NO deben poder alterar la suscripción

## Solution Approach

### Arquitectura en 2 Fases

**Fase 1 (MVP - hoy)**: Restriction access-only
- Añadir `OWNER` al enum `UserRole`
- Restringir `PATCH /api/v1/modules/:id` a rol OWNER con guard
- ADMIN/USER puede LEER módulos pero NO modificar

**Fase 2 (Pagos - futuro)**: Subscription integration
- Añadir tabla `Subscription` para tracking de pagos por módulo
- Integrar webhooks de Stripe/Sepay
- Activar módulos automáticamente cuando el pago confirma

### Decisiones Tomadas

| Decisión | Razón |
|----------|-------|
| `OWNER` role | Simple, usa arquitectura existente de roles |
| Guard en controller | Reutiliza `RolesGuard` existente |
| Configuration table persiste | No cambia storage, solo access control |
| Subscription opcional | Fase 1 funciona sin pagos |

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [OWNER Role](./phase-01-fase-1-owner-role.md) | Pending | 1h |
| 2 | [Restricción Módulos](./phase-02-fase-2-restricci-n-m-dulos.md) | Pending | 2h |
| 3 | [Subscription Pagos](./phase-03-fase-3-subscription-pagos.md) | Pending | 4h |
| 4 | [UI Update](./phase-04-fase-4-ui-update.md) | Pending | 2h |
| 5 | [Tests](./phase-05-fase-5-tests.md) | Pending | 2h |

**Total Estimated Effort:** 11 hours

## Dependencies

- Sistema de roles/permisos existente (`UserRole`, `RolesGuard`)
- Módulos system existente (`modules.controller`, `modules.service`)
- Módulo Configuration table para persistencia

## Acceptance Criteria

### Fase 1 - OWNER Role
- [ ] `OWNER` añadido a enum `UserRole`
- [ ] `OWNER` tiene todos los permisos de ADMIN + module management
- [ ] Migration de Prisma creada y ejecutada
- [ ] Usuarios existentes mantienen su rol actual

### Fase 2 - Restricción Módulos
- [ ] Solo OWNER puede llamar `PATCH /api/v1/modules/:id`
- [ ] ADMIN/USER puede llamar `GET /api/v1/modules` (read-only)
- [ ] 403 Forbidden si no-OWNER intenta toggle
- [ ] Error message claro: "Only OWNER can manage modules"

### Fase 3 - Subscription Pagos
- [ ] Tabla `Subscription` creada
- [ ] Webhook handler para Stripe/Sepay
- [ ] Activación automática de módulos cuando pago confirma
- [ ] Módulos inactivos si pago cancela/expire

### Fase 4 - UI Update
- [ ] Switches disabled para no-OWNER
- [ ] Badge "Solo OWNER puede modificar" visible
- [ ] Toast claro si intento no autorizado

### Fase 5 - Tests
- [ ] Tests unitarios guard OWNER
- [ ] Tests integración endpoints módulos
- [ ] Tests UI toggle con diferentes roles

## Open Questions

1. ¿Cómo se asigna el primer OWNER al crear un tenant? (Auto-assign al crear)
2. ¿Puede haber múltiples OWNERS por tenant? (Recomendado: NO - único por ahora)
3. ¿Qué pasa si el OWNER abandona el tenant? (Transferencia de ownership requerida)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No OWNER en tenant | Medium | Medium | Auto-asignar al crear tenant / admin promote |
| Cambio de rol en producción | Low | High | Migration con validación de datos existentes |
| Webhook payment delay | Medium | Medium | Cache temporal + retry en webhook |

## Rollback Plan

Si surge problema:
1. Revertir migration Prisma (drop OWNER enum value)
2. Quitar guard de `modules.controller`
3. Frontend: restaurar switches enabled

---

**Referencias:**
- [backend/src/guards/roles.guard.ts](../../backend/src/guards/roles.guard.ts)
- [backend/src/modules/modules/modules.controller.ts](../../backend/src/modules/modules/modules.controller.ts)
- [backend/prisma/schema.prisma:297](../../backend/prisma/schema.prisma#L297-L301)