# Fase 3 — Frontend: modal crear/editar usuario

## Contexto
Replicar la estructura de `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx`
(componente exterior con `if (!isOpen) return null` + remount con `key`,
componente interno `*Form` con los hooks) y el patrón de subida de imagen de
`frontend/src/app/dashboard/articulos/components/tab-alergenos.tsx:81-105`
(input file oculto + botón + preview con `next/image`).

No hay tabs para usuario (a diferencia de Artículos) — un solo formulario
simple con secciones visuales (no tabs) para: cuenta (email/password/rol/
estado), foto, dirección (calle/ciudad), contacto (teléfono/WhatsApp) y
nóminas (payrollEmail).

Nota: el diálogo de **eliminar** usuario (`delete-user-dialog.tsx`) es un
componente aparte, construido en la Fase 4 replicando
`delete-articulo-dialog.tsx` — no mezclar esa lógica en este modal de
crear/editar.

## Archivos a leer antes de implementar
- `frontend/src/app/dashboard/articulos/components/articulo-modal.tsx` (estructura completa)
- `frontend/src/app/dashboard/articulos/components/tab-alergenos.tsx:1-108` (patrón subida imagen)
- `frontend/src/components/notification-system.tsx` (o donde viva `useNotification`, confirmar API exacta: `addNotification({type,title,message})`)
- `frontend/src/hooks/use-users.ts` (de fase 2)

## Archivos a crear
- `frontend/src/app/dashboard/users/components/user-modal.tsx`

## Pasos

1. Props: `{ isOpen, onClose, targetUser?: User | null, currentTenantId: string }`.
   `currentTenantId` viene de `useAuth()` en el padre (fase 4) — se necesita
   para `CreateUserData.tenantId` (campo requerido por `CreateUserDto`, hoy
   ausente en el legacy `page.tsx`, causa raíz de que "crear usuario" esté
   roto con `forbidNonWhitelisted: true`).

2. Estado del formulario (derivado del `targetUser` igual que `deriveFormData`
   en articulo-modal.tsx):
   ```ts
   const [formData, setFormData] = useState(() => ({
     email: targetUser?.email ?? '',
     name: targetUser?.name ?? '',
     password: '',
     role: targetUser?.role ?? 'USER',
     isActive: targetUser?.isActive ?? true,
     street: targetUser?.street ?? '',
     city: targetUser?.city ?? '',
     phone: targetUser?.phone ?? '',
     whatsapp: targetUser?.whatsapp ?? '',
     payrollEmail: targetUser?.payrollEmail ?? '',
   }));
   const [avatarUrl, setAvatarUrl] = useState(() => targetUser?.avatarUrl ?? '');
   const [samePhoneForWhatsapp, setSamePhoneForWhatsapp] = useState(
     () => !!targetUser && !!targetUser.phone && targetUser.phone === targetUser.whatsapp,
   );
   ```
   `password` vacío + no requerido en edición (solo requerido si `!targetUser`).

2b. Checkbox "Usar el mismo número para WhatsApp" (decisión ya tomada:
   `phone`/`whatsapp` son campos independientes en el modelo; el checkbox es
   puramente de UI, no se persiste como tal — solo determina si al escribir
   en `phone` se copia a `whatsapp`):
   ```tsx
   <input
     type="checkbox"
     checked={samePhoneForWhatsapp}
     onChange={(e) => {
       setSamePhoneForWhatsapp(e.target.checked);
       if (e.target.checked) {
         setFormData((f) => ({ ...f, whatsapp: f.phone }));
       }
     }}
   />
   ```
   Si `samePhoneForWhatsapp` está activo, el input de `phone` también debe
   actualizar `whatsapp` en su `onChange`; si el usuario desmarca el
   checkbox, el campo `whatsapp` queda editable de forma independiente
   (no se borra el valor ya copiado).

3. Subida de avatar — copiar `handleImageUpload` de articulo-modal.tsx:143-152
   y el bloque de UI de tab-alergenos.tsx:81-105 (input oculto + botón +
   `<Image>` de preview), ajustando el hook a `useUploadUserAvatar()` y el
   límite/mensaje a 2MB.

4. `handleSubmit`:
   - Validar `email`, `name` no vacíos; si `!targetUser`, validar `password`
     (mínimo 8 caracteres, igual que el legacy `minLength={8}`).
   - Campos opcionales (`street`, `city`, `phone`, `whatsapp`, `payrollEmail`)
     se envían como `|| undefined` si vacíos, igual que `avatarUrl` — no
     mandar strings vacíos al backend.
   - Si `!targetUser`: `createMutation.mutateAsync({ tenantId: currentTenantId, email, password, name, role, isActive, avatarUrl: avatarUrl || undefined, street: street || undefined, city: city || undefined, phone: phone || undefined, whatsapp: whatsapp || undefined, payrollEmail: payrollEmail || undefined })`.
   - Si `targetUser`: mismo objeto sin `tenantId`/`password` obligatorios, con `id: targetUser.id` y `...(password ? { password } : {})`.
   - `onSuccess`: `addNotification({type:'success', ...})`, `onClose()`.
   - `onError`: `addNotification({type:'error', title:'Error', message: err.message})` (no `catch {}` silencioso — regla ya establecida en el proyecto para albaranes, aplica igual aquí).

5. Overlay/backdrop: copiar el markup del wrapper de `articulo-modal.tsx`
   (buscar el `return (` del componente `*Form`, el div fixed inset-0 con
   backdrop) para mantener consistencia visual — no reinventar estilos.

## Tests
- Verificación manual en navegador (no hay test runner de componentes en
  este proyecto por lo visto en use-products.ts): crear usuario con foto,
  dirección, teléfono/WhatsApp (probar el checkbox "mismo número") y email
  de nóminas; editar usuario existente cambiando cualquiera de esos campos;
  editar sin tocar password (confirmar que no se sobreescribe con vacío —
  backend ya lo maneja en `users.service.ts:176-179` pero confirmar que el
  frontend no envía `password: ''`).

## Riesgos
- Si `currentTenantId` es `null` (edge case: sesión SUPERADMIN sin tenant),
  el botón "Crear" debe deshabilitarse — SUPERADMIN no gestiona usuarios de
  tenant desde esta pantalla (confirmar con guard existente `@Roles("ADMIN")`,
  que ya excluye SUPERADMIN de este flujo per `create-user.dto.ts` line 26-30
  en el service, que rechaza explícitamente crear un SUPERADMIN).
