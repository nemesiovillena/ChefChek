# API Endpoints Authentication - ChefChek

## Endpoints de Autenticación

Sistema de endpoints RESTful para gestión de autenticación con Lucia Auth y PostgreSQL.

## Autenticación Base

### Login - Iniciar Sesión

**Endpoint:** `POST /api/v1/auth/login`

**Headers:** Ninguno (excluido de middleware de tenant)

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "tenantId": "mi-restaurante"
}
```

**Response Exitoso (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "usuario@ejemplo.com",
      "name": "Nombre Usuario",
      "role": "ADMIN",
      "tenantId": "tenant-id"
    },
    "session": {
      "id": "session-id",
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "expiresAt": "2026-05-31T10:00:00Z"
    }
  },
  "message": "Login successful"
}
```

**Errores:**
- `401` - Credenciales inválidas
- `404` - Tenant no encontrado
- `403` - Tenant inactivo

---

### Logout - Cerrar Sesión

**Endpoint:** `POST /api/v1/auth/logout`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Body:**
```json
{
  "sessionId": "session-id"
}
```

**Response Exitoso (204):**
```json
{
  "success": true,
  "data": null,
  "message": "Logout successful"
}
```

**Errores:**
- `401` - Sesión inválida o expirada
- `404` - Sesión no encontrada

---

### Refresh - Refrescar Sesión

**Endpoint:** `POST /api/v1/auth/refresh`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Body:**
```json
{
  "sessionId": "old-session-id"
}
```

**Response Exitoso (201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "new-session-id",
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "expiresAt": "2026-05-31T10:00:00Z"
    }
  },
  "message": "Session refreshed successfully"
}
```

---

### Validate - Validar Sesión

**Endpoint:** `GET /api/v1/auth/validate`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "usuario@ejemplo.com",
      "name": "Nombre Usuario",
      "role": "ADMIN",
      "tenantId": "tenant-id"
    },
    "isValid": true
  },
  "message": "Session is valid"
}
```

**Response Sesión Inválida:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SESSION",
    "message": "Invalid or expired session"
  }
}
```

---

### Get Sessions - Listar Sesiones Activas

**Endpoint:** `GET /api/v1/auth/sessions`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-id-1",
      "createdAt": "2026-05-30T10:00:00Z",
      "expiresAt": "2026-05-31T10:00:00Z",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0..."
    },
    {
      "id": "session-id-2",
      "createdAt": "2026-05-30T08:00:00Z",
      "expiresAt": "2026-05-31T08:00:00Z",
      "ipAddress": "192.168.1.101",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "message": "Active sessions retrieved successfully"
}
```

---

### Invalidate Session - Invalidar Sesión Específica

**Endpoint:** `DELETE /api/v1/auth/sessions/:sessionId`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (204):**
```json
{
  "success": true,
  "data": null,
  "message": "Session invalidated successfully"
}
```

---

### Invalidate All Sessions - Invalidar Todas las Sesiones

**Endpoint:** `DELETE /api/v1/auth/sessions`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (204):**
```json
{
  "success": true,
  "data": null,
  "message": "All user sessions invalidated successfully"
}
```

---

## Endpoints de Tenants

### Create Tenant - Crear Nuevo Tenant

**Endpoint:** `POST /api/v1/tenants`

**Autorización:** solo `SUPERADMIN`.

**Headers:** Sin `X-Tenant-Slug` (excluido de middleware de tenant), pero requiere `Authorization: Bearer {session-token}` de un SUPERADMIN.

**Body:**
```json
{
  "name": "Mi Restaurante",
  "slug": "mi-restaurante",
  "domain": "mirestaurante.com",
  "adminEmail": "admin@ejemplo.com",
  "adminPassword": "contraseña123",
  "adminName": "Administrador",
  "adminRole": "ADMIN"
}
```

**Response Exitoso (201):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-id",
    "name": "Mi Restaurante",
    "slug": "mi-restaurante",
    "domain": "mirestaurante.com",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T10:00:00Z"
  },
  "message": "Tenant created successfully with admin user"
}
```

**Errores:**
- `409` - Slug o dominio ya existe

---

### Get All Tenants - Listar Todos los Tenants

**Endpoint:** `GET /api/v1/tenants?page=1&limit=20`

**Autorización:** solo `SUPERADMIN` (listado cross-tenant).

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 20, max: 100) - Elementos por página

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-id-1",
      "name": "Restaurante A",
      "slug": "restaurante-a",
      "domain": "restaurantea.com",
      "isActive": true,
      "createdAt": "2026-05-30T10:00:00Z"
    },
    {
      "id": "tenant-id-2",
      "name": "Restaurante B",
      "slug": "restaurante-b",
      "domain": null,
      "isActive": true,
      "createdAt": "2026-05-29T10:00:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20
  },
  "message": "Tenants retrieved successfully"
}
```

---

### Get Tenant by ID - Obtener Tenant Específico

**Endpoint:** `GET /api/v1/tenants/:id`

