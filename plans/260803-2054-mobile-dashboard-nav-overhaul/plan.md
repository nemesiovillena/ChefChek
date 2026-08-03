---
title: Dashboard móvil - fixes + rediseño de menú
status: in-progress
priority: P1
effort: large
branch: main
tags: [frontend, backend, dashboard, navigation, mobile]
created: 2026-08-03
---

# Dashboard móvil: fixes + rediseño de menú

## Contexto

Usuario reporta 3 problemas en móvil + pide rediseñar el menú. Diagnóstico
confirmado leyendo código (no hipótesis):

1. **Cards "más grandes" en el primer render tras login** (con scroll extra),
   se autocorrige al navegar y volver. Root cause: `.material-symbols-outlined`
   usa `font-display: block` sin `width`/`overflow` fijos — mientras la
   fuente no está cacheada, el `<span>` se mide con el texto literal del
   icono ("notifications_active"...), inflando la altura de las cards. En
   móvil (red más lenta) es más frecuente. `frontend/src/app/globals.css:5-27`.
2. **"Pedidos Pendientes" siempre en 0**: KPI cuenta el modelo legacy `Order`
   (nunca se puebla, `backend/src/modules/dashboard/dashboard.service.ts:153`).
   Los pedidos reales viven en `PurchaseOrder` (compras).
3. **"Notificaciones y Alertas" del dashboard siempre vacía**: escucha eventos
   WS (`productionAlert`, `stockLow`, `stockCritical`) que el backend define
   pero nunca emite fuera de tests (`backend/src/websocket/websocket.service.ts:108-152`).
   La campana del header sí funciona (feed persistido `Alert`).
4. **Menú confuso**: estructura plana actual no coincide con el modelo mental
   del usuario. Nueva taxonomía acordada (ver Fase 5).

## Decisiones del usuario (no reabrir sin motivo nuevo)

- Producción: solo dentro de Cocina (se retira duplicado top-level).
- Almacén: Albaranes, Proveedores, Stock (ex "Almacén"), Histórico de precios.
- Pedidos Pendientes: contar `PurchaseOrder` en ENVIADO/RECIBIDO_PARCIAL.
- Notificaciones y Alertas (card dashboard): sustituir por el mismo feed
  persistido que usa la campana (no eventos WS en vivo).
- Histórico de precios: construir página global nueva (no existe hoy, solo
  hay vista por artículo).

## Fases

1. [phase-01-icon-fouc-and-bottom-nav.md](phase-01-icon-fouc-and-bottom-nav.md) — fix CSS + ajuste bottom nav
2. [phase-02-pedidos-pendientes-kpi.md](phase-02-pedidos-pendientes-kpi.md) — reconectar KPI a Compras real
3. [phase-03-alerts-card-real-feed.md](phase-03-alerts-card-real-feed.md) — card de alertas con feed real
4. [phase-04-historico-precios-page.md](phase-04-historico-precios-page.md) — página global nueva
5. [phase-05-nav-restructure.md](phase-05-nav-restructure.md) — nueva taxonomía de menú

## Acceptance criteria

- Sin layout-shift visible en `/dashboard` en carga fría (throttling 3G).
- "Pedidos Pendientes" refleja pedidos reales ENVIADO/RECIBIDO_PARCIAL y
  enlaza a Compras.
- "Notificaciones y Alertas" muestra las mismas alertas reales que la
  campana (o vacío real, no simulado).
- `/dashboard/historico-precios` lista cambios de precio de todo el tenant,
  paginado.
- Menú (desktop + móvil) refleja la taxonomía acordada; rutas existentes
  siguen funcionando (sin 404s).
- `bun run build` (frontend) y build backend sin errores nuevos.
