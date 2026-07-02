# Fase 7: Tests

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 45 min  
**Dependencias:** Fases 1–6

---

## Objetivo

Actualizar los tests existentes rotos por el refactor y añadir cobertura para los nuevos flujos de SUPERADMIN. Mantener cobertura de branches ≥ 70%.

---

## 1. Actualizar `modules.controller.spec.ts`

El test actual verifica que `OWNER` puede hacer toggle. Ese comportamiento desaparece:

```diff
- it('should toggle module activation state for OWNER', async () => { ... })
- it('should require OWNER role for toggleModule', () => { ... })
+ it('should return modules list for authenticated user', async () => { ... })
+ // El PATCH ya no existe en este controller — eliminar tests de toggle
```

Verificar que `GET /api/v1/modules` sigue funcionando para cualquier rol.

---

## 2. Nuevo `superadmin.guard.spec.ts`

```typescript
describe('SuperadminGuard', () => {
  it('should allow SUPERADMIN role', () => { ... });
  it('should reject OWNER role with 403', () => { ... });
  it('should reject ADMIN role with 403', () => { ... });
  it('should reject unauthenticated request with 401', () => { ... });
});
```

---

## 3. Nuevo `superadmin.controller.spec.ts`

```typescript
describe('SuperadminController', () => {
  describe('GET /superadmin/tenants', () => {
    it('should list all tenants for SUPERADMIN', async () => { ... });
    it('should reject non-SUPERADMIN with 403', async () => { ... });
  });

  describe('GET /superadmin/tenants/:id/modules', () => {
    it('should return modules for a specific tenant', async () => { ... });
    it('should throw 404 if tenant does not exist', async () => { ... });
  });

  describe('PATCH /superadmin/tenants/:id/modules/:moduleId', () => {
    it('should toggle module enabled state', async () => { ... });
    it('should throw 400 on dependency conflict', async () => { ... });
    it('should throw 403 if trying to disable alwaysActive module', async () => { ... });
  });
});
```

---

## 4. Actualizar `auth.service.spec.ts` (si existe)

Añadir tests para `superadminLogin`:

```typescript
describe('superadminLogin', () => {
  it('should login SUPERADMIN without tenantSlug', async () => { ... });
  it('should reject if role is not SUPERADMIN', async () => { ... });
  it('should reject invalid password', async () => { ... });
});
```

---

## 5. Actualizar `users.service.spec.ts`

```typescript
describe('create', () => {
  it('should throw ForbiddenException when role is SUPERADMIN', async () => { ... });
});

describe('validateUserPermissions', () => {
  it('should grant SUPERADMIN access to any role requirement', async () => { ... });
});
```

---

## 6. Verificación de cobertura

```bash
cd backend
npm run test:cov
```

Targets mínimos (sin degradar los actuales):
- Branches: ≥ 70%
- Lines: ≥ 70%

Módulos críticos a revisar en el reporte de cobertura:
- `src/guards/superadmin.guard.ts`
- `src/modules/superadmin/superadmin.service.ts`
- `src/modules/superadmin/superadmin.controller.ts`
- `src/modules/modules/modules.controller.ts` (ruta PATCH eliminada)

---

## Checklist

- [ ] `modules.controller.spec.ts` actualizado (eliminados tests de OWNER toggle)
- [ ] `superadmin.guard.spec.ts` creado con 4 casos
- [ ] `superadmin.controller.spec.ts` creado con casos para las 3 rutas principales
- [ ] `auth.service.spec.ts` actualizado con casos de `superadminLogin`
- [ ] `users.service.spec.ts` actualizado (bloqueo SUPERADMIN en create + jerarquía nivel 5)
- [ ] `npm run test` pasa sin errores
- [ ] Cobertura de branches ≥ 70% mantenida
