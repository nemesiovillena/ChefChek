# Fase 5: Limpieza OWNER + Seguridad Tenants

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 20 min  
**Dependencias:** Fase 3, Fase 4

---

## Objetivo

- Eliminar el permiso de gestión de módulos del rol `OWNER`
- Asegurar que los endpoints de tenants solo sean accesibles por `SUPERADMIN`
- Actualizar seed y validaciones de creación de usuarios

---

## 1. `modules.controller.ts` — eliminar endpoint PATCH

El endpoint `PATCH /api/v1/modules/:id` ya no tiene razón de existir: los módulos solo los gestiona SUPERADMIN desde `/api/v1/superadmin/tenants/:id/modules/:moduleId`. Eliminar el método `toggleModule` del controller.

```diff
 @Controller('api/v1/modules')
 @UseGuards(AuthGuard, TenantGuard)
 export class ModulesController {
   constructor(private readonly modulesService: ModulesService) {}

   @Get()
   async getModules(@Req() req: any) {
     return await this.modulesService.getModules(req.tenantId);
   }

-  @Patch(':id')
-  @UseGuards(RolesGuard)
-  @Roles('OWNER')
-  async toggleModule(
-    @Param('id') id: string,
-    @Body() dto: UpdateModuleDto,
-    @Req() req: any,
-  ) {
-    return await this.modulesService.toggleModule(req.tenantId, id, dto, req.user?.id);
-  }
 }
```

> El `GET /api/v1/modules` se mantiene: cualquier usuario autenticado puede ver qué módulos tiene activos su tenant.

---

## 2. `tenants.controller.ts` — asegurar rutas con SUPERADMIN

Actualmente `POST /tenants` y `GET /tenants` son **públicos** (sin guards). Deben estar protegidos:

```diff
+import { SuperadminGuard } from '../../guards/superadmin.guard';

 @Controller('api/v1/tenants')
 export class TenantsController {

-  @Post()
+  @Post()
+  @UseGuards(AuthGuard, SuperadminGuard)
   async create(@Body() createTenantDto: CreateTenantDto) { ... }

-  @Get()
+  @Get()
+  @UseGuards(AuthGuard, SuperadminGuard)
   async findAll(...) { ... }

   // findOne, update, delete ya tienen @Roles('ADMIN') — cambiar a SuperadminGuard:
-  @UseGuards(AuthGuard, RolesGuard)
-  @Roles('ADMIN')
+  @UseGuards(AuthGuard, SuperadminGuard)
   async findOne(...) { ... }

-  @UseGuards(AuthGuard, RolesGuard)
-  @Roles('ADMIN')
+  @UseGuards(AuthGuard, SuperadminGuard)
   async update(...) { ... }

-  @UseGuards(AuthGuard, RolesGuard)
-  @Roles('ADMIN')
+  @UseGuards(AuthGuard, SuperadminGuard)
   async remove(...) { ... }
 }
```

> Los tenants pasan a ser responsabilidad exclusiva del SUPERADMIN. ADMIN del tenant ya no puede ver/editar otros tenants.

---

## 3. `users.service.ts` — impedir crear SUPERADMIN desde la API de tenant

El método `create` solo permite `ADMIN | USER | VIEWER` por defecto. Añadir validación explícita:

```diff
 async create(dto: CreateUserDto, requestTenantId: string) {
+  if (dto.role === 'SUPERADMIN') {
+    throw new ForbiddenException('No se puede crear un SUPERADMIN desde esta API');
+  }
   ...
 }
```

---

## 4. `auth.service.ts` — impedir registrar SUPERADMIN por `register`

```diff
 async register(email, password, name, tenantSlug, role = 'USER') {
+  if (role === 'SUPERADMIN') {
+    throw new ForbiddenException('Rol no permitido en registro');
+  }
   ...
 }
```

---

## Checklist

- [ ] Método `toggleModule` eliminado de `modules.controller.ts`
- [ ] `POST /tenants` protegido con `SuperadminGuard`
- [ ] `GET /tenants` protegido con `SuperadminGuard`
- [ ] `GET/PATCH/DELETE /tenants/:id` migrado de `@Roles('ADMIN')` a `SuperadminGuard`
- [ ] `users.service.create` rechaza `role = SUPERADMIN`
- [ ] `auth.service.register` rechaza `role = SUPERADMIN`
- [ ] Seed actualizado y funciona (`npx prisma db seed`)
