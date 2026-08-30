# Fase 02 — Lectura de lotes + búsqueda de artículo tolerante

## Contexto

- `backend/src/modules/albaranes/services/lot.service.ts` — hoy solo
  `createLotFromReception(client, params)`. **No inyecta `PrismaService`**
  (recibe el client por parámetro).
- `backend/src/modules/products/products.service.ts:192` `findNameMatches()` —
  `$queryRaw` con normalización de acentos + separadores, match
  "exacto/contiene/primera palabra ≥3". Afinado para **aviso de duplicados**;
  falla con consultas conversacionales por voz (p.ej. "lomo alto de añojo" no
  matchea "CR.añojo lomo alto": primera palabra `lomo` vs `anojo`, sin
  contención mutua). **No reutilizar aquí.**
- Modelos: `Lot` (`lotNumber`, `productId`, `supplierId`, `albaranLineId`
  `@@unique`, `quantity`, `expiryDate`, `receivedAt`), `AlbaranLine` (`lot`
  crudo, `matchedProductId`), `Albaran` (`date`, `internalNumber`,
  `supplierId`).

## Requisitos

### 2A — `LotService.findLots`

```ts
interface FindLotsFilters {
  tenantId: string;
  productIds?: string[];      // resueltos por el caller vía searchByNameLoose
  lotNumber?: string;         // búsqueda inversa; ILIKE, puede matchear varios
  supplierName?: string;      // ILIKE parcial
  from?: Date;                // contra albaran.date
  to?: Date;
  limit?: number;             // default 10 cuando no hay from/to; sin límite con rango
}
interface LotTraceabilityRow {
  productName: string;
  lotNumber: string;
  supplierName: string | null;
  albaranNumber: string | null;   // Albaran.albaranNumber (nº del proveedor)
  albaranInternalNumber: string | null; // Albaran.internalNumber
  albaranDate: string | null;     // ISO, Albaran.date
  quantity: number;
  unit: string | null;            // AlbaranLine.unit
  expiryDate: string | null;      // ISO o null — hoy SIEMPRE null (OCR no lo captura: 0/354 en prod)
  source: "lot_record" | "raw_line"; // trazabilidad del origen del dato
}
async findLots(filters: FindLotsFilters): Promise<LotTraceabilityRow[]>
```

Comportamiento:

1. Query principal sobre `lot` con `include` de `product`, `supplier`,
   `albaranLine.albaran`. `where`:
   - `tenantId`
   - `productId in productIds` (si viene)
   - `lotNumber` (si viene): igualdad `mode: "insensitive"`; si 0 resultados,
     reintentar con `contains`. Valores reales son cortos/ambiguos (`A1`,
     `1704`) → devolver todas las coincidencias.
   - fecha: `albaranLine.albaran.date >= from && <= to` (si viene). Si la línea
     no tiene albarán, usar `receivedAt` como respaldo del filtro temporal.
   - `supplier.name: { contains, mode: "insensitive" }` (si viene)
   - `orderBy: { albaranLine: { albaran: { date: "desc" } } }` (fallback
     `receivedAt desc`)
   - `take: limit` solo si no hay `from`/`to`.
2. **Fallback `raw_line`**: además, líneas `AlbaranLine` con `lot` no vacío,
   `lotRecord == null` (sin registro `Lot`), que cumplan los mismos filtros
   (`matchedProductId in productIds`, `albaran.date` en rango,
   `albaran.supplier.name` ILIKE). Mapear a `LotTraceabilityRow` con
   `source: "raw_line"`, `expiryDate: null`.
3. Concatenar ambas listas, ordenar por `albaranDate` desc, aplicar `limit` al
   total si aplica.

`LotService` pasa a inyectar `PrismaService`
(`../../../common/services/prisma.service`) en el constructor. NO cambia la
firma de `createLotFromReception`.

### 2B — `ProductsService.searchByNameLoose`

```ts
async searchByNameLoose(tenantId: string, query: string): Promise<{ id: string; name: string }[]>
```

- Tokeniza `query` por espacios tras normalizar (reusar el `translate()` de
  acentos + `regexp_replace('[-/(),.]',' ')` ya presente en la clase; extraer a
  constante/helper privado si evita duplicar el SQL).
- Descartar tokens < 3 letras y stopwords (`de`, `del`, `la`, `el`, `con`).
- `WHERE tenantId, deletedAt IS NULL` y **cada token** `ILIKE '%tok%'` sobre el
  nombre normalizado (AND — todos los tokens presentes).
- `ORDER BY` por nº de tokens que casan desc, luego `length(name)` asc; `LIMIT 10`.
- Si 0 resultados con AND, reintentar con OR (al menos 1 token) y devolver top 5.
- Sin `pg_trgm`, sin migración.

## Archivos

- **Modificar** `backend/src/modules/albaranes/services/lot.service.ts` —
  inyectar `PrismaService`, añadir `findLots` + interfaces.
- **Modificar** `backend/src/modules/products/products.service.ts` — añadir
  `searchByNameLoose`.
- **Modificar** `backend/src/modules/albaranes/albaranes.module.ts` — añadir
  `LotService` a `exports`.

## Pasos

1. `LotService`: constructor con `PrismaService`; implementar `findLots` (query
   Lot + fallback raw line + merge/orden/limit).
2. `ProductsService.searchByNameLoose`.
3. Exportar `LotService`.
4. El fallback `raw_line` es **incondicional**. Ya medido sobre backup de prod:
   49/403 líneas con `lot` no tienen registro `Lot` (12%). Sin fallback, esas
   entregas serían invisibles para la tool. No requiere más medición.

5. **Paso de medición ya hecho** (backup `Downloads/cmrt4tec…json`, NO
   commitear): 592 líneas / 403 con lot / 354 `Lot` / 49 sin registro /
   `expiryDate` 0/354 / cadena `Lot→line→albaran` 100% resoluble. Anotar tal
   cual en el report de la fase.

## Tests

- **Crear** `lot.service.spec.ts` (o ampliar si existe):
  - `findLots` por `productIds` sin rango → últimas N por `albaran.date` desc.
  - por `lotNumber` parcial → varias filas (2 proveedores, mismo string).
  - con `from`/`to` → excluye entrega fuera de rango; incluye 2 entregas dentro.
  - fallback `raw_line`: línea con `lot` y sin `lotRecord` aparece con
    `source: "raw_line"`, `expiryDate: null`.
  - `supplierName` ILIKE filtra.
- **Crear/ampliar** `products.service.spec.ts` para `searchByNameLoose`:
  - `"lomo alto de añojo"` matchea `"CR.AÑOJO FRES LOMO ALTO S/H S/T PREMIUM *"`
    (caso real de prod: tokens `lomo` ∧ `alto` ∧ `añojo` presentes; `de`
    descartado como stopword).
  - `"lomo"` matchea varios (hay ~10 productos con "lomo"), ordenados por
    nombre más corto primero.
  - query con solo stopwords → `[]`.
- **Actualizar** `albaranes.module.spec` si valida exports.

## Validación

```
bun run --cwd backend test -- lot.service products.service
bun run --cwd backend build
```

## Riesgos / rollback

- Lectura pura + un export de módulo. Sin migración, sin escritura.
- `PrismaService` en `LotService`: revisar que `createLotFromReception` sigue
  llamándose con `client` explícito desde `albaran-stock.service.ts` /
  `manual-albaran.service.ts` (no cambia).
- Rollback = revertir 3 archivos.
