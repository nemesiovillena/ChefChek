# Multi-tenancy Architecture - ChefChek

## Arquitectura Multi-tenant Estricto

ChefChek implementa un sistema de multi-tenancy **estricto** con aislamiento completo de datos a nivel de base de datos. Cada tenant (empresa/organización) tiene su propio contexto de datos sin posibilidad de acceso cruzado.

## Niveles de Aislamiento

### 1. Nivel de Base de Datos (Physical Isolation)

**Estrategia:** Shared Database, Shared Schema con Tenant ID

```sql
-- Cada tabla tiene tenantId como clave foránea obligatoria
CREATE TABLE tenants (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  -- Otros campos...
);

-- Índices optimizados para queries por tenant
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

### 2. Nivel de Aplicación (Logical Isolation)

**Middleware Automático:**
```typescript
// backend/src/middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantSlug = req.headers['x-tenant-slug'];
    // Validar tenant y adjuntar al contexto
    req.tenantId = validatedTenant.id;
    next();
  }
}
```

**Aplicación Automática:**
- Todas las rutas excepto `/api/v1/auth/login` y `/api/v1/tenants`
- Verificación de tenant inactivo → ForbiddenException
- Headers requeridos: `X-Tenant-Slug`

### 3. Nivel de Servicio (Business Logic Isolation)

**Validación en Servicios:**
```typescript
// backend/src/modules/users/users.service.ts
async create(createUserDto: CreateUserDto, requestTenantId: string) {
  // Validar que el tenant ID coincida con el de la request
  if (createUserDto.tenantId !== requestTenantId) {
    throw new ForbiddenException('Cannot create user for different tenant');
  }

  // Query siempre filtrada por tenant
  return this.prisma.user.create({
    data: { ...createUserDto, tenantId: requestTenantId }
  });
}
```

## Flujo de Solicitud Multi-tenant

```
┌─────────────┐
│   Client    │
│ (Frontend)  │
└──────┬──────┘
       │
       │ POST /api/v1/products
       │ Headers: {
       │   "Authorization": "Bearer session-id",
       │   "X-Tenant-Slug": "mi-restaurante"
       │ }
       │
       ▼
┌─────────────┐
│  Middleware │
│  Tenant     │
└──────┬──────┘
       │
       │ 1. Extraer tenant-slug
       │ 2. Validar tenant existe
       │ 3. Validar tenant activo
       │ 4. Adjuntar tenantId a request
       │
       ▼
┌─────────────┐
│   Guards    │
│  Auth/Role  │
└──────┬──────┘
       │
       │ 1. Validar sesión activa
       │ 2. Validar usuario autenticado
       │ 3. Validar permisos por rol
       │ 4. Adjuntar usuario a request
       │
       ▼
┌─────────────┐
│   Service   │
│  Business   │
└──────┬──────┘
       │
       │ 1. Extraer tenantId de request
       │ 2. Filtrar queries WHERE tenantId = ?
       │ 3. Validar operaciones por tenant
       │
       ▼
