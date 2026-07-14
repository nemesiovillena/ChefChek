---
phase: 5
title: "Catálogos/tarifas de proveedor con IA, comparativa de proveedores y activación por local"
status: pending
---

## Context

- Motor OCR/IA reutilizable: [ocr-microservice/](../../backend/ocr-microservice/) — `app/services/ai_extraction_service.py` (multi-proveedor OpenAI/Gemini/Anthropic/OpenRouter), bridge [python-ocr.service.ts](../../backend/src/modules/ocr/python-ocr.service.ts)
- Gotchas conocidos del microservicio: import con guiones vs underscore, llaves JSON sin escapar en `prompt.format`, enviar imagen ORIGINAL (no binarizada) a la IA
- API keys client-side: [ai-api-keys.ts](../../frontend/src/lib/ai-api-keys.ts) (localStorage → FormData por request; prefijos AIza/AQ. para Gemini, sk-ant- Anthropic)
- Matching de referencia: [line-matching.service.ts](../../backend/src/modules/albaranes/services/line-matching.service.ts)
- `ProductSupplierOffer` + `isPreferred`; `OfferLocationSetting` y `Location` de fase 0
- Detección de pactados: `price-agreement.service.ts` (fase 4, integrar si está)
- PDR §F6, F7

## Requirements

1. `CatalogImport` + `CatalogImportLine`: subida de tarifa (PDF/imagen/Excel) por proveedor → extracción IA (producto, formato, precio) → líneas propuestas con matching contra artículos → revisión humana → aplicar.
2. Prompt nuevo en el microservicio para tarifas/catálogos (distinto del de albaranes), con llaves JSON escapadas.
3. Aplicar: crea/actualiza `ProductSupplierOffer` (respetando `isPreferred`), escribe `ProductPriceHistory`, y evalúa pactados (fase 4). **Nunca** aplica sin revisión; estados por línea (PROPUESTA/ACEPTADA/RECHAZADA).
4. Comparativa por artículo: todas las ofertas, mejor precio destacado (normalizado a precio de referencia €/kg-L-ud — usar `getReferencePrice`/lógica equivalente backend).
5. `OfferLocationSetting`: activar/desactivar oferta por local; helper compartido `resolveActiveOffer(productId, supplierId?, locationId?)` que las sugerencias de pedido (fase 1) pasan a usar.
6. Ampliar el criterio "artículos de un proveedor": hoy el buscador de listas/pedidos filtra por proveedor PRINCIPAL (`GET /v1/products?supplier=` — decisión usuario 2026-07-14: pedidos son por proveedor). Al existir ofertas multi-proveedor, debe ofrecer también artículos con `ProductSupplierOffer` de ese proveedor (backend: OR sobre offers en el filtro `supplier`).

## Files to modify

- `backend/prisma/schema.prisma` + migración aditiva — `CatalogImport`, `CatalogImportLine`
- `backend/ocr-microservice/app/` — endpoint/prompt de extracción de tarifas (reutilizando `ai_extraction_service.py`)
- `backend/src/modules/compras/services/catalog-import.service.ts` (+ spec) y `offer-resolution.service.ts` (+ spec, helper por local)
- `backend/src/modules/compras/compras.controller.ts` — `/v1/compras/catalogos*`, `/v1/compras/comparativa`
- `backend/src/modules/compras/services/purchase-list.service.ts` — sugerencias usan `resolveActiveOffer`
- `frontend/src/app/dashboard/compras/components/`: `catalog-import-uploader.tsx`, `catalog-import-review.tsx` (tabla con matching + diff de precio), `supplier-comparison-table.tsx` (badges mejor precio, toggles por local)
- `frontend/src/hooks/use-catalog-imports.ts`, `use-supplier-comparison.ts`

## Steps

1. Schema + migración.
2. Microservicio: prompt de tarifas (probar con 2-3 tarifas reales de formatos distintos); mantener fallback y logging de proveedor de IA usado.
3. Backend: subida (FormData, key IA por request), persistencia de propuestas, matching (reutilizar lógica de line-matching: exacto→fuzzy→NUEVO), aplicar transaccional.
4. Comparativa: normalizar precios a unidad de referencia antes de comparar (no comparar €/caja vs €/kg).
5. `OfferLocationSetting` + helper + integración en sugerencias de pedido.
6. Frontend: uploader → revisión → aplicar; comparativa con toggles por local.
7. Build backend + relanzar dist; reiniciar microservicio Python.

## Checking (criterios de aceptación)

- [ ] Subir tarifa PDF real → líneas extraídas con producto/precio; matching correcto en artículos existentes; no-matcheados marcados NUEVO
- [ ] Nada se escribe en ofertas hasta "Aplicar"; líneas RECHAZADAS no se aplican
- [ ] Aplicar actualiza `ProductSupplierOffer` + `ProductPriceHistory`; si hay pactado y se supera → desviación (fase 4)
- [ ] Comparativa muestra mejor precio normalizado a unidad de referencia (caso salmón caja 5kg vs kg verificado a mano)
- [ ] Activar oferta B en local X → sugerencias de pedido de X usan proveedor B; local Y sigue con la preferida
- [ ] Extracción funciona con key Gemini (AQ./AIza) y con Anthropic; error de key → mensaje claro, no fallback silencioso a regex
- [ ] Import de otro tenant inaccesible (tenant-scoped)
- [ ] Specs pasan; sin errores TS
- [ ] Informe en `reports/sprint-5-checking-report.md`
