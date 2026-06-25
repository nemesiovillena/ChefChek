# Authentication Flow - ChefChek

## Arquitectura de Autenticación

### Sistema Híbrido: Lucia Auth + Prisma

ChefChek utiliza un sistema de autenticación basado en sesiones implementado con **Lucia Auth** y almacenamiento de sesiones en **PostgreSQL** mediante **Prisma ORM**.

```
Frontend (Next.js) → API Gateway → Lucia Auth Service → Prisma → PostgreSQL
```

## Componentes Principales

### 1. Lucia Auth Service

**Responsabilidades:**
- Gestión de sesiones seguras
- Validación de credenciales
- Creación y verificación de tokens JWT
- Control de expiración de sesiones
- Gestión de cookies HTTP-only

**Implementación:**
```typescript
// backend/src/modules/auth/auth.service.ts
- login(email, password, tenantId): Promise<{ session, user }>
- validateSession(sessionId): Promise<boolean>
- destroySession(sessionId): Promise<void>
```

### 2. Session Manager (Prisma)

**Modelo de Session:**
```prisma
model Session {
  id          String   @id
  userId      String
  tenantId    String
  expiresAt   DateTime
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@unique([id])
  @@index([userId])
  @@index([tenantId])
}
```

### 3. Middleware de Tenant

**Responsabilidades:**
- Verificar la existencia del tenant en cada request
- Extraer tenant de headers (`X-Tenant-Slug`)
- Aislar contexto de datos por tenant
- Bloquear requests sin tenant válido

**Implementación:**
```typescript
// backend/src/middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantSlug = req.headers['x-tenant-slug'];
    // Verificar tenant y adjuntar al contexto
  }
}
```

## Flujo de Autenticación

### 1. Login Flow

```
┌─────────────┐
│  Frontend   │
│ (Next.js)   │
└──────┬──────┘
       │
       │ POST /api/v1/auth/login
       │ Body: { email, password }
       │ Headers: { X-Tenant-Slug }
       │
       ▼
┌─────────────┐
│   API       │
│  Gateway    │
└──────┬──────┘
       │
       │ Middleware Tenant Check
       │ (valida X-Tenant-Slug)
       │
       ▼
┌─────────────┐
│   Lucia     │
│ Auth Service│
└──────┬──────┘
       │
       │ 1. Buscar usuario por email + tenantId
       │ 2. Validar password con bcrypt
       │ 3. Crear sesión en PostgreSQL
       │ 4. Generar JWT token
       │
       ▼
┌─────────────┐
│  Response   │
│ (JSON)      │
└──────┬──────┘
       │
       │ { success: true, data: { user, session } }
       │
       ▼
┌─────────────┐
│  Frontend   │
│ (Next.js)   │
└─────────────┘
```

### 2. Protected Request Flow

```
┌─────────────┐
│  Frontend   │
│ (Next.js)   │
└──────┬──────┘
       │
       │ GET /api/v1/products
       │ Headers: { Authorization: Bearer JWT, X-Tenant-Slug }
       │
       ▼
┌─────────────┐
│   API       │
│  Gateway    │
└──────┬──────┘
       │
       │ Middleware Tenant Check
       │ (valida X-Tenant-Slug)
       │
       ▼
┌─────────────┐
│   Lucia     │
│  JWT Guard  │
└──────┬──────┘
       │
       │ 1. Verificar JWT signature
       │ 2. Validar expiración
       │ 3. Verificar sesión en DB
       │
       ▼
┌─────────────┐
│ Controller  │
└──────┬──────┘
       │
       │ 1. Extraer userId del JWT
       │ 2. Extraer tenantId del contexto
       │ 3. Ejecutar lógica de negocio
       │
       ▼
┌─────────────┐
│  Response   │
│ (JSON)      │
└─────────────┘
```

### 3. Logout Flow

