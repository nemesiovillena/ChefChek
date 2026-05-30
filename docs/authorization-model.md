# Authorization Model - ChefChek

## Modelo de Autorización Jerárquico

ChefChek implementa un sistema de autorización **granular y jerárquico** basado en roles que permite un control preciso de acceso a recursos y funcionalidades.

## Sistema de Roles

### Jerarquía de Roles

```
ADMIN (3) ────► Puede hacer TODO
├── USER (2) ──► Puede hacer operaciones estándar
└── VIEWER (1) ──► Solo lectura
```

**Regla de Inheritancia:**
- Un rol superior puede hacer todo lo que un rol inferior puede hacer
- Roles inferiores no pueden acceder a funcionalidades de roles superiores

### Roles Definidos

#### 1. ADMIN - Administrador
- **Nivel de acceso:** Total
- **Permisos:**
  - ✅ CRUD completo de usuarios
  - ✅ CRUD completo de tenants
  - ✅ Gestión de configuración del sistema
  - ✅ Acceso a todos los módulos
  - ✅ Operaciones destructivas (eliminación masiva)
  - ✅ Configuración de integraciones

#### 2. USER - Usuario Estándar
- **Nivel de acceso:** Operacional
- **Permisos:**
  - ✅ CRUD de productos, recetas, menús
  - ✅ Gestión de inventario y almacenes
  - ✅ Crear y modificar recetas
  - ✅ Generar fichas técnicas
  - ❌ Gestión de usuarios (requiere ADMIN)
  - ❌ Configuración de tenant (requiere ADMIN)

#### 3. VIEWER - Solo Lectura
- **Nivel de acceso:** Consulta
- **Permisos:**
  - ✅ Ver todos los datos del tenant
  - ✅ Ver recetas y fichas técnicas
  - ✅ Ver menús y cartas
  - ✅ Ver inventarios y stock
  - ❌ Crear/modificar cualquier dato
  - ❌ Operaciones de escritura

## Sistema de Permisos Granular

### Decorador de Roles

```typescript
// backend/src/decorators/roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Guard de Roles

```typescript
// backend/src/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get('roles', context.getHandler());
    const user = request.user;

    // Validar jerarquía de roles
    const userRoleLevel = roleHierarchy[user.role];
    return requiredRoles.some(role => {
      const requiredLevel = roleHierarchy[role];
      return userRoleLevel >= requiredLevel;
    });
  }
}
```

### Aplicación de Roles

```typescript
// Ejemplo de controlador con protección de roles
@Controller('api/v1/users')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  @Post()
  @Roles('ADMIN')  // Solo ADMIN puede crear usuarios
  async create(@Body() createUserDto: CreateUserDto) { }

  @Get()
  @Roles('ADMIN', 'USER', 'VIEWER')  // Todos pueden ver usuarios
  async findAll() { }

  @Delete(':id')
  @Roles('ADMIN')  // Solo ADMIN puede eliminar usuarios
  async remove(@Param('id') id: string) { }
}
```

## Validación de Permisos por Módulo

### Matriz de Permisos por Módulo

| Módulo | Operación | ADMIN | USER | VIEWER |
|--------|-----------|-------|------|--------|
| **Tenants** | Crear | ✅ | ❌ | ❌ |
| | Leer | ✅ | ✅ | ❌ |
| | Actualizar | ✅ | ❌ | ❌ |
| | Eliminar | ✅ | ❌ | ❌ |
| **Usuarios** | Crear | ✅ | ❌ | ❌ |
| | Leer | ✅ | ✅ | ✅ |
| | Actualizar | ✅ | ❌ | ❌ |
| | Eliminar | ✅ | ❌ | ❌ |
| **Productos** | Crear | ✅ | ✅ | ❌ |
| | Leer | ✅ | ✅ | ✅ |
| | Actualizar | ✅ | ✅ | ❌ |
| | Eliminar | ✅ | ✅ | ❌ |
| **Recetas** | Crear | ✅ | ✅ | ❌ |
| | Leer | ✅ | ✅ | ✅ |
| | Actualizar | ✅ | ✅ | ❌ |
| | Eliminar | ✅ | ✅ | ❌ |
| **Menús** | Crear | ✅ | ✅ | ❌ |
| | Leer | ✅ | ✅ | ✅ |
| | Actualizar | ✅ | ✅ | ❌ |
| | Eliminar | ✅ | ✅ | ❌ |

## Arquitectura de Autorización

### 1. Chain de Guards

```
Request → AuthGuard → TenantGuard → RolesGuard → Controller
```

**AuthGuard:**
- Valida token de sesión
- Verifica sesión activa en DB
- Adjunta usuario al contexto

**TenantGuard:**
- Valida tenant existe
- Verifica tenant activo
- Adjunta tenant al contexto

**RolesGuard:**
- Valida permisos del usuario
- Verifica jerarquía de roles
- Bloquea si insuficiente

### 2. Validación de Permisos en Servicios

```typescript
// backend/src/modules/users/users.service.ts
async validateUserPermissions(userId: string, requiredRoles: string[]) {
  const user = await this.findById(userId);

  if (!user || !user.isActive) {
    return false;
  }

  // Validar jerarquía de roles
  return requiredRoles.some(role => {
    const userRoleLevel = roleHierarchy[user.role];
    const requiredLevel = roleHierarchy[role];
    return userRoleLevel >= requiredLevel;
  });
}
```

## Frontend Authorization

### 1. Gestión de Sesión

```typescript
// frontend/src/app/dashboard/page.tsx
const sessionData = localStorage.getItem('session');
const { user, session } = JSON.parse(sessionData);

