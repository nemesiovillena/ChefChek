---
phase: 4
title: "Fase 4 - UI Update"
status: pending
effort: 2h
priority: P1
dependencies: [1, 2]
---

# Phase 4: UI Update

## Overview

Actualizar frontend en `/dashboard/settings` para reflejar nuevas reglas de acceso. Switches disabled para no-OWNER. Mensajes claros de permisos.

## Requirements

**Functional:**
- Switches deshabilitados para Admin/User/Viewer
- Badge/tooltip: "Solo el OWNER puede modificar"
- Mensaje toast si intento no autorizado (403)
- OWNER ver switches enabled normales

**Non-functional:**
- Cambio no afecta performance
- UX claro sin confusiones

## Architecture

```tsx
// Componente ModuleSwitch
const canManageModules = user.role === 'OWNER';

<Switch
  checked={module.enabled}
  disabled={!canManageModules}
  onCheckedChange={() => toggleModule(module.id)}
/>

{!canManageModules && (
  <Tooltip content="Solo el OWNER puede gestionar módulos">
    <InfoIcon />
  </Tooltip>
)}
```

## Related Code Files

| Acción | Archivo |
|--------|---------|
| Modify | `frontend/src/app/dashboard/settings/page.tsx` |
| Modify | `frontend/src/features/modules/api/modules-api.ts` (error handling) |
| Modify | `frontend/src/hooks/use-modules.ts` (permissions check) |

## Implementation Steps

1. **Añadir role check en useModules hook**
   ```typescript
   // frontend/src/hooks/use-modules.ts
   export function useModules() {
     const { user } = useAuth();
     const canManageModules = user?.role === 'OWNER';

     return { modules, toggleModule, canManageModules };
   }
   ```

2. **Actualizar settings page**
   ```tsx
   // frontend/src/app/dashboard/settings/page.tsx
   const { modules, toggleModule, canManageModules } = useModules();

   {/* Module list */}
   {modules.map((module) => (
     <ModuleCard key={module.id}>
       <Switch
         checked={module.enabled}
         disabled={!canManageModules}
         onCheckedChange={() => toggleModule(module.id)}
       />
       {!canManageModules && <LockIcon />}
     </ModuleCard>
   ))}

   {/* Banner para no-OWNER */}
   {!canManageModules && (
     <Banner>
       Solo el OWNER puede gestionar los módulos activos.
       Contacta al administrador del tenant.
     </Banner>
   )}
   ```

3. **Error handling 403**
   ```typescript
   // frontend/src/features/modules/api/modules-api.ts
   try {
     await toggleModule(id, enabled);
   } catch (error) {
     if (error.response?.status === 403) {
       toast.error('Solo el OWNER puede gestionar módulos');
     }
   }
   ```

4. **Tests E2E**
   - Test Admin ve switches disabled
   - Test OWNER puede toggle módulos
   - Test 403 muestra toast correcto

## Success Criteria

- [ ] Switches disabled para no-OWNER
- [ ] Badge tooltip claro visible
- [ ] Banner informativo en settings
- [ ] 403 muestra toast en español
- [ ] E2E tests pasan

## Risk Assessment

| Risk | Probabilidad | Impacto | Mitigación |
|------|-------------|---------|------------|
| Switch UI confuso | Bajo | Bajo | Icono + tooltip claros |
| Error 403 no manejado | Medio | Bajo | Try-catch en todos toggles |

## Rollback

- Quitar `disabled={...}` de Switches
- Quitar banner
- Quitar error handling 403

---

**Archivos críticos:**
- `frontend/src/app/dashboard/settings/page.tsx`
- `frontend/src/hooks/use-modules.ts` (crear si no existe)