```
┌─────────────┐
│  Frontend   │
│ (Next.js)   │
└──────┬──────┘
       │
       │ POST /api/v1/auth/logout
       │ Headers: { Authorization: Bearer JWT }
       │
       ▼
┌─────────────┐
│   Lucia     │
│ Auth Service│
└──────┬──────┘
       │
       │ 1. Verificar sesión activa
       │ 2. Eliminar sesión de PostgreSQL
       │ 3. Invalidar JWT
       │
       ▼
┌─────────────┐
│  Response   │
│ (JSON)      │
└──────┬──────┘
       │
       │ { success: true, message: "Logged out" }
       │
       ▼
┌─────────────┐
│  Frontend   │
│ (Next.js)   │
└─────────────┘
```

## Seguridad de Sesiones

### JWT Token Structure

```json
{
  "sub": "user-id",
  "tenantId": "tenant-id",
  "sessionId": "session-id",
  "role": "ADMIN",
  "iat": 1622332800,
  "exp": 1622419200
}
```

### Configuración de Seguridad

**Características:**
- **HTTP-Only Cookies**: Protección contra XSS
- **Secure Flag**: Solo HTTPS en producción
- **SameSite**: Prevención CSRF
- **Short Expiration**: 24 horas por defecto
- **Refresh Tokens**: Opcional para sesiones extendidas

### Validaciones de Seguridad

**En cada request protegido:**
1. ✅ Verificar signature del JWT
2. ✅ Validar expiración del token
3. ✅ Confirmar sesión activa en DB
4. ✅ Verificar tenant existe y está activo
5. ✅ Validar permisos de usuario por módulo

## Multi-tenancy y Aislamiento

### Tenant Context Inyección

```typescript
// En cada request del tenant
@Injectable()
export class TenantService {
  constructor(@Inject(REQUEST) private request: Request) {}

  getCurrentTenant(): string {
    return this.request['tenantId']; // Inyectado por middleware
  }
}
```

### Aislamiento de Datos

**Regla de negocio:**
- Cada query a DB debe incluir `WHERE tenantId = ?`
- Los servicios reciben `tenantId` inyectado automáticamente
- Nunca confiar en datos del cliente sin validación

```typescript
// Ejemplo de servicio aislado
async getProducts(tenantId: string): Promise<Product[]> {
  return this.prisma.product.findMany({
    where: { tenantId } // Aislamiento obligatorio
  });
}
```

## Manejo de Errores

### Códigos de Error HTTP

- `401 Unauthorized`: Token inválido o expirado
- `403 Forbidden`: Permisos insuficientes para módulo
- `404 Not Found`: Tenant no encontrado
- `422 Unprocessable Entity`: Credenciales inválidas

### Response de Error

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "details": {}
  },
  "timestamp": "2026-05-30T10:00:00Z"
}
```

## DTOs de Autenticación

### Login Request DTO

```typescript
export class LoginDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;
}
```

### Login Response DTO

```typescript
export class LoginResponseDto {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      tenantId: string;
    };
    session: {
      id: string;
      token: string;
      expiresAt: Date;
    };
  };
  message: string;
}
```

## Próximos Pasos

### Implementación Futura

- **Refresh Tokens**: Para sesiones extendidas
- **2FA/MFA**: Autenticación de dos factores
- **OAuth Integration**: Google, GitHub, Microsoft
- **Session Analytics**: Dashboard de sesiones activas
- **Security Alerts**: Detección de actividad sospechosa

### Optimizaciones

- **Redis Cache**: Para validación de sesiones en tiempo real
- **Distributed Sessions**: Para escalado horizontal
- **Rate Limiting**: Prevención de brute-force attacks
- **IP Whitelisting**: Restricción por origen geográfico

## Documentación Relacionada

- [System Architecture](./system-architecture.md) - Arquitectura general del sistema
- [API Conventions](./api-conventions.md) - Convenciones de API RESTful
- [Database Schema](./database-schema.md) - Esquema de base de datos completo
- [Tech Stack](./tech-stack.md) - Stack tecnológico detallado