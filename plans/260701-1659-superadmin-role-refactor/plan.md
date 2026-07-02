# Plan: SUPERADMIN Role — Gestión cross-tenant de módulos

**Estado:** 🔴 Pendiente  
**Fecha:** 2026-07-01  
**Branch:** `develop`  
**Objetivo:** Introducir el rol `SUPERADMIN` (equipo ChefChek) que gestiona módulos de todos los tenants, sin pertenecer a ninguno. El rol `OWNER` pasa a ser el dueño del restaurante (tenant-level), sin poder tocar módulos.

---

## Contexto

El sistema es multi-tenant. Hasta ahora `OWNER` (nivel 4) era el único capaz de activar/desactivar módulos de su propio tenant. El modelo de negocio real es que **ChefChek** (no el restaurante) decide qué módulos tiene contratados cada cliente y los activa/desactiva. Se necesita un `SUPERADMIN` que opere fuera del scope de tenant.

---

## Jerarquía de roles resultante

```
SUPERADMIN (5) — sin tenant, gestiona todos los tenants y sus módulos
OWNER      (4) — dueño del restaurante, gestiona usuarios/config de su tenant
ADMIN      (3) — administrador operativo del tenant
USER       (2) — usuario operativo
VIEWER     (1) — solo lectura
```

---

## Fases

| # | Fase | Estado |
|---|------|--------|
| 1 | [Schema & Migración DB](./phase-01-schema-migration.md) | ⬜ Pendiente |
| 2 | [Auth flow SUPERADMIN](./phase-02-auth-superadmin.md) | ⬜ Pendiente |
| 3 | [Guards & Middleware](./phase-03-guards-middleware.md) | ⬜ Pendiente |
| 4 | [SUPERADMIN API Backend](./phase-04-superadmin-api.md) | ⬜ Pendiente |
| 5 | [Limpieza OWNER + Seguridad Tenants](./phase-05-owner-cleanup.md) | ⬜ Pendiente |
| 6 | [Frontend SUPERADMIN panel](./phase-06-frontend.md) | ✅ Completado |
| 7 | [Tests](./phase-07-tests.md) | ✅ Completado |

---

## Dependencias entre fases

```
Fase 1 (Schema) → Fase 2 (Auth) → Fase 3 (Guards)
                                         ↓
                              Fase 4 (API) + Fase 5 (Cleanup)
                                         ↓
                                   Fase 6 (Frontend)
                                         ↓
                                   Fase 7 (Tests)
```

---

## Criterios de aceptación globales

- [ ] `SUPERADMIN` puede hacer login sin slug de tenant
- [ ] `SUPERADMIN` puede listar todos los tenants
- [ ] `SUPERADMIN` puede activar/desactivar módulos de cualquier tenant
- [ ] `OWNER` ya NO puede activar/desactivar módulos
- [ ] Usuarios normales (ADMIN/USER/VIEWER) no pueden acceder a rutas `/superadmin/`
- [ ] Tests pasan sin degradar cobertura actual (>70% branches)
- [ ] Frontend refleja el nuevo rol y redirige a panel correcto

---

## Archivos clave afectados

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/types/auth.types.ts`
- `backend/src/guards/roles.guard.ts`
- `backend/src/guards/tenant.guard.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/modules/modules.controller.ts`
- `backend/src/modules/tenants/tenants.controller.ts`
- `frontend/src/types/api.types.ts`
- `frontend/src/components/protected-route.tsx`
- `frontend/src/features/modules/api/modules-api.ts`
- `frontend/src/features/modules/hooks/use-modules.ts`
- `frontend/src/features/modules/components/module-list-widget.tsx`
