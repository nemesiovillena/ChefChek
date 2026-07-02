# Fase 4: SUPERADMIN API Backend

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 45 min  
**Dependencias:** Fase 1, Fase 2, Fase 3

---

## Objetivo

Crear el módulo `superadmin` con endpoints cross-tenant para gestionar tenants y sus módulos. Este es el núcleo del modelo de negocio: ChefChek activa/desactiva lo que cada cliente tiene contratado.

---

## Estructura de archivos nuevos

```
backend/src/modules/superadmin/
  superadmin.module.ts
  superadmin.controller.ts
  superadmin.service.ts
  dto/
    superadmin-tenant.dto.ts
```

---

## 1. `superadmin.controller.ts`

Todas las rutas bajo `/api/v1/superadmin/` protegidas con `AuthGuard + SuperadminGuard`.

```typescript
@Controller('api/v1/superadmin')
@UseGuards(AuthGuard, SuperadminGuard)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  /** Lista todos los tenants con su estado de módulos */
  @Get('tenants')
  async listTenants(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.superadminService.listTenants(+page, +limit);
  }

  /** Obtiene los módulos de un tenant específico */
  @Get('tenants/:tenantId/modules')
  async getTenantModules(@Param('tenantId') tenantId: string) {
    return this.superadminService.getTenantModules(tenantId);
  }

  /** Activa o desactiva un módulo de un tenant */
  @Patch('tenants/:tenantId/modules/:moduleId')
  async toggleTenantModule(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: any,
  ) {
    return this.superadminService.toggleTenantModule(
      tenantId,
      moduleId,
      dto,
      req.user.id,
    );
  }

  /** Actualiza datos de un tenant (nombre, estado activo, etc.) */
  @Patch('tenants/:tenantId')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.superadminService.updateTenant(tenantId, dto);
  }
}
```

---

## 2. `superadmin.service.ts`

Reutiliza `ModulesService` y `TenantsService`:

```typescript
@Injectable()
export class SuperadminService {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly tenantsService: TenantsService,
  ) {}

  async listTenants(page: number, limit: number) {
    return this.tenantsService.findAll(page, limit);
  }

  async getTenantModules(tenantId: string) {
    await this.assertTenantExists(tenantId);
    return this.modulesService.getModules(tenantId);
  }

  async toggleTenantModule(
    tenantId: string,
    moduleId: string,
    dto: UpdateModuleDto,
    userId: string,
  ) {
    await this.assertTenantExists(tenantId);
    return this.modulesService.toggleModule(tenantId, moduleId, dto, userId);
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    return this.tenantsService.update(tenantId, dto);
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
  }
}
```

---

## 3. `superadmin.module.ts`

```typescript
@Module({
  imports: [ModulesModule, TenantsModule, GuardsModule],
  controllers: [SuperadminController],
  providers: [SuperadminService],
})
export class SuperadminModule {}
```

Añadir `SuperadminModule` al array de `imports` en `app.module.ts`.

---

## 4. Resumen de rutas resultantes

| Método | Ruta | Acceso |
|--------|------|--------|
| `GET` | `/api/v1/superadmin/tenants` | SUPERADMIN |
| `GET` | `/api/v1/superadmin/tenants/:id/modules` | SUPERADMIN |
| `PATCH` | `/api/v1/superadmin/tenants/:id/modules/:moduleId` | SUPERADMIN |
| `PATCH` | `/api/v1/superadmin/tenants/:id` | SUPERADMIN |

---

## Checklist

- [ ] Directorio `backend/src/modules/superadmin/` creado
- [ ] `superadmin.controller.ts` implementado con las 4 rutas
- [ ] `superadmin.service.ts` implementado (delega en `ModulesService` y `TenantsService`)
- [ ] `superadmin.module.ts` creado e importado en `app.module.ts`
- [ ] Rutas protegidas con `AuthGuard + SuperadminGuard` (no `TenantGuard`)
- [ ] `ModulesModule` y `TenantsModule` exportan sus servicios para ser usados aquí
