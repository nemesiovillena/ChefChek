# Modernizar gestión de usuarios: foto, contacto y CRUD completo

## Estado
Completado y verificado en navegador (2026-07-06/07). Las 4 fases están
implementadas. Bug preexistente descubierto y corregido durante la
verificación: ver "Hallazgo" abajo.

## Corrección durante la ejecución: useConfirm() genérico reemplazó el diálogo bespoke
Mientras ejecutaba la Fase 4 (que creó `delete-user-dialog.tsx` copiando
`delete-articulo-dialog.tsx`), otra sesión concurrente reemplazó ese patrón
bespoke en TODA la app por un mecanismo genérico: `useConfirm()`
(`frontend/src/contexts/confirm.context.tsx`) + `ConfirmDialog`
(`frontend/src/components/ui/confirm-dialog.tsx`), montado una vez en
`app/layout.tsx`. `delete-articulo-dialog.tsx` fue eliminado. Se corrigió
`delete-user-dialog.tsx` de la misma forma: eliminado, y `page.tsx` ahora usa
`useConfirm()` + una `UserContextCard` local (idéntico al patrón
`ArticleContextCard` de `articulos/page.tsx`). Ver
[[m3-destructive-dialog-replaces-native-confirm]] en memoria del proyecto.

## Hallazgo durante la verificación (no estaba en el alcance original)
`frontend/src/lib/api-client.ts` fijaba `Content-Type: application/json`
como header por defecto de la instancia axios. Al subir un archivo
(`FormData`), axios no sobreescribía ese header explícito, así que
serializaba el `FormData` a `"{}"` y lo mandaba como JSON — el backend
recibía "sin archivo" y devolvía 400. Esto afectaba a **todas** las subidas
de imagen de la app (avatar de usuario nuevo, pero también
`upload-image` de Artículos y Recetas, silenciosamente rotas en el
navegador real aunque `curl` funcionaba). Corregido borrando el header
`Content-Type` cuando `config.data instanceof FormData`, dejando que el
navegador calcule el boundary multipart. Verificado con subida real en
navegador tras el fix (201, preview visible).

## Contexto
Origen: usuario reporta que no hay campo de imagen al crear/editar un usuario.
La página `dashboard/users` no tenía formulario de edición (solo crear +
activar/desactivar) y estaba en un estilo legacy (fetch crudo, Tailwind
plano) muy distinto al de Artículos/Recetas (hooks react-query, modal, tabla
con acciones editar/eliminar). El usuario decidió (2026-07-07) modernizar
toda la página al estilo Artículos/Recetas en el mismo plan.

Alcance final (2026-07-07, todo confirmado en un solo plan):
- **avatarUrl** — foto de perfil (petición original).
- **street, city** — dirección (calle, ciudad).
- **phone, whatsapp** — mismo patrón que `Supplier.phone`/`Supplier.whatsapp`;
  checkbox de UI "usar el mismo para WhatsApp" (no persiste el checkbox,
  solo copia el valor al enviar).
- **payrollEmail** — email de nóminas, **campo distinto** al email de login
  (el usuario puede querer enviar nóminas a un correo diferente del que usa
  para entrar a la app).
- **CRUD completo**: crear, editar, eliminar (soft-delete) usuarios.

## Decisiones confirmadas (2026-07-07)
- **Eliminar usuario** es una acción CRUD normal: botón "Eliminar" en la
  tabla con diálogo de confirmación M3 (Radix Dialog, patrón
  `delete-articulo-dialog.tsx` — el proyecto ya retiró `confirm()` nativo de
  Artículos por este motivo; se replica igual para usuarios, **NO** usar
  `confirm()`). Backend ya soporta esto (`DELETE /api/v1/users/:id`, soft-delete
  vía `deletedAt`, `"user"` ya está en `modelsWithSoftDelete` de
  `prisma.service.ts:5`) — sin cambios backend, solo cablear el botón.
- **El usuario creado pertenece al tenant del admin que lo crea** —
  contemplado en Fase 3 (`tenantId: currentTenantId` de `useAuth().tenantId`),
  y el backend ya lo valida (`users.service.ts:33-35`, 403 si no coincide).
- **street/city/phone/whatsapp/payrollEmail son todos opcionales** (`String?`
  nullable) — ningún dato existente se rompe, ningún formulario los exige.
- **payrollEmail es un campo aparte**, no reutiliza el email de login (a
  diferencia de lo que se especuló inicialmente) — el usuario puede tener
  cuentas donde el email de acceso y el de nóminas difieran.

## Fases
1. [Backend: avatarUrl + contacto + endpoint de subida](phase-01-backend-avatar.md)
2. [Frontend: hooks use-users.ts](phase-02-frontend-hooks.md)
3. [Frontend: modal crear/editar usuario](phase-03-frontend-modal.md)
4. [Frontend: reescribir dashboard/users/page.tsx](phase-04-frontend-page.md)

## Dependencias
Fase 1 → 2 → 3 → 4 (secuencial, cada fase consume la anterior).

## Criterios de aceptación
- Migración Prisma aplicada: `User.avatarUrl`, `street`, `city`, `phone`,
  `whatsapp`, `payrollEmail` (todos `String?`).
- `POST /api/v1/users/upload-avatar` sube imagen (jpeg/png/webp/gif, máx 2MB)
  a `uploads/users/` y devuelve `{ url }`, igual que products/recipes.
- Crear usuario funciona de punta a punta (incluye `tenantId` que hoy falta
  en el payload del frontend legacy — bug preexistente que bloquea "crear"
  con el `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
  actual).
- Editar usuario (nuevo formulario) permite cambiar nombre, email, rol,
  estado, foto, dirección (calle/ciudad), teléfono/WhatsApp (con checkbox
  "mismo número") y email de nóminas; no exige contraseña para editar.
- Tabla de usuarios muestra avatar (o iniciales si no hay foto); botón
  editar abre el modal con los datos cargados; botón eliminar abre el
  diálogo M3 de confirmación y borra (soft-delete) el usuario.
- No es posible eliminar ni desactivar el propio usuario autenticado (guard
  ya existente en `handleToggleStatus`, replicado en `handleDelete`).
- `tsc --noEmit` del frontend sin errores nuevos; tests backend de
  `users.service.spec.ts` para los nuevos campos/endpoint pasan.

## Riesgos / rollback
- Migración Prisma es aditiva (todos los campos nuevos `String?` nullable) —
  sin riesgo de romper filas existentes; rollback = nueva migración que
  dropea las columnas.
- Reescribir `page.tsx` reemplaza código legacy funcional (activar/desactivar
  ya funciona) — verificar manualmente esa acción sigue funcionando tras el
  cambio (ahora vía `useUpdateUser` en vez de `fetch` crudo).
- Formulario con más campos (foto, dirección, contacto, nóminas) — mantener
  un solo formulario plano sin tabs (5-9 campos no justifica un sistema de
  tabs como el de Artículos: YAGNI).
