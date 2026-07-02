# Fase 6: Frontend SUPERADMIN panel

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 60 min  
**Dependencias:** Fase 4, Fase 5

---

## Objetivo

Actualizar el frontend para reconocer el rol `SUPERADMIN`, redirigirlo a su panel propio, y permitirle gestionar módulos por tenant desde la UI.

---

## 1. `frontend/src/types/api.types.ts` — añadir rol

```diff
-  role: 'OWNER' | 'ADMIN' | 'USER' | 'VIEWER';
+  role: 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'USER' | 'VIEWER';
```

---

## 2. `frontend/src/components/protected-route.tsx` — añadir rol

```diff
-export type UserRole = 'OWNER' | 'ADMIN' | 'USER' | 'VIEWER';
+export type UserRole = 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'USER' | 'VIEWER';
```

---

## 3. `frontend/src/features/modules/hooks/use-modules.ts` — actualizar check de permisos

```diff
-  const canManageModules = user?.role === 'OWNER';
+  // Solo SUPERADMIN gestiona módulos (desde su panel propio, no desde aquí)
+  const canManageModules = false;
```

> El widget de módulos dentro del tenant pasa a ser de solo lectura para todos. La gestión real ocurre en el panel SUPERADMIN.

---

## 4. `frontend/src/features/modules/components/module-list-widget.tsx` — actualizar textos

```diff
-  Solo el <strong>OWNER</strong> puede gestionar los módulos activos.
+  Los módulos activos son configurados por el equipo ChefChek.
```

```diff
-  Solo OWNER
+  Solo ChefChek
```

---

## 5. Nueva API client — `frontend/src/features/superadmin/api/superadmin-api.ts`

```typescript
import { apiClient } from '@/lib/api-client';

const BASE = '/v1/superadmin';

export async function listTenants(page = 1, limit = 20) {
  return apiClient.get(`${BASE}/tenants`, { params: { page, limit } });
}

export async function getTenantModules(tenantId: string) {
  return apiClient.get(`${BASE}/tenants/${tenantId}/modules`);
}

export async function toggleTenantModule(tenantId: string, moduleId: string, enabled: boolean) {
  return apiClient.patch(`${BASE}/tenants/${tenantId}/modules/${moduleId}`, { enabled });
}
```

---

## 6. Nueva página SUPERADMIN — `frontend/src/features/superadmin/pages/superadmin-dashboard-page.tsx`

Funcionalidad mínima:
- Lista de tenants con indicador de estado (`isActive`)
- Al seleccionar un tenant: lista sus módulos con toggle on/off
- Indicador visual de qué módulos están activos/inactivos por tenant

Estructura de componentes:
```
features/superadmin/
  pages/
    superadmin-dashboard-page.tsx
  components/
    tenant-list.tsx
    tenant-module-manager.tsx
  hooks/
    use-superadmin-tenants.ts
    use-tenant-modules.ts
  api/
    superadmin-api.ts
```

---

## 7. Ruta protegida para SUPERADMIN

En el router principal, añadir ruta que solo acepta `SUPERADMIN`:

```typescript
// Solo accesible para SUPERADMIN
<ProtectedRoute allowedRoles={['SUPERADMIN']}>
  <SuperadminDashboardPage />
</ProtectedRoute>
```

Y redirigir al SUPERADMIN a `/superadmin` tras login (en el auth context, detectar `role === 'SUPERADMIN'`).

---

## 8. Login SUPERADMIN — endpoint diferente

El SUPERADMIN no pasa `tenantSlug` en el login. Actualizar la función de login en el auth context:

```typescript
// Si el usuario no especifica tenant, intentar login como superadmin
async function loginAsSuperadmin(email: string, password: string) {
  return apiClient.post('/v1/auth/superadmin/login', { email, password });
}
```

Opción de UI: en la pantalla de login, añadir enlace "Acceso ChefChek" que lleva a un formulario simplificado (sin campo de tenant).

---

## Checklist

- [ ] `UserRole` y `api.types.ts` actualizados con `SUPERADMIN`
- [ ] `canManageModules` siempre `false` en `use-modules.ts`
- [ ] Textos del widget de módulos actualizados (sin mencionar OWNER)
- [ ] `superadmin-api.ts` creado con 3 funciones
- [ ] Página `SuperadminDashboardPage` implementada (lista tenants + toggle módulos)
- [ ] Ruta `/superadmin` protegida con `allowedRoles={['SUPERADMIN']}`
- [ ] Redirección post-login a `/superadmin` para rol SUPERADMIN
- [ ] Formulario de login SUPERADMIN (sin campo tenant) disponible en la UI
