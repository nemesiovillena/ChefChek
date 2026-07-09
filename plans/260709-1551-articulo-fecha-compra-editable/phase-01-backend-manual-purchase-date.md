# Fase 01 — Backend: campo `manualPurchaseDate`, migración, DTO, precedencia

## Contexto (ficheros verificados)

- `backend/prisma/schema.prisma:128-191` — modelo `Product`. Ya tiene `DateTime?` opcionales como referencia de convención: `deletedAt DateTime?` (`:173`). No existe `@IsDateString` en el DTO de productos.
- `backend/src/modules/products/products.service.ts:183-236` — `findAll()`: incluye `albaranLines` (`:209-217`, `take:1`, `orderBy albaran.date desc`) y mapea `lastPurchaseDate = albaranLines?.[0]?.albaran?.date ?? null` (`:224-228`).
- `backend/src/modules/products/products.service.ts:238-259` — `findOne()`: NO incluye `albaranLines`, NO calcula `lastPurchaseDate`.
- `backend/src/modules/products/products.service.ts:261-415` — `update()`: destructura campos especiales y hace `data = { ...updateData }` (`:275-284`); un campo escalar nuevo del DTO fluye solo hacia `data`. Persiste con `prisma.product.update({ data })` (`:374-384`).
- `backend/src/modules/products/dto/create-product.dto.ts:176-317` — `UpdateProductDto`.
- `backend/src/modules/products/products.controller.ts:224-241` — `PATCH :id` → `update()`. Reusar, NO crear endpoint.
- Patrón de fecha opcional a copiar: `backend/src/modules/albaranes/dto/albaran-query.dto.ts:20-28` (`@IsOptional() @IsDateString()`).

## Requisitos

1. Nuevo campo `manualPurchaseDate DateTime?` en `Product`.
2. `manualPurchaseDate` opcional (y anulable) en `UpdateProductDto`.
3. Precedencia "fecha más reciente" en `findAll` y `findOne`.
4. `purchaseDateSource: 'albaran' | 'manual' | null` en la respuesta de ambos.

