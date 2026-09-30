# Research Report: Listas de compra — unidades recordadas al cargar

**Fecha:** 2026-09-27 13:05
**Estado:** Investigación completada, fix NO aplicado (pendiente de aprobación)

## Executive Summary

Al abrir una lista en Compras → Listas, cada artículo muestra las unidades de la última compra. **No es un bug de datos ni una consulta al histórico**: el editor siembra cada fila con `defaultQuantity` persistida en `purchase_list_items`, y esa cantidad la escribe el propio editor al guardar (y también "Programar pedido" al crear listas desde un pedido). Fix mínimo: 1 línea en `listas-tab.tsx:236` (`item.defaultQuantity` → `1`).

## Methodology

- Fuentes: solo repo (sin web). Regla Scout First — pregunta contestable leyendo código.
- Archivos trazados: `listas-tab.tsx`, `purchase-list.service.ts`, `purchase-schedule.service.ts`, `purchase-list.dto.ts`, `schema.prisma`, `use-purchase-lists.ts`.

## Key Findings

### Flujo actual (cadena completa)

```
CARGAR lista (listas-tab.tsx:222-240)
  fila.quantity = item.defaultQuantity   ← ❗ AQUÍ aparecen las unidades viejas
  (pendingCatalog y sincronizar catálogo ya usan quantity: 1)

GUARDAR lista (listas-tab.tsx:273-278)
  defaultQuantity = fila.quantity        ← el editor escribe lo tecleado
  (solo filas checked; las demás se borran: update() = deleteMany + create)

OTRO ESCRITOR: programar pedido desde detalle
  (purchase-schedule.service.ts:329)
  defaultQuantity = unidades reales del pedido   ← lista creada desde pedido
```

### Quién LEE defaultQuantity (impacto del fix)

1. **Editor al cargar** (`listas-tab.tsx:236`) — lo que el usuario ve. Único punto a cambiar.
2. **`suggestQuantity`** (`purchase-list.service.ts:138-144, 184-200`) — solo al generar pedido SIN `items` en el body (p.ej. generación programada por cron de PurchaseSchedule). Si hay stock configurado y por debajo del umbral, reponer hasta máximo (ignora defaultQuantity salvo como fallback).
3. DTO `purchase-list.dto.ts:21` — opcional, `?? 1` en service.

**El editor siempre envía `items` con cantidades al generar pedido** (`listas-tab.tsx:370`), así que el usuario nunca ve sugerencias: lo que escribe es lo que va al pedido.

### Conclusión

La percepción "unidades de la última vez que se compró" = cantidades tecleadas en el último guardado de esa lista (coinciden con la compra porque se ajustan al pedir). El diseño actual recuerda cantidades; el usuario quiere empezar siempre en 1.

## Recommended Fix (mínimo, KISS)

`frontend/src/app/dashboard/compras/components/listas-tab.tsx:236`:

```diff
         : list.items.map((item) => ({
             productId: item.productId,
             name: item.product?.name ?? item.productId,
             unitHint: item.product?.purchaseFormat || item.product?.referenceUnit || '',
-            quantity: item.defaultQuantity,
+            quantity: 1,
             checked: false,
           })),
```

Actualizar el comentario de las líneas 219-221 para cubrir también la cantidad ("ningún artículo se marca y la cantidad arranca en 1").

**Qué NO cambiar (y por qué):**
- El write-back `defaultQuantity: r.quantity` al guardar (línea 277): inocuo para el editor (siempre carga 1) y mantiene un fallback razonable para la generación programada por cron (`suggestQuantity`).
- `purchase-schedule.service.ts:329`: ídem; las listas creadas desde un pedido conservan unidades como fallback de cron, pero al abrirlas en el editor mostrarán 1.
- Schema: `defaultQuantity Float @default(1)` sigue teniendo sentido. No hay migración.

**Efecto:** cargar cualquier lista → todas las unidades en 1; el usuario ajusta a mano ("ya lo cambiaremos si son más"). Ya cubierto también para catálogo pendiente (l.229) y sincronizar catálogo (l.313).

## Unresolved Questions

1. **Generación programada (cron)**: al generar pedidos sin intervención, `suggestQuantity` usará como fallback las últimas unidades guardadas. ¿Correcto, o también debería ser 1? (Recomiendo dejarlo como está.)
2. ¿Hacer backfill de `defaultQuantity` existentes a 1? Innecesario si el fix es solo de carga — el valor persistido deja de verse en el editor. No recomiendo tocar datos.
