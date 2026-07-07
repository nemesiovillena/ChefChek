# Fase 1 — Backend: avatarUrl + contacto/dirección + endpoint de subida

## Contexto
Patrones a replicar exactamente (ya probados en producción):
- `backend/src/modules/products/products.controller.ts:144-177` (`upload-image`, límite 2MB)
- `backend/src/modules/recipes/recipes.controller.ts:173-207` (`upload-image`, límite 5MB)
- `Product.imageUrl` / `Recipe.imageUrl` en `backend/prisma/schema.prisma`
- Estático servido desde `backend/src/main.ts:50-51` (`useStaticAssets(uploads/, {prefix:"/uploads/"})`)
- `backend/src/modules/products/dto/supplier.dto.ts:30-40` — `phone`/`whatsapp`
  como `@IsOptional() @IsString()` simples, sin validación de formato; mismo
  patrón para los nuevos campos de `User`.

## Campos nuevos en `User` (todos `String?`, nullable, opcionales)
- `avatarUrl` — foto de perfil.
- `street` — calle donde vive.
- `city` — ciudad.
- `phone` — teléfono.
- `whatsapp` — WhatsApp (campo independiente; el checkbox "mismo número" es
  solo UI en el frontend, no se persiste).
- `payrollEmail` — email de nóminas, **distinto** del campo `email` (login).

## Archivos a modificar
- `backend/prisma/schema.prisma` — añadir los 6 campos a `model User` (línea ~79, junto a `isActive`/`deletedAt`)
- `backend/src/modules/users/dto/create-user.dto.ts` — añadir los 6 campos a `CreateUserDto` y `UpdateUserDto`
- `backend/src/modules/users/users.controller.ts` — nuevo endpoint `POST upload-avatar`
- `backend/src/modules/users/users.service.ts` — incluir los 6 campos en los `select` de `create`/`findAll`/`findOne`/`update`

## Archivos a crear
- Ninguno (todo se añade a módulos existentes)

## Pasos

1. **Schema**: en `model User`, añadir tras `isActive`:
   ```prisma
   avatarUrl    String?
   street       String?
   city         String?
   phone        String?
   whatsapp     String?
   payrollEmail String?
   ```
   Correr `npx prisma migrate dev --name add_user_avatar_contact_fields` desde `backend/`.

2. **DTOs** (`create-user.dto.ts`): añadir a ambas clases (`CreateUserDto` y `UpdateUserDto`):
   ```ts
   @IsOptional()
   @IsString()
   avatarUrl?: string;

   @IsOptional()
   @IsString()
   street?: string;

   @IsOptional()
   @IsString()
   city?: string;

   @IsOptional()
   @IsString()
   phone?: string;

   @IsOptional()
   @IsString()
   whatsapp?: string;

   @IsOptional()
   @IsString()
   payrollEmail?: string;
   ```
   No usar `@IsEmail()` en `payrollEmail` si `email` (login) tampoco lo usa
   hoy (confirmar consistencia — revisar si `CreateUserDto.email` tiene
   `@IsEmail()`; si no lo tiene, no añadirlo aquí tampoco para no introducir
   una validación más estricta que el resto del DTO sin que se haya pedido).

3. **Controller** (`users.controller.ts`): añadir imports `UploadedFile`, `UseInterceptors`, `BadRequestException` desde `@nestjs/common`, `FileInterceptor` desde `@nestjs/platform-express`, `fs`, `path`. Añadir método (copiar patrón de `recipes.controller.ts:173-207`, ajustando carpeta a `uploads/users` y límite a `2 * 1024 * 1024`):
   ```ts
   @Post("upload-avatar")
   @Roles("ADMIN")
   @ApiOperation({ summary: "Subir avatar de usuario" })
   @UseInterceptors(
     FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }),
   )
   async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
     if (!file) {
       throw new BadRequestException("No file provided");
     }
     const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
     if (!allowedTypes.includes(file.mimetype)) {
       throw new BadRequestException("Only jpg, png, webp and gif images are allowed");
     }
     const uploadsDir = path.join(process.cwd(), "uploads", "users");
     if (!fs.existsSync(uploadsDir)) {
       fs.mkdirSync(uploadsDir, { recursive: true });
     }
     const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
     fs.writeFileSync(path.join(uploadsDir, fileName), file.buffer);
     return {
       success: true,
       data: { avatarUrl: `/uploads/users/${fileName}` },
       message: "Avatar uploaded successfully",
     };
   }
   ```
   Nota: `@Roles("ADMIN")` porque solo ADMIN crea/edita usuarios en este módulo (ver resto del controller). `upload-avatar` no es una ruta dinámica, no hay conflicto de orden con `@Get(":id")`, pero mantenerla junto a los demás métodos POST por legibilidad.

4. **Service** (`users.service.ts`): añadir los 6 campos (`avatarUrl`, `street`, `city`, `phone`, `whatsapp`, `payrollEmail`) a los cuatro bloques `select` (`create` línea ~76, `findAll` línea ~103, `findOne` línea ~135, `update` línea ~184).

## Tests
- `backend/src/modules/users/users.service.spec.ts` (revisar si existe; si no, seguir convención de `recipes.service.spec.ts`): añadir caso que confirme que los 6 campos nuevos se persisten y se devuelven en `create`/`update`/`findOne`.
- Verificación manual: `curl -X POST http://localhost:3001/api/v1/users/upload-avatar -H "Authorization: Bearer <session>" -H "X-Tenant-Slug: chefchek-demo" -F "file=@/path/to/test.png"` (credenciales de prueba en memoria: `admin@chefchek.local`/`admin123`).
- Verificar `create`/`update` con `street`, `city`, `phone`, `whatsapp`,
  `payrollEmail` en el body — confirmar que `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` los acepta tras el paso 2.

## Riesgos
- Migración aditiva, todos los campos `String?` nullable — sin riesgo de romper filas existentes.
- `uploads/users/` no tiene volumen Docker montado (igual que `uploads/products` y `uploads/recipes` hoy) — efímero en contenedores, riesgo preexistente heredado, no se resuelve en este plan.
- `payrollEmail` sin `@IsEmail()` permite guardar texto no válido como email — igual de laxo que el campo `email` actual, consistente con el resto del DTO (no se introduce una validación nueva que no exista ya en el módulo).