**Autorización:** `ADMIN`+ del propio tenant (`:id` debe coincidir con `user.tenantId`), o `SUPERADMIN` para cualquier tenant. Usado por la página `/dashboard/settings` para mostrar los datos del tenant.

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-id",
    "name": "Mi Restaurante",
    "slug": "mi-restaurante",
    "domain": "mirestaurante.com",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T10:00:00Z",
    "users": [
      {
        "id": "user-id",
        "email": "admin@ejemplo.com",
        "name": "Administrador",
        "role": "ADMIN",
        "isActive": true,
        "createdAt": "2026-05-30T10:00:00Z"
      }
    ]
  },
  "message": "Tenant retrieved successfully"
}
```

**Errores:**
- `404` - Tenant no encontrado

---

### Update Tenant - Actualizar Tenant

**Endpoint:** `PATCH /api/v1/tenants/:id`

**Autorización:** `ADMIN`+ del propio tenant (`:id` debe coincidir con `user.tenantId`), o `SUPERADMIN` para cualquier tenant.

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Body:**
```json
{
  "name": "Mi Restaurante Actualizado",
  "domain": "mirestaurante-actualizado.com",
  "isActive": true
}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "id": "tenant-id",
    "name": "Mi Restaurante Actualizado",
    "slug": "mi-restaurante",
    "domain": "mirestaurante-actualizado.com",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T11:00:00Z"
  },
  "message": "Tenant updated successfully"
}
```

**Errores:**
- `404` - Tenant no encontrado
- `409` - Slug o dominio ya existe

---

### Delete Tenant - Eliminar Tenant

**Endpoint:** `DELETE /api/v1/tenants/:id`

**Autorización:** solo `SUPERADMIN`.

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (204):**
```json
{
  "success": true,
  "data": null,
  "message": "Tenant deleted successfully"
}
```

**Notas:**
- Elimina en cascada: usuarios, productos, recetas, menús, etc.
- Operación destructiva irreversible

---

## Endpoints de Usuarios

### Create User - Crear Nuevo Usuario

**Endpoint:** `POST /api/v1/users`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Body:**
```json
{
  "tenantId": "tenant-id",
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "name": "Usuario Nombre",
  "role": "USER",
  "isActive": true
}
```

**Response Exitoso (201):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "usuario@ejemplo.com",
    "name": "Usuario Nombre",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T10:00:00Z"
  },
  "message": "User created successfully"
}
```

**Errores:**
- `403` - Usuario no tiene permisos (requiere ADMIN)
- `409` - Email ya existe en el tenant
- `404` - Tenant no encontrado

---

### Get All Users - Listar Usuarios del Tenant

**Endpoint:** `GET /api/v1/users?page=1&limit=20`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 20, max: 100) - Elementos por página

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-id-1",
      "email": "admin@ejemplo.com",
      "name": "Administrador",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2026-05-30T10:00:00Z"
    },
    {
      "id": "user-id-2",
      "email": "cocinero@ejemplo.com",
      "name": "Cocinero Principal",
      "role": "USER",
      "isActive": true,
      "createdAt": "2026-05-29T10:00:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20
  },
  "message": "Users retrieved successfully"
}
```

**Seguridad:**
- Solo devuelve usuarios del tenant del request
- Filtrado automático por tenantId

---

### Get User by ID - Obtener Usuario Específico

**Endpoint:** `GET /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "usuario@ejemplo.com",
    "name": "Usuario Nombre",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T10:00:00Z"
  },
  "message": "User retrieved successfully"
}
```

**Errores:**
- `404` - Usuario no encontrado o pertenece a otro tenant

---

### Update User - Actualizar Usuario

**Endpoint:** `PATCH /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Body:**
```json
{
  "email": "nuevo-email@ejemplo.com",
  "name": "Nuevo Nombre",
  "role": "ADMIN",
  "isActive": true
}
```

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "nuevo-email@ejemplo.com",
    "name": "Nuevo Nombre",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2026-05-30T10:00:00Z",
    "updatedAt": "2026-05-30T11:00:00Z"
  },
  "message": "User updated successfully"
}
```

**Errores:**
- `403` - Usuario no tiene permisos (requiere ADMIN)
- `404` - Usuario no encontrado
- `409` - Email ya existe

---

### Delete User - Eliminar Usuario

**Endpoint:** `DELETE /api/v1/users/:id`

**Headers:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

**Response Exitoso (204):**
```json
{
  "success": true,
  "data": null,
  "message": "User deleted successfully"
}
```

**Notas:**
- Elimina sesiones asociadas en cascada
- Requiere rol ADMIN

---

## Manejo de Errores

### Formato de Respuestas de Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "email",
      "message": "Email already exists"
    }
  },
  "timestamp": "2026-05-30T10:00:00Z"
}
```

### Códigos de Error Comunes

| Código | HTTP | Descripción |
|--------|------|-------------|
| `UNAUTHORIZED` | 401 | Sesión inválida o expirada |
| `FORBIDDEN` | 403 | Permisos insuficientes |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `CONFLICT` | 409 | Conflicto con datos existentes |
| `VALIDATION_ERROR` | 422 | Validación de datos falló |
| `TENANT_INACTIVE` | 403 | Tenant inactivo |

---

## Seguridad y Best Practices

### 1. Headers Obligatorios

**Para endpoints protegidos:**
```
Authorization: Bearer {session-token}
X-Tenant-Slug: {tenant-slug}
```

### 2. Manejo de Sesiones

**Almacenamiento seguro:**
```javascript
// Frontend: localStorage con sesión encriptada
localStorage.setItem('session', JSON.stringify(sessionData));

// Al hacer requests:
headers: {
  'Authorization': `Bearer ${session.token}`,
  'X-Tenant-Slug': tenantSlug
}
```

### 3. Expiración de Sesiones

**Configuración:**
- Expiración por defecto: 24 horas
- Refresh automático disponible
- Logout manual recomendado

### 4. Rate Limiting

**Límites:**
- Login: 5 requests/minuto por IP
- Auth endpoints: 10 requests/minuto por sesión
- Data endpoints: 100 requests/minuto por tenant

---

## Documentación Relacionada

- [Authentication Flow](./authentication-flow.md) - Flujo de autenticación completo
- [Authorization Model](./authorization-model.md) - Sistema de roles y permisos
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [Multi-tenancy Architecture](./multi-tenancy-architecture.md) - Arquitectura multi-tenant