---
phase: 1
title: Tipar matchedProduct.purchasePrice
status: completed
priority: P3
dependencies: []
---

# Phase 1: Tipar matchedProduct.purchasePrice

## Overview

Ampliar el tipo `AlbaranLine.matchedProduct` en el frontend para exponer `purchasePrice`
(y `previousPurchasePrice`, gratis y útil para depurar/tooltip). El dato ya llega en la
respuesta de `GET /albaranes/:id` — no hace falta tocar backend.

## Requirements

- Funcional: `line.matchedProduct.purchasePrice` debe ser accesible y tipado como
  `number` desde el componente de la Fase 2.
- No funcional: no romper ningún uso existente de `AlbaranLine.matchedProduct` (hoy solo
  se lee `.name` y `.discountPercentage` en `lineas/page.tsx`).

## Verification (antes de tocar código)

`albaranes.service.ts:136-156` (`findOne`) hace:
```ts
lines: {
  include: { matchedProduct: true, suggestedProduct: true },
  ...
}
```
`matchedProduct: true` (sin `select`) en Prisma incluye **todas** las columnas escalares
del modelo `Product`, incluida `purchasePrice`. `albaranes.controller.ts` (ruta
`findOne`/`GET :id`, línea ~140) devuelve el resultado del service tal cual, sin DTO de
respuesta ni `ClassSerializerInterceptor` que filtre campos. Confirmar con una llamada real
antes de tocar el tipo (evita asumir sobre un contrato que pudo cambiar):

```bash
# login primero para obtener session id (ver memoria api-testing-auth-session-tenant)
curl -s -H "Authorization: Bearer <session-id>" -H "X-Tenant-Slug: chefchek-demo" \
  "http://localhost:3001/api/v1/albaranes/<id-de-un-albaran-con-lineas-matcheadas>" \
  | jq '.data.lines[0].matchedProduct'
```
Si `purchasePrice` no aparece en la respuesta, esta fase cambia: habría que añadir un
`select` explícito en `albaranes.service.ts:146`. Si aparece (caso esperado), solo se toca
el frontend.

## Related Code Files

- Modify: `frontend/src/lib/api-albaran.ts` (interfaz `AlbaranLine`, línea ~29)

## Implementation Steps

1. En `frontend/src/lib/api-albaran.ts`, localizar:
   ```ts
   matchedProduct: { id: string; name: string; netPrice: number; discountPercentage: number } | null;
   ```
2. Ampliar a:
   ```ts
   matchedProduct: {
     id: string;
     name: string;
     netPrice: number;
     discountPercentage: number;
     purchasePrice: number;
   } | null;
   ```
   (No añadir `previousPurchasePrice` ni otros campos salvo que la Fase 2 los necesite —
   YAGNI; el tipo debe reflejar solo lo que se consume.)
3. `npx tsc --noEmit` en `frontend/` para confirmar que no hay otros sitios que
   desestructuren `matchedProduct` de forma incompatible con el campo nuevo (añadir un
   campo requerido nunca rompe consumidores existentes, pero conviene comprobar que no
   hay mocks/tests con un objeto `matchedProduct` literal que ahora falte `purchasePrice`).

## Success Criteria

- [ ] `curl` contra `GET /albaranes/:id` confirma que `purchasePrice` ya está en
      `matchedProduct` en la respuesta real (paso de verificación, no de código).
- [ ] `AlbaranLine.matchedProduct.purchasePrice` tipado como `number` en
      `api-albaran.ts`.
- [ ] `npx tsc --noEmit` sin errores nuevos en `frontend/`.

## Risk Assessment

Riesgo mínimo: cambio de tipo puro, sin tocar runtime ni backend. Único riesgo real es que
la verificación con `curl` desmienta la asunción (Prisma `include: { matchedProduct: true }`
sin `select` ya filtrado en otro punto no visto) — en ese caso, la Fase 1 se amplía con un
cambio de backend de una línea (`select: { ..., purchasePrice: true }`) antes de tocar el
frontend. Sin rollback necesario en el caso esperado (solo tipos).
