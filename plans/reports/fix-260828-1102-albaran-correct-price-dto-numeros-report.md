# Fix — corrección de precio albarán fallaba en producción (400 silencioso)

Fecha: 2026-08-28 · Branch: `fix/albaranes-correct-price-dto-numeros` (off origin/main) · PR: #59 → develop

## Síntoma

Diálogo «Corregir precio asentado» (albarán 009757, producción, tenant warynessy) muestra siempre «Error al corregir el precio».

## Causa raíz (cadena verificada)

1. Diálogo envía `{"unitPrice": 12.5, "totalPrice": 125.92}` como **números** (`parseEsNumber` → Number) — `correct-price-dialog.tsx:89`.
2. `CorrectAlbaranLinePriceDto` declara `@IsString()` — `update-albaran.dto.ts`.
3. `ValidationPipe` global (`main.ts:63`): `transform:true` **sin** `enableImplicitConversion** → sin coercion number→string → 400 `unitPrice must be a string; totalPrice must be a string`. Verificado en vivo.
4. Mensaje enmascarado: `api-albaran.ts` lee `error.message` raíz; `GlobalExceptionFilter` anida en `error.error.message`.

## Repro

Backend con código desplegado (origin/main) en :3005, albarán CONFIRMADO dev:
- PRE: payload del diálogo → **400** (exacto a producción). Strings → 200.
- POST-fix: números → **200**; neto número/null → 200; edición inline numérica → 200.

## Fix (commit 15b1a39)

- `@Transform(numberAsString)` en frontera DTO: number→string; strings/null/ausentes intactos. `CorrectAlbaranLinePriceDto.unitPrice/.totalPrice` + `UpdateAlbaranLineDto.quantity/.unitPrice/.vatPercent/.priceWithVat`.
- `errorMessage()` en `api-albaran.ts` (13 sitios) desenmascara `error.error?.message`.
- Spec regresión `update-albaran.dto.spec.ts` con ValidationPipe real: 3/6 fallan sin fix.

## Daño colateral hallado (misma clase, pre-existente)

Edición inline de líneas (`editable-line-cell.tsx` manda `parseFloat` → DTO strings) daba 400 silencioso. Reparado por el mismo transform.

## Verificación

153/153 specs albaranes · nest build + next build + tsc FE verdes · lint 0 errores (3 warnings pre-existentes en otros archivos) · code-review: SHIP sin bloqueos · sin cambios de datos en dev (valores no-op en pruebas).

## Prevención

Specs con el pipe real cubren la clase number-vs-string en los DTOs de albaranes. FE ahora muestra el mensaje real del backend (no más enmascaramiento genérico).

## Follow-ups (no bloqueantes, fuera de alcance)

- Validación de contenido en `UpdateAlbaranLineDto` (`"abc"` pasa `@IsString` → NaN a Prisma); o migrar a `@IsNumber` como `create-albaran.dto.ts`.
- Swagger: documentar aceptación number|string en los campos con transform.

## Pendiente

Release develop→main (deploy producción) — a confirmar con el usuario.
