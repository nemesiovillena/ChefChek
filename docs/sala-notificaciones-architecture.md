# Arquitectura: Notificaciones de Sala (Kanban)

## Resumen

Módulo de comunicación entre sala (front-of-house) y cocina (back-of-house) mediante un sistema CRUD de tareas con tablero Kanban. Sala registra reservas, menús y encargos que cocina visualiza en un tablero interactivo con drag-and-drop por estados (Pendiente/En curso/Completado). Card resumen en el dashboard principal muestra tareas activas; la vista completa ofrece un Kanban multi-columna con reordenamiento prioritario por columna.

**Activación:** Módulo gateado `sala-notificaciones` desactivado por defecto — requiere activación manual por superadmin por tenant.

## Arquitectura del Sistema

```
Notificaciones de Sala
├── Backend (NestJS)
│   ├── Model: SalaTask (Prisma)
│   ├── Controller: POST/GET/PATCH/DELETE /api/v1/sala-tasks
│   ├── Service: CRUD + Reorder + Soft-delete
│   ├── DTOs: Create/Update/Reorder validación
│   └── Guards: AuthGuard + TenantGuard + ModuleGuard
│
├── Frontend (React/Next.js)
│   ├── Hook: useSalaTasks (React Query)
│   ├── Dashboard Card: resumen de tareas activas (PENDIENTE/EN_CURSO)
│   ├── Full-page Kanban: /dashboard/sala-notificaciones
│   │   ├── SalaTaskColumn (droppable, @dnd-kit)
│   │   ├── SalaTaskCard (draggable, @dnd-kit)
│   │   └── Reorder mutations optimistas
│   └── Modal: SalaTaskModal (crear/editar/borrar)
│
└── Multi-tenancy & Gating
    ├── MODULE_REGISTRY: sala-notificaciones (defaultEnabled: false)
    ├── Nav-config: ROUTE_MODULE_MAP + NAV_GROUPS
    └── Module Guard: bloquea acceso si tenant no activa el módulo
```

## Modelo de Datos

### SalaTask (tabla `sala_tasks`)

| Campo | Tipo | Descripción | Requerido |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Identificador único | ✓ |
| `tenantId` | String (FK) | Scoping multi-tenant | ✓ |
| `title` | String | Título de la tarea (reserva, encargo, menú) | ✓ |
| `eventDate` | DateTime | Fecha del evento/servicio | ✓ |
| `guestCount` | Int? | Número de comensales | |
| `customerName` | String? | Nombre del cliente | |
| `customerPhone` | String? | Teléfono de contacto | |
| `customerEmail` | String? | Email de contacto | |
| `menuNotes` | Text? | Texto libre: menú, encargo, notas | |
| `observations` | Text? | Observaciones adicionales | |
| `allergies` | Text? | Información de alergias | |
| `status` | String | `PENDIENTE` \| `EN_CURSO` \| `COMPLETADO` (default: `PENDIENTE`) | ✓ |
| `sortOrder` | Int | Orden dentro de la columna (0+, sin gaps) | ✓ |
| `createdBy` | String (FK User) | Usuario que creó | ✓ |
| `createdAt` | DateTime | Timestamp creación | ✓ |
| `updatedAt` | DateTime | Timestamp última actualización | ✓ |
| `deletedAt` | DateTime? | Soft-delete (null = activo) | |

**Índices:**
- `(tenantId, status, sortOrder)` — búsqueda rápida por tenant/columna

## API REST

### POST /api/v1/sala-tasks
**Crear nueva tarea.** Nueva entra al final de su columna.

```bash
curl -X POST https://api.chefchek.local/api/v1/sala-tasks \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Reserva: Boda García",
    "eventDate": "2026-09-15T20:00:00Z",
    "guestCount": 80,
    "customerName": "María García",
    "customerPhone": "+34 600 123 456",
    "customerEmail": "maria@example.com",
    "menuNotes": "Menú gastronómico de 4 platos + maridaje",
    "observations": "Cliente VIP, alergias múltiples",
    "allergies": "Frutos secos, marisco",
    "status": "PENDIENTE"
  }'
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "cuid123abc",
    "tenantId": "tenant-id",
    "title": "Reserva: Boda García",
    "eventDate": "2026-09-15T20:00:00Z",
    "guestCount": 80,
    "customerName": "María García",
    "customerPhone": "+34 600 123 456",
    "customerEmail": "maria@example.com",
    "menuNotes": "Menú gastronómico de 4 platos + maridaje",
    "observations": "Cliente VIP, alergias múltiples",
    "allergies": "Frutos secos, marisco",
    "status": "PENDIENTE",
    "sortOrder": 0,
    "createdBy": "user-id",
    "createdAt": "2026-08-29T10:30:00Z",
    "updatedAt": "2026-08-29T10:30:00Z"
  }
}
```

### GET /api/v1/sala-tasks
**Listar todas las tareas (no-borradas).** Ordenadas por `status` ASC, luego `sortOrder` ASC.