## Ficheros a modificar

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/**` (generado)
- `backend/src/modules/products/dto/create-product.dto.ts`
- `backend/src/modules/products/products.service.ts`

## Pasos

### 1. Schema + migración

En `Product` (tras `deletedAt DateTime?`, `schema.prisma:173`), añadir:

```prisma
  manualPurchaseDate DateTime? // Fecha de compra editada manualmente en el listado
```

Generar migración additiva (nullable, sin default → segura, cero pérdida):

```bash
cd backend && npx prisma migrate dev --name add_product_manual_purchase_date
```

Nombre de migración descriptivo del cambio (no IDs de plan). Verificar que solo hace
`ALTER TABLE "products" ADD COLUMN "manualPurchaseDate" TIMESTAMP(3)`.

> OJO (memoria `two-postgres-databases-dev`): aplicar en la BD que usa el `:3001` activo.
> Verificar con `\d products` que la columna existe en esa BD.

### 2. DTO

En `UpdateProductDto` (`create-product.dto.ts:176`), añadir el import `IsDateString` y
`ValidateIf` de `class-validator`, y el campo. Permitir `null` para limpiar:

```ts
// Fecha de compra manual (editable desde el listado). null = limpiar.
@IsOptional()
@ValidateIf((o) => o.manualPurchaseDate !== null)
@IsDateString()
manualPurchaseDate?: string | null;
```

(`<input type="date">` emite `"YYYY-MM-DD"`, aceptado por `@IsDateString` como ISO-8601.)

### 3. Service — helper de precedencia (DRY)

Añadir método privado en `ProductsService` para no duplicar la lógica entre `findAll` y `findOne`:

```ts
private resolveLastPurchase(
  albaranDate: Date | null,
  manualDate: Date | null,
): { lastPurchaseDate: Date | null; purchaseDateSource: "albaran" | "manual" | null } {
  if (albaranDate && manualDate) {
    return albaranDate >= manualDate
      ? { lastPurchaseDate: albaranDate, purchaseDateSource: "albaran" }
      : { lastPurchaseDate: manualDate, purchaseDateSource: "manual" };
  }
  if (albaranDate) return { lastPurchaseDate: albaranDate, purchaseDateSource: "albaran" };
  if (manualDate) return { lastPurchaseDate: manualDate, purchaseDateSource: "manual" };
  return { lastPurchaseDate: null, purchaseDateSource: null };
}
```

### 4. `findAll()` (`:224-228`)

Reemplazar el `.map` actual por:

```ts
const productsWithLastPurchase = products.map((p) => {
  const { albaranLines, ...rest } = p as any;
  const albaranDate = albaranLines?.[0]?.albaran?.date ?? null;
  const manualDate = (rest.manualPurchaseDate as Date | null) ?? null;
  const { lastPurchaseDate, purchaseDateSource } = this.resolveLastPurchase(
    albaranDate,
    manualDate,
  );
  return { ...rest, lastPurchaseDate, purchaseDateSource };
});
```

(`manualPurchaseDate` es escalar → ya viene en `p` porque `include` no lo excluye.
Se conserva también en `rest`, inofensivo, y lo necesita el frontend para sembrar el input.)

### 5. `findOne()` (`:238-259`)

Añadir `albaranLines` al `include` (mismo shape que `findAll`) y calcular con el helper:

```ts
include: {
  category: { include: { parent: true } },
  supplier: true,
  purchaseFormats: true,
  nutritionalInfo: true,
  stocks: true,
  albaranLines: {
    select: { albaran: { select: { date: true } } },
    orderBy: { albaran: { date: "desc" } },
    take: 1,
  },
},
```

Antes del `return`, extraer `albaranLines`, calcular `lastPurchaseDate`/`purchaseDateSource`
con `resolveLastPurchase` y devolver el producto enriquecido (sin `albaranLines` crudo).

### 6. `update()` — conversión a Date

En `update()` (`:275-284`), `manualPurchaseDate` entra por `...updateData` como **string**.
Prisma `DateTime` NO acepta `"YYYY-MM-DD"` crudo. Convertir explícitamente antes del
`prisma.product.update` (`:374`):

```ts
if (updateData.manualPurchaseDate !== undefined) {
  data.manualPurchaseDate = updateData.manualPurchaseDate
    ? new Date(updateData.manualPurchaseDate)
    : null; // string vacío/null → limpiar
}
```

## Validación

```bash
cd backend
npx prisma generate
npm run build          # typecheck + compilación
npm run start:prod     # relanzar (dist, no watch — memoria backend-dist-mode-not-watch)
```

Pruebas manuales (curl; auth: `X-Tenant-Slug: chefchek-demo`, Bearer session, admin@chefchek.local/admin123 — memoria `api-testing-auth-session-tenant`):

1. `PATCH /api/v1/products/:id` `{ "manualPurchaseDate": "2026-07-09" }` → 200; `GET` listado muestra esa fecha con `purchaseDateSource: "manual"` en un producto sin albarán.
2. Producto con albarán anterior a 2026-07-09 → fecha manual gana (`manual`).
3. Fecha manual anterior al último albarán → gana albarán (`albaran`).
4. `PATCH { "manualPurchaseDate": null }` → limpia; vuelve a `albaran` o `null`.

## Riesgos / rollback

- Migración additiva nullable → rollback = `DROP COLUMN` (solo pierde fechas manuales introducidas; datos preexistentes intactos). Confirmación explícita antes de destruir (regla cero-pérdida).
- Si `prisma migrate dev` intenta reset por drift, NO aceptar; usar `migrate deploy`/SQL quirúrgico sobre la BD activa (memorias `two-postgres-databases-dev`, `superadmin-missing-from-active-db`).

## Interfaz que expone a la Fase 02

Respuesta de producto (`findAll` y `findOne`) incluye:
- `manualPurchaseDate: string | null` (ISO)
- `lastPurchaseDate: string | null` (ISO, ya = max)
- `purchaseDateSource: "albaran" | "manual" | null`