const canAccessModule = (module: string, role: string) => {
  const permissions = {
    'users': ['ADMIN'],
    'products': ['ADMIN', 'USER'],
    'recipes': ['ADMIN', 'USER'],
    'menus': ['ADMIN', 'USER'],
  };

  return permissions[module]?.includes(role) || false;
};
```

### 2. UI Condicional por Rol

```typescript
// frontend/src/app/dashboard/users/page.tsx
{user?.role === 'ADMIN' && (
  <button onClick={() => setShowCreateForm(true)}>
    Create User
  </button>
)}
```

## Seguridad y Prevención

### 1. Cross-Tenant Authorization

**Protección obligatoria:**
```typescript
// Validar que usuario pertenece al tenant correcto
async canAccessResource(userId: string, tenantId: string): Promise<boolean> {
  const user = await this.findById(userId);

  if (!user || user.tenantId !== tenantId) {
    return false;
  }

  return true;
}
```

### 2. Validación de Propiedad

```typescript
// Antes de permitir operación destructiva
async deleteResource(userId: string, resourceId: string, tenantId: string) {
  // 1. Validar permisos de usuario
  // 2. Validar que el recurso pertenezca al tenant
  // 3. Validar que el usuario tenga permiso
  const resource = await this.prisma.resource.findFirst({
    where: {
      id: resourceId,
      tenantId: tenantId,
    },
  });

  if (!resource) {
    throw new NotFoundException('Resource not found');
  }

  return this.prisma.resource.delete({ where: { id: resourceId } });
}
```

## Auditoría de Permisos

### Logs de Autorización

```typescript
// Logging de intentos de acceso fallidos
@Injectable()
export class RolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = request.user;
    const requiredRoles = this.reflector.get('roles', context.getHandler());

    if (!this.hasPermission(user, requiredRoles)) {
      // Log intento de acceso no autorizado
      console.warn(`User ${user.id} attempted to access ${handler} with role ${user.role}`);
      return false;
    }

    return true;
  }
}
```

### Registros de Acceso

**Futuro:** Sistema de auditoría completa
- Registro de cada acceso a recursos protegidos
- Tracking de cambios de roles
- Alertas de actividad sospechosa
- Reportes de compliance

## Best Practices

### 1. Principio de Menor Privilegio

**Aplicar siempre:**
```typescript
// ❌ INCORRECTO - Dar acceso excesivo
@Roles('ADMIN', 'USER', 'VIEWER')
async sensitiveOperation() { }

// ✅ CORRECTO - Mínimo necesario
@Roles('ADMIN')
async sensitiveOperation() { }
```

### 2. Validación en Múltiples Capas

**Seguridad en profundidad:**
```typescript
// 1. Guard de roles en controlador
@Roles('ADMIN')
async deleteUser(@Param('id') id: string) { }

// 2. Validación en servicio
async remove(id: string, requestTenantId: string) {
  const user = request.user;
  if (user.role !== 'ADMIN') {
    throw new ForbiddenException('Only admins can delete users');
  }
  // ...
}
```

### 3. Tests de Permisos

**Testing de autorización:**
```typescript
describe('User Permissions', () => {
  it('should allow admin to create users', async () => {
    const admin = await createTestUser('ADMIN');
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(createUserDto);

    expect(response.status).toBe(201);
  });

  it('should deny viewer to create users', async () => {
    const viewer = await createTestUser('VIEWER');
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send(createUserDto);

    expect(response.status).toBe(403);
  });
});
```

## Próximas Mejoras

### 1. Permisos Granulares por Recurso

**Futuro:** Permisos específicos por entidad
- `products:create` vs `products:read`
- `recipes:modify_own` vs `recipes:modify_all`
- `users:manage` vs `users:view`

### 2. Roles Personalizados

**Futuro:** Roles customizables por tenant
- Crear roles específicos por negocio
- Configurar permisos por módulo
- Herencia de roles personalizada

### 3. ABAC (Attribute-Based Access Control)

**Futuro:** Autorización basada en atributos
- Permisos basados en tiempo/ubicación
- Permisos basados en contexto de negocio
- Reglas dinámicas de acceso

## Documentación Relacionada

- [Multi-tenancy Architecture](./multi-tenancy-architecture.md) - Arquitectura multi-tenant
- [Authentication Flow](./authentication-flow.md) - Flujo de autenticación completo
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [Tech Stack](./tech-stack.md) - Stack tecnológico detallado