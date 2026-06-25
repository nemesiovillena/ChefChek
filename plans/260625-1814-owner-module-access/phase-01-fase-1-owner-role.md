---
phase: 1
title: "Fase 1 - OWNER Role"
status: pending
effort: 1h
priority: P1
dependencies: []
---

# Phase 1: OWNER Role

## Overview

Añadir rol `OWNER` al enum `UserRole` y definir sus permisos. El OWNER tiene mismos permisos que ADMIN + control exclusivo de módulos.

## Requirements

**Functional:**
- `OWNER` es nuevo valor en enum `UserRole`
- OWNER hereda todos los permisos de ADMIN
- OWNER puede gestionar módulos (activar/desactivar)
- Un tenant tiene exactamente 1 OWNER

**Non-functional:**
- Migration no rompe datos existentes
- Roles ADMIN/USER/VIEWER no afectados

## Architecture

```prisma
// Antes
enum UserRole {
  ADMIN
  USER
  VIEWER
}

// Después
enum UserRole {
  OWNER      // Nuevo
  ADMIN
  USER
  VIEWER
}
```

**Hierarchy de permisos:**
```
OWNER > ADMIN > USER > VIEWER
```

## Related Code Files

| Acción | Archivo |
|--------|---------|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/XXXXXX_add_owner_role/` |
| Modify | `backend/src/modules/auth/permissions.service.ts` (opcional) |
| Modify | `backend/src/modules/users/users.service.ts` (validación) |

## Implementation Steps

1. **Editar schema.prisma**
   - Añadir `OWNER` al enum `UserRole` (primera línea)
   - Guardar archivo

2. **Generar migration**
   ```bash
   cd backend && npx prisma migrate dev --name add_owner_role
   ```

3. **Validar migration**
   - Revisar SQL generado
   - Verificar que no rompe data existente

4. **Regenerate client**
   ```bash
   npx prisma generate
   ```

5. **Actualizar UsersService (opcional)**
   - Añadir validación: solo 1 OWNER por tenant
   - `validateUniqueOwner()` en creación/actualización

6. **Tests unitarios**
   - Test crear usuario con rol OWNER
   - Test error si segundo OWNER en mismo tenant
   - Test permisos heredados de ADMIN

## Success Criteria

- [ ] Migration ejecutada sin errores
- [ ] `OWNER` valor existe en DB
- [ ] Prisma types actualizados
- [ ] Test unitario OWNER pasa
- [ ] Data existente intacta (ADMIN sigue siendo ADMIN)

## Risk Assessment

| Risk | Probabilidad | Impacto | Mitigación |
|------|-------------|---------|------------|
| Enum migration falla | Bajo | Medio | Prisma migration es reversible |
| Tenant sin OWNER | Medio | Bajo | Auto-assign en creación tenant |

## Rollback

```bash
npx prisma migrate resolve --rolled-back [migration-name]
```

---

**Archivos críticos:**
- `backend/prisma/schema.prisma:297-301`