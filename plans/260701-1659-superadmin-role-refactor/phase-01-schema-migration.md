# Fase 1: Schema & Migración DB

**Estado:** ⬜ Pendiente  
**Tiempo estimado:** 20 min  
**Dependencias:** Ninguna

---

## Objetivo

Añadir `SUPERADMIN` al enum `UserRole` y hacer `tenantId` nullable en `User` para que un SUPERADMIN pueda existir sin pertenecer a ningún tenant.

---

## Cambios en `backend/prisma/schema.prisma`

### 1. Enum `UserRole` — añadir SUPERADMIN

```diff
 enum UserRole {
+  SUPERADMIN
   OWNER
   ADMIN
   USER
   VIEWER
 }
```

### 2. Modelo `User` — hacer `tenantId` nullable

```diff
 model User {
   id           String    @id @default(cuid())
-  tenantId     String
+  tenantId     String?
   email        String
   passwordHash String
   name         String
   role         UserRole  @default(USER)
   isActive     Boolean   @default(true)
   createdAt    DateTime  @default(now())
   updatedAt    DateTime  @updatedAt
-  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
+  tenant       Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
   sessions          Session[]
   knowledgeArticles KnowledgeArticle[]
   articleVersions   KnowledgeVersion[]
   updatedArticles   KnowledgeArticle[] @relation("ArticleUpdater")
   telegramUsers     TelegramUser[]
   AuditLog          AuditLog[]

-  @@unique([email, tenantId])
+  @@unique([email, tenantId])   // sigue válido: NULL != NULL en PostgreSQL
   @@index([tenantId])
   @@index([email])
   @@map("users")
 }
```

> **Nota:** En PostgreSQL `UNIQUE(email, tenant_id)` permite múltiples filas con `tenant_id = NULL` y mismo `email` (NULL ≠ NULL). Para SUPERADMIN esto es aceptable porque se crea 1 sola vez en seed. Si en el futuro se crean varios SUPERADMIN, añadir `@@unique([email])` filtrado por role a nivel de aplicación.

---

## Ejecutar migración

```bash
cd backend
npx prisma migrate dev --name add-superadmin-role-nullable-tenant
```

---

## Checklist

- [ ] `SUPERADMIN` añadido al enum `UserRole` en `schema.prisma`
- [ ] `tenantId` cambiado a `String?` en modelo `User`
- [ ] Relación `tenant` cambiada a `Tenant?` (optional)
- [ ] Migración generada y aplicada sin errores
- [ ] `npx prisma generate` ejecutado correctamente

---

## Riesgos

- Cambiar `tenantId` a nullable puede afectar queries existentes que asumen no-null. Revisar especialmente `users.service.ts` y `auth.service.ts` (cubierto en fases 2 y 3).
- El `@@unique([email, tenantId])` existente sigue funcionando tal cual en PG con nulls.
