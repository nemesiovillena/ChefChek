---
phase: 5
title: "Fase 5 - Tests"
status: pending
effort: 2h
priority: P1
dependencies: [1, 2, 3, 4]
---

# Phase 5: Tests

## Overview

Suite completa de tests para validar OWNER role, restricción de módulos, integración webhooks, y UI.

## Requirements

**Coverage:**
- Unit tests: guards, services, DTOs
- Integration tests: endpoints, webhooks
- E2E tests: UI interactions
- Min 80% coverage nuevo código

## Test Matrix

| Component | Tipo | Tests | Archivo |
|-----------|------|-------|---------|
| UserRole enum | Unit | Enum values exist | `role.enum.spec.ts` |
| RolesGuard | Unit | OWNER allow, others block on modules | `roles.guard.spec.ts` |
| ModulesController | Integration | PATCH 200 (OWNER), 403 (Admin) | `modules.controller.spec.ts` |
| ModulesService | Unit | Toggle logica, dependency check | `modules.service.spec.ts` |
| SubscriptionService | Unit | Webhook parsing, activation | `subscriptions.service.spec.ts` |
| Webhook endpoint | Integration | Stripe signature validation | `subscriptions.controller.spec.ts` |
| UI | E2E | Switch disabled/Admin, enabled/OWNER | `modules.spec.ts` |

## Implementation Steps

1. **Unit test: RolesGuard con OWNER**
   ```typescript
   // backend/src/guards/roles.guard.spec.ts
   describe('RolesGuard - OWNER modules', () => {
     it('should allow OWNER to toggle modules', async () => {
       const mockUser = { id: '1', role: UserRole.OWNER };
       const context = createMockContext(mockUser);
       expect(await guard.canActivate(context)).toBe(true);
     });

     it('should block ADMIN from toggling modules', async () => {
       const mockUser = { id: '2', role: UserRole.ADMIN };
       const context = createMockContext(mockUser);
       await expect(guard.canActivate(context)).toBe(ForbiddenException);
     });
   });
   ```

2. **Integration test: ModulesController**
   ```typescript
   // backend/src/modules/modules/modules.controller.spec.ts
   describe('PATCH /modules/:id', () => {
     it('should return 403 for non-OWNER', async () => {
       const res = await request(app.getHttpServer())
         .patch('/api/v1/modules/albaranes')
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ enabled: true });
       expect(res.status).toBe(403);
       expect(res.body.message).toContain('Solo el OWNER');
     });

     it('should return 200 for OWNER', async () => {
       const res = await request(app.getHttpServer())
         .patch('/api/v1/modules/albaranes')
         .set('Authorization', `Bearer ${ownerToken}`)
         .send({ enabled: true });
       expect(res.status).toBe(200);
     });
   });
   ```

3. **Unit test: SubscriptionService**
   ```typescript
   // backend/src/modules/subscriptions/subscriptions.service.spec.ts
   describe('handleWebhook', () => {
     it('should activate modules on checkout.completed', async () => {
       const event = createMockWebhook('checkout.session.completed', {
         metadata: { tenantId: 'tenant-1', modules: '["albaranes"]' }
       });
       await service.handleWebhook(event);
       const sub = await prisma.subscription.findUnique({ where: { tenantId: 'tenant-1' } });
       expect(sub?.modules).toEqual(['albaranes']);
     });
   });
   ```

4. **E2E test: UI switches**
   ```typescript
   // frontend/e2e/modules.spec.ts
   test('Admin sees disabled switches', async ({ page }) => {
     await loginAs(page, 'admin@example.com');
     await page.goto('/dashboard/settings');

     const switch = page.locator('[data-testid="module-switch-albaranes"]');
     await expect(switch).toHaveAttribute('disabled');
   });

   test('OWNER can toggle modules', async ({ page }) => {
     await loginAs(page, 'owner@example.com');
     await page.goto('/dashboard/settings');

     const switch = page.locator('[data-testid="module-switch-albaranes"]');
     await switch.click();
     await expect(switch).not.toHaveAttribute('disabled');
   });
   ```

5. **Run coverage**
   ```bash
   cd backend && npm run test:cov
   cd frontend && npm run test:cov
   ```

## Success Criteria

- [ ] Unit tests pasan (backend)
- [ ] Integration tests pasan
- [ ] E2E tests pasan
- [ ] Coverage ≥ 80% nuevo código
- [ ] Ningún test flakey

## Risk Assessment

| Risk | Probabilidad | Impacto | Mitigación |
|------|-------------|---------|------------|
| Mock database unreliable | Medio | Medio | Usar in-memory DB |
| E2E tests slow | Bajo | Bajo | Tests aislados |

## Rollback

- Tests no afectan producción
- Quitar test suite si falla

---

**Archivos críticos:**
- `backend/src/guards/roles.guard.spec.ts`
- `backend/src/modules/modules/modules.controller.spec.ts`
- `backend/src/modules/subscriptions/subscriptions.service.spec.ts` (nuevo)
- `frontend/e2e/modules.spec.ts` (nuevo)