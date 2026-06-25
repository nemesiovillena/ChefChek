---
phase: 2
title: "Fase 2 - Restricción Módulos"
status: pending
effort: 2h
priority: P1
dependencies: [1]
---

# Phase 2: Restricción Módulos

## Overview

Restringir el endpoint `PATCH /api/v1/modules/:id` para que solo usuarios con rol `OWNER` puedan activar/desactivar módulos. Admin/User/Viewer pueden LEER pero NO modificar.

## Requirements

**Functional:**
- Solo OWNER puede ejecutar `PATCH /api/v1/modules/:id`
- Todos los roles pueden ejecutar `GET /api/v1/modules`
- 403 Forbidden si no-OWNER intenta toggle
- Error message: "Solo el OWNER puede gestionar módulos"

**Non-functional:**
- Cambio no afecta endpoints existentes no relacionados a módulos

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  GET /api/v1/modules                                │
│  Auth + Tenant Guard                                │
│  ✅ Todos los roles autenticados                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  PATCH /api/v1/modules/:id                          │
│  Auth + Tenant Guard                                │
│  + NEW: RequireRole('OWNER') Guard                  │
│  ❌ Admin/User/Viewer → 403                         │
│  ✅ Owner → Procede                                 │
└─────────────────────────────────────────────────────┘
```

## Related Code Files

| Acción | Archivo |
|--------|---------|
| Modify | `backend/src/modules/modules/modules.controller.ts` |
| Modify | `backend/src/guards/roles.guard.ts` (si necesita tweak) |
| Create | `backend/src/decorators/roles.decorator.ts` (decorador RequireRole) |

## Implementation Steps

1. **Crear/Actualizar decorador RequireRole**
   ```typescript
   // backend/src/decorators/roles.decorator.ts
   import { SetMetadata } from '@nestjs/common';

   export const RequireRole = (...roles: UserRole[]) =>
     SetMetadata('roles', roles);
   ```

2. **Aplicar guard en ModulesController**
   ```typescript
   // backend/src/modules/modules/modules.controller.ts

   import { RequireRole } from '../../decorators/roles.decorator';

   @Controller('api/v1/modules')
   @UseGuards(AuthGuard, TenantGuard)
   export class ModulesController {
     @Get()
     async getModules(@Req() req: any) {
       // Todos los roles autenticados pueden ver
       return await this.modulesService.getModules(req.tenantId);
     }

     @Patch(':id')
     @UseGuards(RolesGuard)
     @RequireRole('OWNER')  // ← NUEVO
     async toggleModule(...) {
       // Solo OWNER puede toggle
       return await this.modulesService.toggleModule(...);
     }
   }
   ```

3. **Actualizar mensaje de error en RolesGuard**
   - Cambiar "Insufficient permissions" → "Solo el OWNER puede gestionar módulos"

4. **Tests unitarios**
   - Test PATCH con rol OWNER → 200 OK
   - Test PATCH con rol ADMIN → 403 Forbidden
   - Test PATCH con rol USER → 403 Forbidden
   - Test GET con cualquier rol → 200 OK

## Success Criteria

- [ ] Decorador `RequireRole` funciona
- [ ] Guard bloquea no-OWNER en PATCH
- [ ] Admin puede GET módulos
- [ ] Mensaje de error claro en español
- [ ] Tests unitarios pasan

## Risk Assessment

| Risk | Probabilidad | Impacto | Mitigación |
|------|-------------|---------|------------|
| Guard bloquea todos | Bajo | Alto | Tests全覆盖 |
| Error message genérico | Medio | Bajo | Custom message en service |

## Rollback

- Quitar `@UseGuards(RolesGuard)` y `@RequireRole('OWNER')`
- Restaurar mensaje original en RolesGuard

---

**Archivos críticos:**
- `backend/src/modules/modules/modules.controller.ts:24-33`
- `backend/src/guards/roles.guard.ts:1-52`