```bash
curl -X GET https://api.chefchek.local/api/v1/sala-tasks \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante"
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid123abc",
      "title": "Reserva: Boda García",
      "status": "PENDIENTE",
      "sortOrder": 0,
      "eventDate": "2026-09-15T20:00:00Z",
      ...
    }
  ]
}
```

### GET /api/v1/sala-tasks/:id
**Obtener detalle de una tarea.**

```bash
curl -X GET https://api.chefchek.local/api/v1/sala-tasks/cuid123abc \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante"
```

**Response 200:** Objeto SalaTask completo.

**Errores:**
- `404 Not Found` — Tarea no existe o no pertenece a este tenant

### PATCH /api/v1/sala-tasks/:id
**Actualizar tarea.** Solo campos proporcionados.

```bash
curl -X PATCH https://api.chefchek.local/api/v1/sala-tasks/cuid123abc \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "EN_CURSO",
    "observations": "Cocina iniciando preparación"
  }'
```

**Response 200:** Objeto SalaTask actualizado.

### PATCH /api/v1/sala-tasks/reorder
**Reordenar múltiples tareas (cambio de columna y sortOrder).** Usado por el Kanban tras drag-and-drop.

```bash
curl -X PATCH https://api.chefchek.local/api/v1/sala-tasks/reorder \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "id": "cuid1", "status": "EN_CURSO", "sortOrder": 0 },
      { "id": "cuid2", "status": "EN_CURSO", "sortOrder": 1 },
      { "id": "cuid3", "status": "PENDIENTE", "sortOrder": 0 }
    ]
  }'
```

**Response 200:** `{ "success": true }`

### DELETE /api/v1/sala-tasks/:id
**Eliminar (soft-delete) una tarea.**

```bash
curl -X DELETE https://api.chefchek.local/api/v1/sala-tasks/cuid123abc \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Slug: mi-restaurante"
```

**Response 200:** `{ "success": true }`

## Frontend: Hooks & Componentes

### Hook: `useSalaTasks()`

```typescript
const { data: tasks, isLoading } = useSalaTasks();
```

Trae todas las tareas (no-borradas) ordenadas por status/sortOrder.

### Hook: `useCreateSalaTask()`

```typescript
const createTask = useCreateSalaTask();
await createTask.mutateAsync({
  title: "Reserva",
  eventDate: "2026-09-15T20:00:00Z",
  guestCount: 20,
  // ... resto de campos opcionales
});
```

Invalidates cache key `['sala-tasks']` al completar.

### Hook: `useUpdateSalaTask()`

```typescript
const updateTask = useUpdateSalaTask();
await updateTask.mutateAsync({
  id: "cuid123",
  status: "EN_CURSO",
  observations: "Iniciado"
});
```

### Hook: `useDeleteSalaTask()`

```typescript
const deleteTask = useDeleteSalaTask();
await deleteTask.mutateAsync("cuid123");
```

### Hook: `useReorderSalaTasks()`

```typescript
const reorder = useReorderSalaTasks();
await reorder.mutateAsync([
  { id: "cuid1", status: "PENDIENTE", sortOrder: 0 },
  { id: "cuid2", status: "PENDIENTE", sortOrder: 1 }
]);
```

### Componente: Dashboard Card

**Ubicación:** `frontend/src/app/dashboard/page.tsx`

Muestra resumen de tareas en estados `PENDIENTE` y `EN_CURSO`. Botón "Ver todas" navega a `/dashboard/sala-notificaciones`.

### Componente: Full-page Kanban

**Ruta:** `/dashboard/sala-notificaciones` (page.tsx)

- **3 columnas fijas:** Pendiente, En curso, Completado
- **Drag-and-drop multi-contenedor:** Usa `@dnd-kit` con `DndContext`, `useDroppable`, `useSortable`
- **Reordenamiento optimista:** `sortOrder` se reescribe en el cache antes de mutar (evita snap-back visual)
- **Mutikey column drop:** Soltar una card sobre columna vacía agrega al final

**Sensores:**
- Mouse: distancia de activación 8px
- Touch: delay 200ms, tolerance 8px

### Componente: SalaTaskModal

**Ubicación:** `frontend/src/components/sala-tasks/sala-task-modal.tsx`

Modal compartido para crear/editar/borrar. Props:

```typescript
interface SalaTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: SalaTask | null; // null = crear nuevo
}
```

## Gating: Módulo `sala-notificaciones`

### Registro de Módulo

Backend (`backend/src/modules/modules/constants/registry.ts`):

```typescript
{
  id: "sala-notificaciones",
  name: "Notificaciones de Sala",
  description: "Reservas, menús y encargos que sala comunica a cocina (tablero Kanban)",
  dependencies: [],
  alwaysActive: false,
  defaultEnabled: false,
}
```

**Implicaciones:**
- `defaultEnabled: false` → Nuevos tenants no tienen acceso sin activación manual
- Sin dependencias de otros módulos
- Superadmin activa/desactiva por tenant vía API de módulos

