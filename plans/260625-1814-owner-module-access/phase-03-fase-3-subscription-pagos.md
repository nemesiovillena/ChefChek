---
phase: 3
title: "Fase 3 - Subscription Pagos"
status: pending
effort: 4h
priority: P2
dependencies: [1, 2]
---

# Phase 3: Subscription Pagos

## Overview

Implementar sistema de suscripción para tracking de módulos pagados. Integración con Stripe/Sepay webhooks. Activación automática de módulos cuando el pago confirma.

## Requirements

**Functional:**
- Tabla `Subscription` tracking módulos por tenant
- Webhook handler para payment events
- Activar módulos automáticamente en `checkout.session.completed`
- Desactivar módulos en `customer.subscription.deleted` / `payment_failed`
- Admin visual de suscripción por tenant

**Non-functional:**
- Idempotencia de webhooks (reintentos seguros)
- Auditoría de cambios de suscripción

## Architecture

```prisma
model Subscription {
  id                String   @id @default(cuid())
  tenantId          String   @unique
  stripeCustomerId  String?
  stripePriceId     String?  // Plan base
  modules           Json     // ["albaranes", "production", "warehouses"]
  status            String   // ACTIVE, CANCELLED, TRIAL, PAST_DUE
  currentPeriodEnd  DateTime?
  cancelAtPeriodEnd Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("subscriptions")
}
```

**Flow de pago:**
```
Stripe/Sepay → Webhook → SubscriptionService
                                 ↓
                   Crear/Actualizar Subscription
                                 ↓
                   ModulesService.toggleModule()
                                 ↓
                   Activar módulos pagados
```

## Related Code Files

| Acción | Archivo |
|--------|---------|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/src/modules/subscriptions/` |
| Create | `backend/src/modules/subscriptions/subscriptions.service.ts` |
| Create | `backend/src/modules/subscriptions/subscriptions.controller.ts` |
| Create | `backend/src/modules/subscriptions/dto/subscription.dto.ts` |
| Modify | `backend/src/modules/modules/modules.service.ts` (activación auto) |

## Implementation Steps

1. **Agregar modelo Subscription a schema.prisma**
   - Ejecutar migration: `npx prisma migrate dev --name add_subscription`

2. **Crear SubscriptionService**
   ```typescript
   // src/modules/subscriptions/subscriptions.service.ts
   @Injectable()
   export class SubscriptionService {
     async handleWebhook(event: Stripe.Event): Promise<void> {
       switch (event.type) {
         case 'checkout.session.completed':
           await this.activateSubscription(event);
           break;
         case 'customer.subscription.deleted':
           await this.cancelSubscription(event);
           break;
         // Más eventos...
       }
     }

     private async activateSubscription(event: any) {
       const session = event.data.object;
       const tenantId = session.metadata.tenantId;
       const modules = session.metadata.modules; // ["albaranes", "production"]

       // Guardar suscripción
       await this.prisma.subscription.upsert({
         where: { tenantId },
         create: { tenantId, modules, status: 'ACTIVE', ... },
         update: { modules, status: 'ACTIVE' }
       });

       // Activar módulos
       for (const moduleId of modules) {
         await this.modulesService.toggleModule(
           tenantId, moduleId, { enabled: true }, 'SYSTEM'
         );
       }
     }
   }
   ```

3. **Crear webhook controller**
   ```typescript
   // src/modules/subscriptions/subscriptions.controller.ts
   @Post('webhook')
   async webhook(@Req() req: any) {
     const sig = req.headers['stripe-signature'];
     const event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
     return await this.subscriptionService.handleWebhook(event);
   }
   ```

4. **Webhook endpoint abierto (sin auth)**
   - Stripe llama sin auth
   - Validar signature de Stripe para seguridad

5. **Tests de integración**
   - Mock Stripe webhook events
   - Test activación automática de módulos
   - Test idempotencia (reintentos seguros)

## Success Criteria

- [ ] Tabla Subscription creada
- [ ] Webhook handler procesa `checkout.session.completed`
- [ ] Módulos se activan automáticamente tras pago
- [ ] Módulos se desactivan tras cancelación
- [ ] Idempotencia probada (reintentos)
- [ ] Tests de integración pasan

## Risk Assessment

| Risk | Probabilidad | Impacto | Mitigación |
|------|-------------|---------|------------|
| Webhook delay/retry | Medio | Medio | Idempotencia implementada |
| Módulo activado pero pago falla | Bajo | Alto | Validar estado pago en cada request |
| Stripe outage | Bajo | Alto | Cache temporal + retry |

## Rollback

- Quitar webhook endpoint
- Desactivar módulos manualmente
- Migración reversible

---

**Archivos críticos:**
- Nuevo módulo `backend/src/modules/subscriptions/`
- Configurar STRIPE_WEBHOOK_SECRET en .env