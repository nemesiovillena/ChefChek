---
phase: 3
title: "Modulo y permiso por persona"
status: done
priority: P1
dependencies: []
effort: "0.5 día"
---

# Phase 3: Módulo y permiso por persona

## Overview
Registrar el módulo `correo` (apagado por defecto), la sección `correo` como permiso por persona, la entrada de menú/ruta y la casilla en la ficha de usuario.

## Requirements
- Módulo `correo` en `MODULE_REGISTRY`: `defaultEnabled:false`, `alwaysActive:false`. Aparece solo en superadmin (`modules.service.ts:22-47`).
- Sección `correo` `perUserOnly:true`, `defaultAllowed:false`, `moduleId:'correo'`.
- ADMIN/OWNER ven siempre (`SECTION_BYPASS_ROLES`); **SUPERADMIN nunca** (bloqueado en `CorreoAccessGuard`, fase 1) → no mostrarle el menú. Cuentas compartidas: según su rol (decisión usuario; no se aplica `personalAccountOnly`).
- Backend ya aplica `userAccess` a USER, VIEWER y USER_CUINER (`role-access.service.ts:96-140`): **sin cambios de backend** en permisos. [RT#13]
- Casilla "Puede ver el correo del restaurante" para USER, VIEWER y USER_CUINER; se guarda también al **crear** usuario. [RT#13]
- Menú y bloqueo de ruta en `nav-config.ts`. [RT#9]

## Architecture
```ts
// backend section-registry.ts
{ key: "correo", label: "Correo del restaurante", moduleId: "correo",
  defaultAllowed: false, perUserOnly: true },

// frontend nav-config.ts → NAV_GROUPS, mismo grupo que «Empleados» (decisión validación)
{ label: 'Correo', href: '/dashboard/correo', moduleId: 'correo', icon: 'mail',
  hiddenForRoles: ['SUPERADMIN'] },
// ROUTE_MODULE_MAP
{ prefix: '/dashboard/correo', moduleId: 'correo' },
// NavItem gana `hiddenForRoles?: string[]`; layout.tsx:137 añade
//   && !item.hiddenForRoles?.includes(user.role)
// y la redirección de ruta (layout.tsx:65-76) aplica la misma regla. <!-- Updated: Validation Session 1 - hiddenForRoles -->
```
`user-modal.tsx`: generalizar (DRY) la casilla de pedidos:
```ts
const PER_USER_GRANTS = [
  { key: 'compras-pedidos', module: 'compras', roles: ['USER'],
    label: 'Puede hacer pedidos a proveedores', hint: '…' },
  { key: 'correo', module: 'correo', roles: ['USER', 'VIEWER', 'USER_CUINER'],
    label: 'Puede ver el correo del restaurante', hint: 'Bandeja de restaurante@… en solo lectura.' },
];
```
Al crear: tras `createMutation`, `updateUserAccess({ userId: result.id, access })` (memoria: el interceptor desenvuelve → `result.id`).

## Related Code Files
- Modify: `backend/src/modules/modules/constants/registry.ts`
- Modify: `backend/src/modules/role-access/constants/section-registry.ts`
- Modify: `backend/src/modules/role-access/role-access.service.spec.ts`
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (NavItem.hiddenForRoles + NAV_GROUPS + ROUTE_MODULE_MAP)
- Modify: `frontend/src/app/dashboard/layout.tsx` (`:137` filtro y `:65-76` redirección con `hiddenForRoles`)
- Modify: `frontend/src/app/dashboard/users/components/user-modal.tsx` (`:105` condición de rol, `:182-195` guardado solo al editar)
- Reference: `frontend/src/features/modules/hooks/use-section-access.ts:84` (`useSectionAccess()` sin argumentos → `{map, canSee, canEnter}`), `frontend/src/app/dashboard/layout.tsx:65-76,131-137` (ya redirige y filtra a partir de nav-config)

## Implementation Steps
1. Módulo y sección en backend.
2. Tests role-access: USER/VIEWER/USER_CUINER sin grant → false; con grant → true; módulo off → false con grant; ADMIN → true; puesto restrictivo no quita el grant.
3. nav-config: campo `hiddenForRoles` en `NavItem`, item en el grupo de Empleados + ROUTE_MODULE_MAP; filtro y redirección en `layout.tsx`.
4. `user-modal`: `PER_USER_GRANTS` con roles; guardar al crear y al editar.

## Success Criteria
- [ ] Tests role-access en verde (`jest`).
- [ ] VIEWER nuevo con la casilla marcada al crearlo → ve "Correo".
- [ ] `/dashboard/correo` escrito a mano sin permiso → redirige (layout), sin llamadas a la API.
- [ ] SUPERADMIN no ve la entrada «Correo» y al escribir la URL se le redirige.

## Risk Assessment
- Depende de `feat/permiso-pedidos-por-persona` (PR #496) → ya mergeada en develop (`9524e91`).
