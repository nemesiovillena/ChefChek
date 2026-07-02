# Fase 3: Guards & Middleware

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 25 min  
**Dependencias:** Fase 1, Fase 2

---

## Objetivo

Actualizar guards y middleware para que SUPERADMIN bypase la validación de tenant y tenga el nivel jerárquico más alto (5).

---

## 1. `backend/src/modules/users/users.service.ts` — jerarquía de roles

```diff
 const roleHierarchy: { [key: string]: number } = {
+  SUPERADMIN: 5,
   OWNER: 4,
   ADMIN: 3,
   USER: 2,
   VIEWER: 1,
 };
```

---

## 2. `backend/src/guards/roles.guard.ts` — mensaje de error genérico

El mensaje actual dice "Solo el OWNER puede gestionar módulos", lo que ya no es correcto:

```diff
-throw new ForbiddenException(
-  'Permisos insuficientes. Solo el OWNER puede gestionar módulos.',
-);
+throw new ForbiddenException('Permisos insuficientes para esta operación.');
```

---

## 3. `backend/src/guards/tenant.guard.ts` — bypass para SUPERADMIN

```diff
 @Injectable()
 export class TenantGuard implements CanActivate {
   canActivate(context: ExecutionContext): boolean {
     const request = context.switchToHttp().getRequest<Request>() as any;

+    // SUPERADMIN no pertenece a ningún tenant — bypass obligatorio
+    if (request.user?.role === 'SUPERADMIN') {
+      return true;
+    }

     if (!request.tenantId) {
       if (request.user?.tenantId) {
         request.tenantId = request.user.tenantId;
       } else {
         throw new ForbiddenException('Tenant context is required');
       }
     }

     return true;
   }
 }
```

---

## 4. Nuevo guard `SuperadminGuard` — solo SUPERADMIN

Crear `backend/src/guards/superadmin.guard.ts`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Solo SUPERADMIN puede acceder a esta operación.');
    }

    return true;
  }
}
```

---

## 5. Registrar `SuperadminGuard` en `guards.module.ts`

```diff
 import { SuperadminGuard } from './superadmin.guard';

 @Module({
-  providers: [AuthGuard, RolesGuard, TenantGuard, PermissionGuard],
-  exports: [AuthGuard, RolesGuard, TenantGuard, PermissionGuard],
+  providers: [AuthGuard, RolesGuard, TenantGuard, PermissionGuard, SuperadminGuard],
+  exports: [AuthGuard, RolesGuard, TenantGuard, PermissionGuard, SuperadminGuard],
 })
 export class GuardsModule {}
```

---

## Checklist

- [ ] `SUPERADMIN: 5` añadido a `roleHierarchy` en `users.service.ts`
- [ ] Mensaje de error en `roles.guard.ts` actualizado (sin mencionar OWNER)
- [ ] `TenantGuard` hace bypass si `user.role === 'SUPERADMIN'`
- [ ] `superadmin.guard.ts` creado
- [ ] `SuperadminGuard` registrado y exportado en `guards.module.ts`
