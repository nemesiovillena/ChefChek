# Fase 1 — Endpoint `GET /products/check-name`

## Contexto
`findAll` usa `ILIKE %term%` (no ignora acentos). Para accent-folding se normaliza con `translate(lower(trim()))` en SQL raw (sin extensión Postgres). El controlador declara rutas específicas antes de `@Get(":id")` → la nueva ruta debe ir antes también.

## Archivos
- `backend/src/modules/products/products.service.ts` — añadir `findNameMatches(tenantId, name, excludeId?)`
- `backend/src/modules/products/products.controller.ts` — añadir `@Get("check-name")` antes de `@Get(":id")`

## Implementación
### Service
Constantes de acentos (Spanish):
```
FROM='áàäéèëíïóòöúùüñç'  TO='aaaeeeiiouuunc'
```
Método (raw SQL parametrizado, activos, mismo tenant, excluye id opcional, LIMIT 5):
```sql
SELECT p.id, p.name, p."isActive"
FROM products p
WHERE p."tenantId" = $1
  AND p."deletedAt" IS NULL
  [AND p.id <> $excludeId]
  AND translate(lower(trim(p.name)), FROM, TO) = translate(lower(trim($name)), FROM, TO)
ORDER BY p.name LIMIT 5
```

### Controller
```ts
@Get("check-name")
@Roles("ADMIN","USER","VIEWER")
async checkName(@Query("name") name:string, @Query("excludeId") excludeId:string|undefined, @Req() req:any) {
  const matches = await this.productsService.findNameMatches(req.tenantId, (name||"").trim(), excludeId);
  return { success:true, data: matches };
}
```
Declarar DESPUÉS de `@Get()` findAll y ANTES de `@Get("categories")` (garantiza precedencia sobre `:id` en l.327).

## Validación
- `npm run build` backend OK.
- `:3001` corre desde `dist` → build + reiniciar proceso.
- curl: `GET /api/v1/products/check-name?name=Tomate` (con auth/tenant) → `[{id,name,isActive}]`.

## Rollback
Revertir los 2 archivos (cambio additive, sin migración).