### Route Gating

Frontend (`frontend/src/features/modules/lib/nav-config.ts`):

**Navigation:**
```typescript
{
  label: 'Notificaciones de Sala',
  href: '/dashboard/sala-notificaciones',
  moduleId: 'sala-notificaciones',
  icon: 'event_note',
}
```

**Route Blocking:**
```typescript
{ prefix: '/dashboard/sala-notificaciones', moduleId: 'sala-notificaciones' }
```

Si tenant no tiene módulo activo:
- Enlace oculto en nav
- Acceso directo a URL redirige a `/dashboard`

### Backend Guard

Controller (`backend/src/modules/sala-tasks/sala-tasks.controller.ts`):

```typescript
@UseGuards(AuthGuard, TenantGuard, ModuleGuard)
@RequireModule("sala-notificaciones")
export class SalaTasksController { ... }
```

API rechaza requests si tenant no activa el módulo.

## Decisiones de Diseño

1. **Nombre técnico `SalaTask` vs nombre visible "Notificaciones de Sala"**
   - Evita colisión con modelo `Task` del sprint-tracker (dominio distinto)
   - UI muestra nombre visible para usuarios

2. **3 columnas fijas, sin "Cancelado"**
   - Confirmado por usuario: tareas canceladas se borran (soft-delete), no necesitan estado aparte
   - Simplifica lógica de Kanban

3. **Prioridad = posición en columna (`sortOrder`), no campo numérico**
   - Coherente con `ProductionOrder.sortOrder`
   - Drag-and-drop intuitivo

4. **Menu libre (texto) sin enlace a Menú catálogo**
   - Usuario pidió textarea de texto libre, no selector
   - Futura integración a menús estructurados es iteración posterior

5. **Soft-delete obligatorio**
   - Mandato de proyecto: zero data loss
   - `deletedAt IS NULL` en todas las queries

6. **Card dashboard muestra solo PENDIENTE/EN_CURSO**
   - Completadas no caben en vista resumida
   - Usuario navega a Kanban para ver todo

7. **Módulo gateado, desactivado por defecto**
   - Permite tenants optar por la feature
   - No asume todos usan sala-notificaciones

## Comportamientos Notables

### Reordenamiento Multi-columna (@dnd-kit)

1. Drag desde columna A hacia columna B
2. Frontend calcula nueva posición y status en memoria
3. **Reescribe `sortOrder` en cache ANTES de mutar** (previene snap-back)
4. Mutación optimista al servidor
5. Servidor actualiza status y sortOrder atómicamente en tx

### Nueva Tarea entra al final de su columna

```typescript
const last = await prisma.salaTask.findFirst({
  where: { tenantId, status: dto.status ?? 'PENDIENTE', deletedAt: null },
  orderBy: { sortOrder: 'desc' }
});
newSortOrder = (last?.sortOrder ?? -1) + 1;
```

Sin re-secuenciar columnas enteras (YAGNI).

### Soft-delete Transparente

Todas las queries:
```sql
WHERE tenantId = ? AND deletedAt IS NULL
```

Nunca borra físico.

## Limitaciones Conocidas (v1)

1. **No incluido en Papelera (trash module)** — intencionalmente excluido de módulo papelera-global para v1 (requeriría UI adicional, no priorizado aún)
2. **No probado drag-and-drop real en navegador** — cubierto por tests unitarios + code-review; se recomienda smoke-test manual antes de considerar 100% validado en prod
3. **Sin histórico de cambios** — eventos no se almacenan (ej: "movido de PENDIENTE a EN_CURSO a las 12:30"); auditoría básica solo vía `updatedAt`

## Testing

### Backend

10 tests unitarios en `SalaTasksService`:
- CRUD completo
- Reorder multi-columna
- Validaciones de tenant
- Soft-delete

Suite completa: 1711 tests sin regresiones.

**Ejecución:**
```bash
npm run test -- sala-tasks.service.spec.ts
```

## Checklist de Implementación

- [x] Modelo Prisma (SalaTask)
- [x] API REST CRUD + Reorder
- [x] Soft-delete + Multi-tenancy
- [x] Frontend hooks (React Query)
- [x] Dashboard card
- [x] Página Kanban + @dnd-kit multi-columna
- [x] Modal crear/editar/borrar
- [x] Module gating (sala-notificaciones)
- [x] Route blocking
- [x] Nav-config
- [x] Tests unitarios backend
- [x] Code review (2 bugs encontrados y corregidos)
- [ ] Smoke-test manual drag-and-drop (recomendado pre-prod)
- [ ] Incluir en Papelera (post-v1)

---

**Versión:** 1.0.0  
**Última actualización:** 2026-08-29  
**Estado:** ✅ Implementado (tests + code-review completados)  
**Plan:** /Users/nemesioj/orca/workspaces/chefchek/develop/plans/260828-2113-sala-notificaciones-kanban
