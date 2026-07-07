# Fase 2 — Frontend: hooks `use-users.ts`

## Contexto
No existe `frontend/src/hooks/use-users.ts`. Replicar exactamente el patrón
de `frontend/src/hooks/use-products.ts` (usa `useCrud` de `use-api.ts`, ya
genérico para list/get/create/update/delete con invalidación de queries).

## Archivos a crear
- `frontend/src/hooks/use-users.ts`

## Archivos a leer antes de implementar
- `frontend/src/hooks/use-products.ts` (patrón completo a espejar)
- `frontend/src/hooks/use-api.ts:103-177` (`useCrud`, `useApiMutation`)
- `frontend/src/lib/api-client.ts:82-110` (unwrapping de `{success,data}` y `{success,data,meta}` — confirma que `useCreate`/`useUpdate` reciben el objeto ya desenvuelto, sin `.data.data`)
- `backend/src/modules/users/dto/create-user.dto.ts` (campos válidos del DTO tras fase 1)

## Pasos

1. Definir tipos (mirroring `Product`/`CreateProductData` en use-products.ts):
   ```ts
   export interface User {
     id: string;
     email: string;
     name: string;
     role: 'ADMIN' | 'USER' | 'VIEWER';
     isActive: boolean;
     avatarUrl?: string;
     street?: string;
     city?: string;
     phone?: string;
     whatsapp?: string;
     payrollEmail?: string;
     createdAt: string;
     updatedAt: string;
   }

   export interface CreateUserData {
     tenantId: string;
     email: string;
     password: string;
     name: string;
     role?: 'ADMIN' | 'USER' | 'VIEWER';
     isActive?: boolean;
     avatarUrl?: string;
     street?: string;
     city?: string;
     phone?: string;
     whatsapp?: string;
     payrollEmail?: string;
   }

   export interface UpdateUserData extends Partial<Omit<CreateUserData, 'tenantId'>> {
     id: string;
   }
   ```
   Nota: `password` en `UpdateUserData` debe quedar opcional (heredado de
   `Partial`) — el backend (`users.service.ts:176-179`) ya solo hashea si
   viene presente, no es obligatorio en edición.

2. Instanciar CRUD:
   ```ts
   const { useList, useGet, useCreate, useUpdate, useDelete } =
     createCrudHooks<User, CreateUserData, UpdateUserData>('/v1/users', ['users']);

   export function useUsers(page = 1, pageSize = 50) {
     return useList(page, pageSize);
   }
   export function useUser(id: string) {
     return useGet(id);
   }
   export function useCreateUser() {
     return useCreate();
   }
   export function useUpdateUser() {
     return useUpdate();
   }
   export function useDeleteUser() {
     return useDelete();
   }
   export function useUploadUserAvatar() {
     return useApiMutation<{ avatarUrl: string }, FormData>('/v1/users/upload-avatar', 'POST');
   }
   ```
   (import `useCrud as createCrudHooks, useApiMutation` desde `./use-api`, igual que use-products.ts línea 1)

3. **No** implementar paginación custom ni filtros — `useUsers()` sin args
   basta (el listado de usuarios de un tenant es pequeño, YAGNI aplicado:
   no replicar los filtros de fecha/categoría de Artículos que no aplican
   a usuarios).

## Tests
- No hay test runner de hooks en este proyecto (verificar; si no hay
  precedente de test para `use-products.ts`, no crear uno nuevo aquí —
  seguir la convención existente).

## Riesgos
- Ninguno: archivo nuevo, no toca código existente.
