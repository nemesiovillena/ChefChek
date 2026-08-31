---
phase: 5
title: Frontend módulo Etiquetado
status: completed
priority: P1
effort: ~1.5 sesión
dependencies:
  - 2
  - 3
---

# Phase 5: Frontend módulo Etiquetado

## Overview

Módulo `/dashboard/etiquetado`: listado con histórico, alta de etiqueta (2 flujos), detalle con re-impresión/anulación, ficha de trazabilidad que abre el QR, y wiring de nav + api-client + hooks React Query.

## Requirements

- Funcional:
  - **Listado** `/dashboard/etiquetado`: tabla paginada server-side (patrón del proyecto), filtros (tipo, rango de fechas, receta/artículo, búsqueda por lote, incluir anuladas), botón "Nueva etiqueta".
  - **Alta** `/dashboard/etiquetado/nueva`:
    - Paso 1: elegir **Elaborado (receta)** o **Manipulado (artículo)** + picker de entidad (recetas: `/recipes/options`; artículos: `useProductSearch` server-side — memoria `useproducts-default-pagesize-50`).
    - Paso 2 (Elaborado): `preparedAt` (default ahora), cantidad/raciones, `ConservationFieldset` precargado desde la receta (editable), **lista de ingredientes** con selector de lote por ingrediente (opciones de `prep-context` + "sin especificar" + texto libre), preselección del último lote, sub-recetas listadas sin selector, toggle "se congela" → `frozenAt` + días congelado, `notes`. <!-- Updated: Validation Session 1 - sin picker de orden de producción en v1 -->
      (v1: **sin** picker de orden de producción — `productionOrderId` queda solo como columna de BD.)
    - Paso 2 (Manipulado): selector de **lote de proveedor** (de `prep-context.lots`), `manufacturerExpiryDate` (precargado de `Lot.expiryDate`), `preparedAt` = fecha de manipulación, cantidad, `ConservationFieldset` precargado del artículo, toggle congelar, `notes`.
    - **Vista previa** de la etiqueta + selector de formato (Térmica 57 / Térmica 100 / A4) + nº de copias → "Guardar e imprimir": `POST /labels` y luego abrir el PDF.
  - **Detalle** `/dashboard/etiquetado/[id]`: ficha completa, botones "Re-imprimir" (abre `/labels/:id/pdf?...&reprint=1`), "Anular" (dialog M3 `useConfirm()` — memoria `m3-destructive-dialog-replaces-native-confirm`, con motivo).
  - **Trazabilidad pública** `/e/[qrToken]` — <!-- Updated: Validation Session 1 - ruta pública fuera de /dashboard, sin login -->
    ruta a **nivel de app, FUERA de `/dashboard`** (no pasa por el layout autenticado). Llama `GET /api/v1/etiquetado/public/trace/:qrToken`. Vista de solo lectura: producto, lote, fechas, consumo preferente, conservación + °C, alérgenos, ingredientes + lotes, estado anulada. **Responsable: iniciales o rol, nunca nombre completo.** Sin botones de acción (re-imprimir/anular solo en el detalle interno). Diseño simple, legible en móvil, con branding del establecimiento.
- No funcional:
  - Gating de módulo en frontend (patrón existente: `nav-config` + comprobación de módulos activos del tenant).
  - iOS: si el PDF se abre en pestaña nueva tras un `fetch`, usar `window.open` **síncrono** en el gesto + navegar luego (memoria `ios-window-open-must-be-sync`).
  - Títulos de página con `<div>` no `<header>` (memoria `globals-css-hides-page-header-too`); tabs con `role="tablist"` (memoria `globals-css-hides-nav-tabs`).
  - Menú móvil fijo: overlays `fixed inset-0` necesitan `pb-28 md:pb-8` (memoria `mobile-bottom-nav-fixed-overlap-convention`).
  - api-client desenvuelve `{success,data}` y respuestas paginadas (memorias `apiclient-interceptor-unwrap-...`, `frontend-api-client-paginated-unwrapping`) — usar `result.id` directo; no `result.data.id`.
  - Invalidar React Query queries tras crear/anular (memorias varias `*-stale-after-*`): invalidar `['food-labels']` y el detalle.

## Architecture

