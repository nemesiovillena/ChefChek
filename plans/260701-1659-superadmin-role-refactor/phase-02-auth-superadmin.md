# Fase 2: Auth flow SUPERADMIN

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 30 min  
**Dependencias:** Fase 1

---

## Objetivo

Crear un flujo de login exclusivo para SUPERADMIN que no requiere `tenantSlug`, ya que no pertenece a ningún tenant. Actualizar tipos y seed.

---

## 1. Actualizar tipos — `backend/src/types/auth.types.ts`

```diff
 export interface AuthUser {
   id: string;
   email: string;
   name: string;
   role: string;
-  tenantId: string;
+  tenantId: string | null;
 }
```

---

## 2. Nuevo endpoint de login — `backend/src/modules/auth/auth.controller.ts`

Añadir ruta `POST /api/v1/auth/superadmin/login`:

```typescript
@Post('superadmin/login')
@Public()
async superadminLogin(
  @Body() dto: SuperadminLoginDto,
  @Req() req: Request,
) {
  return this.authService.superadminLogin(dto.email, dto.password, req.ip, req.headers['user-agent']);
}
```

Nuevo DTO `SuperadminLoginDto` (mismo archivo que `login.dto.ts`):
```typescript
export class SuperadminLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
```

---

## 3. Nuevo método en `auth.service.ts`

```typescript
async superadminLogin(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
) {
  // Buscar usuario sin filtro de tenant
  const user = await this.usersService.findSuperadminByEmail(email);

  if (!user || !user.isActive || user.role !== 'SUPERADMIN') {
    throw new UnauthorizedException('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const { session, cookie } = await this.sessionService.createSession(
    user.id,
    ipAddress,
    userAgent,
  );

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: null,
      },
      session: { id: session.id, expiresAt: session.expiresAt },
      cookie,
    },
    message: 'Login successful',
  };
}
```

---

## 4. Nuevo método en `users.service.ts`

```typescript
async findSuperadminByEmail(email: string) {
  return this.prisma.user.findFirst({
    where: { email, role: 'SUPERADMIN' },
  });
}
```

---

## 5. Añadir ruta a `publicRoutes` en `tenant.middleware.ts`

```diff
 private readonly publicRoutes = [
   ...
+  '/api/v1/auth/superadmin/login',
 ];
```

---

## 6. Seed — `backend/prisma/seed.ts`

Añadir usuario SUPERADMIN **sin** tenantId al inicio del seed:

```typescript
// SUPERADMIN — sin tenant
const superadminHash = await bcrypt.hash('superadmin123', 10);
await prisma.user.upsert({
  where: { id: 'superadmin-fixed-id' },
  update: {},
  create: {
    id: 'superadmin-fixed-id',
    email: 'superadmin@chefchek.io',
    passwordHash: superadminHash,
    name: 'ChefChek Superadmin',
    role: 'SUPERADMIN',
    tenantId: null,
    isActive: true,
  },
});
```

> **Credenciales de desarrollo:** `superadmin@chefchek.io` / `superadmin123`

---

## Checklist

- [ ] `AuthUser.tenantId` cambiado a `string | null`
- [ ] DTO `SuperadminLoginDto` creado
- [ ] Endpoint `POST /api/v1/auth/superadmin/login` añadido al controller
- [ ] `authService.superadminLogin()` implementado
- [ ] `usersService.findSuperadminByEmail()` implementado
- [ ] Ruta añadida a `publicRoutes` en middleware
- [ ] Usuario SUPERADMIN añadido al seed (`npx prisma db seed` funciona)