┌─────────────┐
│  Database   │
│  PostgreSQL │
└─────────────┘
```

## Estrategias de Aislamiento

### 1. Cascade Delete Protection

```prisma
// Si se elimina un tenant, todos sus datos asociados se eliminan automáticamente
model User {
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model Product {
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

### 2. Queries Seguras (Tenant-Scoped)

**Patrón obligatorio:**
```typescript
// ❌ INCORRECTO - No filtrar por tenant
const allProducts = await prisma.product.findMany();

// ✅ CORRECTO - Siempre filtrar por tenant
const tenantProducts = await prisma.product.findMany({
  where: { tenantId: requestTenantId }
});
```

### 3. Validación Cruzada

**Protección contra cross-tenant access:**
```typescript
async getProduct(id: string, requestTenantId: string) {
  const product = await this.prisma.product.findFirst({
    where: {
      id,
      tenantId: requestTenantId // Double check
    }
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  return product;
}
```

## Contexto de Tenant en Frontend

### Gestión de Sesión

```typescript
// frontend/src/app/dashboard/page.tsx
useEffect(() => {
  const sessionData = localStorage.getItem('session');
  if (sessionData) {
    const parsedSession = JSON.parse(sessionData);
    setUser(parsedSession.user);
    setSession(parsedSession.session);
  }
}, []);
```

### Inyección de Tenant en Requests

```typescript
const response = await fetch('http://localhost:3001/api/v1/users', {
  headers: {
    'Authorization': `Bearer ${session.token}`,
    'X-Tenant-Slug': 'mi-restaurante', // From tenant config
  },
});
```

## Seguridad Multi-tenant

### 1. Headers de Seguridad Obligatorios

```typescript
// Request headers requeridos
{
  "Authorization": "Bearer session-token",
  "X-Tenant-Slug": "mi-restaurante"
}
```

### 2. Validación de Tenant Inactivo

```typescript
// Middleware automáticamente bloquea tenants inactivos
if (!tenant.isActive) {
  throw new ForbiddenException('Tenant is not active');
}
```

### 3. Protección de Datos Sensibles

**Reglas de negocio:**
- Nunca exponer `tenantId` en respuestas públicas
- Validar que usuarios no puedan acceder a datos de otros tenants
- Logs sin información de tenant para proteger privacidad

## Optimizaciones de Performance

### 1. Índices por Tenant

```prisma
// Índices compuestos para queries frecuentes
@@index([tenantId, isActive]) // Para listados activos
@@index([tenantId, name])     // Para búsquedas por nombre
@@index([tenantId, createdAt]) // Para listados ordenados
```

### 2. Cache de Tenant Context

```typescript
// En producción, cachear la configuración de tenant activo
const tenantCache = new Map();

async getTenantConfig(tenantId: string) {
  if (tenantCache.has(tenantId)) {
    return tenantCache.get(tenantId);
  }

  const tenant = await this.findBySlug(tenantId);
  tenantCache.set(tenantId, tenant);
  return tenant;
}
```

### 3. Connection Pooling por Tenant

**Estrategia futura:**
- Pools de conexiones separados por tenant
- Limitación de recursos por tenant
- Monitoreo de queries por tenant

## Tenant Isolation Enforcement

### Reglas Obligatorias

1. **Siempre filtrar por tenant en queries**
   ```typescript
   where: { tenantId: requestTenantId } // MANDATORY
   ```

2. **Validar tenant ID en todas las operaciones**
   ```typescript
   if (tenantId !== requestTenantId) {
     throw new ForbiddenException('Cross-tenant access denied');
   }
   ```

3. **Nunca permitir acceso cruzado entre tenants**
   - Validar en servicios
   - Validar en guards
   - Validar en middleware

### Testing de Aislamiento

```typescript
// Test de aislamiento de datos
describe('Tenant Isolation', () => {
  it('should not allow cross-tenant data access', async () => {
    const tenant1User = await createTenantUser('tenant-1');
    const tenant2Product = await createProduct('tenant-2');

    const result = await productService.findProduct(
      tenant2Product.id,
      tenant1User.tenantId
    );

    expect(result).toBeNull(); // Should not find product from other tenant
  });
});
```

## Troubleshooting Multi-tenant

### Problemas Comunes

**1. "Tenant not found"**
- Verificar header `X-Tenant-Slug` enviado
- Verificar que el slug sea correcto
- Verificar que el tenant esté activo

**2. "Cross-tenant access denied"**
- Revisar que el servicio filtre por tenant
- Validar que el usuario pertenezca al tenant correcto
- Verificar logs de middleware para debugging

**3. Performance issues**
- Revisar índices en tablas grandes
- Optimizar queries complejas
- Considerar cache de configuración de tenant

## Próximos Pasos Multi-tenant

### Mejoras Futuras

- **Tenant-specific caching:** Redis separado por tenant
- **Tenant isolation metrics:** Dashboard de uso por tenant
- **Tenant resource limits:** Limitación de recursos por tenant
- **Tenant backup/restore:** Copias de seguridad individuales

## Documentación Relacionada

- [Authorization Model](./authorization-model.md) - Sistema de roles y permisos
- [Authentication Flow](./authentication-flow.md) - Flujo de autenticación completo
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [Tech Stack](./tech-stack.md) - Stack tecnológico detallado