# Fase 4 — Frontend: reescribir `dashboard/users/page.tsx`

## Contexto
Reemplaza el `page.tsx` legacy (fetch crudo a `sessionStorage`, sin edición,
sin hooks) por el patrón de `frontend/src/app/dashboard/articulos/page.tsx`
(hooks react-query + modal + tabla con acciones editar/eliminar). Mantiene el
toggle activar/desactivar que ya funciona, pero migrado a `useUpdateUser` en
vez de `fetch` crudo.

**Sí se añade botón "Eliminar usuario"** (decisión confirmada en `plan.md`):
CRUD completo. El backend ya soporta `DELETE /api/v1/users/:id` con
soft-delete — sin cambios backend, solo cablear `useDeleteUser()` (Fase 2).

**Importante — patrón de confirmación actualizado**: el proyecto ya
reemplazó el `confirm()` nativo por un diálogo M3 (Radix Dialog) en Artículos
(`delete-articulo-dialog.tsx`, memoria: "sustituye al confirm() del
navegador... extender a albaranes/QR"). Este plan sigue esa misma línea: se
crea `delete-user-dialog.tsx` en vez de usar `confirm()`. No usar `confirm()`
nativo en ningún paso de esta fase.

## Archivos a leer antes de implementar
- `frontend/src/app/dashboard/articulos/page.tsx` (estructura de tabla, handleEdit, `deleteTarget` state + `confirmDelete`, modal wiring — no copiar filtros de fecha/categoría/export CSV, no aplican a usuarios: YAGNI)
- `frontend/src/app/dashboard/articulos/components/delete-articulo-dialog.tsx` (patrón M3 exacto a replicar para `delete-user-dialog.tsx`)
- `frontend/src/app/dashboard/users/page.tsx` (versión actual a reemplazar — conservar `handleToggleStatus` con su guard "no puedes desactivar tu propio usuario")
- `frontend/src/hooks/use-users.ts` (fase 2)
- `frontend/src/app/dashboard/users/components/user-modal.tsx` (fase 3)
- `frontend/src/contexts/auth.context.tsx` (confirmar shape de `useAuth()`: `user`, `isLoading`, `isAuthenticated`, `tenantId`)

## Archivos a crear
- `frontend/src/app/dashboard/users/components/delete-user-dialog.tsx`
  (copiar `delete-articulo-dialog.tsx` casi literal: mismo layout M3, ícono
  `Trash2` en `error-container`, tarjeta de contexto con avatar circular en
  vez de imagen de producto — usar `user.avatarUrl` o iniciales si no hay
  foto — y meta = rol + email en vez de categoría + precio)

## Archivos a modificar
- `frontend/src/app/dashboard/users/page.tsx` (reescritura completa)

## Pasos

1. Reemplazar fetch crudo por hooks:
   ```ts
   const { user, tenantId, isLoading, isAuthenticated } = useAuth();
   const { data: usersData, isLoading: usersLoading } = useUsers();
   const users: User[] = Array.isArray(usersData?.data) ? usersData.data : [];
   const updateMutation = useUpdateUser();
   const deleteMutation = useDeleteUser();
   ```
   Eliminar `fetchUsers`, `sessionStorage.getItem('session_id'/'tenant_slug')`
   manual y el `fetch('http://localhost:3001/...')` hardcodeado — `apiClient`
   (usado por los hooks) ya centraliza base URL, headers de sesión/tenant.

2. Estado de modal y de borrado (`deleteTarget`, no un booleano — sigue el
   patrón de `articulos/page.tsx`, la tarjeta de contexto del diálogo
   necesita el objeto completo):
   ```ts
   const [showModal, setShowModal] = useState(false);
   const [selectedUser, setSelectedUser] = useState<User | null>(null);
   const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
   const handleEdit = (u: User) => { setSelectedUser(u); setShowModal(true); };
   const handleCreate = () => { setSelectedUser(null); setShowModal(true); };
   ```

3. `handleToggleStatus`: mismo guard (`targetUser.id === user?.id` → alert
   "No puedes desactivar tu propio usuario"), pero usando
   `updateMutation.mutateAsync({ id: targetUser.id, isActive: !targetUser.isActive })`
   + `addNotification` de éxito/error (copiar el bloque try/catch de
   `articulos/page.tsx:229-240`) en vez de `fetch` + `sessionStorage` manual.

3b. `handleDelete` / `confirmDelete` (nuevo, mismo guard de auto-protección
   que el toggle, y mismo patrón de `articulos/page.tsx:210-227` con el
   diálogo M3 en vez de `confirm()`):
   ```ts
   const handleDelete = (targetUser: User) => {
     if (targetUser.id === user?.id) {
       alert('No puedes eliminar tu propio usuario.');
       return;
     }
     setDeleteTarget(targetUser);
   };

   const confirmDelete = async () => {
     if (!deleteTarget) return;
     try {
       await deleteMutation.mutateAsync(deleteTarget.id);
       addNotification({ type: 'success', title: 'Usuario eliminado', message: `"${deleteTarget.name}" se ha eliminado correctamente.` });
       setDeleteTarget(null);
     } catch (error: unknown) {
       addNotification({ type: 'error', title: 'No se pudo eliminar', message: error instanceof Error ? error.message : 'Error al eliminar el usuario' });
     }
   };
   ```
   Renderizar `<DeleteUserDialog user={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} onConfirm={confirmDelete} isDeleting={deleteMutation.isPending} />`
   junto al `UserModal`, igual que `articulos/page.tsx` monta
   `DeleteArticuloDialog`.

4. Tabla: añadir columna avatar (miniatura circular 32px con `next/image` si
   `user.avatarUrl`, si no iniciales del nombre en un círculo — buscar si
   existe ya un componente `Avatar`/iniciales reutilizable en
   `frontend/src/components/` antes de crear uno nuevo) + botones "Editar"
   (`<Pencil>`) y "Eliminar" (`<Trash2>`, dispara `handleDelete`, NO borra
   directo) de `lucide-react`, mismos íconos que Artículos, junto al botón
   de estado existente.

5. Botón "Crear Usuario" del header abre el modal (`handleCreate`) en vez de
   alternar un formulario inline (`showCreateForm`) — elimina ese patrón
   legacy, reemplaza por el modal de fase 3.

6. Pasar `currentTenantId={tenantId}` al `UserModal`.

## Tests
- Verificación manual en navegador (dev server): listar usuarios, crear uno
  nuevo con foto, editarlo (cambiar rol y foto), activar/desactivar,
  eliminar un usuario de prueba (confirmar que desaparece del listado —
  soft-delete, `deletedAt` seteado, no debe reaparecer), confirmar que el
  propio usuario no puede desactivarse ni eliminarse.
- `tsc --noEmit` en `frontend/` sin errores nuevos.

## Riesgos / rollback
- Esto reemplaza código legacy que ya funciona parcialmente (toggle status).
  Antes de dar la fase por cerrada, probar manualmente ese toggle en el
  navegador — regla del proyecto (`primary-workflow.md` §3 Verify) exige
  correr focused tests / probar el flujo tocado, no solo compilar.
- Si algo falla, el archivo anterior está en git (`git diff` / `git checkout --
  frontend/src/app/dashboard/users/page.tsx` revierte, no se pierde nada
  porque es un solo archivo versionado).