```
frontend/src/features/etiquetado/
  api.ts                     # llamadas api-client
  hooks/
    use-food-labels.ts       # listado paginado
    use-food-label.ts        # detalle
    use-prep-context.ts
    use-create-food-label.ts # mutation + invalidación
    use-void-food-label.ts
  components/
    conservation-fieldset.tsx   # (compartido con fase 4)
    label-preview.tsx
    ingredient-lot-picker.tsx
    food-label-filters.tsx
  types.ts

frontend/src/app/dashboard/etiquetado/
  page.tsx                    # listado
  nueva/page.tsx              # alta (wizard 2 pasos)
  [id]/page.tsx               # detalle interno (autenticado, datos completos)

frontend/src/app/e/[qrToken]/page.tsx   # trazabilidad PÚBLICA (QR target, sin login, fuera de /dashboard)
```

Comprobar que el middleware/guard de auth del frontend **no** protege `/e/*` (solo `/dashboard/*`). Si el middleware usa allowlist, añadir `/e`.

- `nav-config.ts` (`frontend/src/features/modules/lib/nav-config.ts`): entrada "Etiquetado" (`moduleId: "etiquetado"`) en el grupo Seguridad/APPCC.
- Formato de fecha en español (`dd/MM/yyyy HH:mm`), zona Europe/Madrid.

## Related Code Files

- Create: todo `frontend/src/features/etiquetado/**`, `frontend/src/app/dashboard/etiquetado/**` y `frontend/src/app/e/[qrToken]/page.tsx`
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (grupo Seguridad/APPCC)
- Verify/Modify: middleware de auth del frontend (que `/e/*` quede fuera del muro de login)
- Reference: un módulo reciente con listado paginado + wizard (p.ej. `compras/pedidos`, `albaranes`) para el patrón de tabla/filtros/paginación
- Reference: `frontend/src/app/dashboard/sala-notificaciones/*` (módulo `defaultEnabled:false` reciente)

## Implementation Steps

1. `api.ts` + `types.ts` + hooks React Query.
2. Listado `page.tsx` con filtros + paginación server-side + estado vacío.
3. `nueva/page.tsx` paso 1 (tipo + picker).
4. Paso 2 Elaborado: form + `IngredientLotPicker` + `ConservationFieldset` + `LabelPreview`.
5. Paso 2 Manipulado: form + selector de lote proveedor + `ConservationFieldset` + `LabelPreview`.
6. "Guardar e imprimir": mutation → abrir PDF (patrón iOS-safe).
7. Detalle `[id]/page.tsx` con re-imprimir + anular (`useConfirm`).
8. Trazabilidad pública `app/e/[qrToken]/page.tsx` (sin login; verificar que el middleware no la bloquea).
9. `nav-config` (grupo Seguridad/APPCC) + verificación de gating (módulo off → sin entrada, ruta redirige/403).
10. `tsc --noEmit` frontend verde; prueba manual con `agent-browser` / navegador en puerto propio (memoria `dev-server-3000-runs-from-main-checkout` → usar puerto propio + `E2E_BASE_URL`).

## Success Criteria

- [ ] Flujo completo Elaborado (*Jarrete*): elegir receta → elegir lotes de ingredientes → guardar → PDF térmico con QR → escanear QR abre `/e/[qrToken]` **en un navegador sin sesión** con la ficha correcta y sin nombre completo del responsable.
- [ ] Flujo completo Manipulado (*Lubina*): elegir artículo → elegir lote proveedor → caducidad fabricante precargada → guardar → PDF A4 ×N.
- [ ] Listado pagina, filtra y oculta anuladas salvo filtro activo.
- [ ] Re-imprimir incrementa contador; anular con motivo saca la etiqueta del listado por defecto.
- [ ] Con módulo `etiquetado` desactivado: sin entrada de menú y ruta no accesible.
- [ ] `tsc --noEmit` frontend verde.

## Risk Assessment

- Wizard con mucho estado → mantenerlo en el componente de página (no URL routing para pasos internos; memoria `modal-tabs-usestate-vs-url-routing-standard` aplica el criterio de "useState para pasos internos").
- Apertura de PDF en iOS → patrón `window.open` síncrono.
- Recetas con sub-recetas: dejar claro en la UI que sólo se trazan ingredientes directos en v1.
