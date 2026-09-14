---
phase: 4
title: Frontend dashboard cards reubicadas
status: completed
priority: P2
dependencies:
  - 2
  - 3
---

# Phase 4: Frontend — dashboard: cards reubicadas + alerta de caducidad

## Overview

En `frontend/src/app/dashboard/page.tsx`, sección "Atmospheric Secondary
Layer" (grid de 3 columnas, líneas ~550-577): se elimina la card `Temp.
Cámara Fría` (dato simulado con `Math.random()`, nunca fue real — líneas
~87-116 y ~565-576), `recetasCard` ocupa ese slot (3ª columna, sin cambios de
comportamiento — sigue a `/dashboard/recipes`), y el slot original de
`recetasCard` (1ª columna, línea ~551) pasa a una card nueva: teaser de
alertas de caducidad, que consume `kpis.expiringLabels` (fase 2) y navega al
panel de la fase 3.

## Requirements

- Funcional: eliminar `temp` state + `setInterval` de simulación (líneas
  ~87-116) — nunca tuvo dato real, no reemplazar por telemetría real (fuera
  de alcance).
- Funcional: eliminar el bloque JSX de `Temp. Cámara Fría` (líneas ~565-576).
- Funcional: `recetasCard` (línea ~434-451) se renderiza en el slot que
  ocupaba la card eliminada — mismo componente, mismo `onClick`, sin cambios.
- Funcional: nueva card `caducidadesAlertCard` en el slot original de
  `recetasCard` (línea ~551, 1ª columna). Contenido:
  - Sin alertas (`kpis.expiringLabels.count === 0`): título/estado neutral
    (mismo tono que el resto de cards, sin rojo).
  - Con alertas (`count > 0`): **título en rojo** (`text-error`, decisión
    original del usuario — el matiz visual "rojo" se traslada de un popup a
    esta card, no se pierde), contador de elementos próximos a
    caducar/caducados, y opcionalmente el nombre del más próximo
    (`kpis.expiringLabels.nearest.itemName`).
  - `onClick` → `router.push('/dashboard/appcc/caducidades')` (el panel de la
    fase 3), **no** `/dashboard/recipes`.
- Funcional: orden móvil (líneas ~523-532) — insertar
  `{canSeeEtiquetado && caducidadesAlertCard}` inmediatamente después de
  `{canSeeAlerts && notificacionesCard}` (confirmado en validación: mismo
  nivel de prioridad que las demás alertas del negocio, no al principio del
  todo) y quitar cualquier referencia a `temp`/cámara fría. Actualizar el comentario de líneas ~519-522 (ya no hay
  "Telemetría y Temp. Cámara Fría" que ocultar en móvil — si el bloque
  "Telemetría de Cocina en Vivo" de línea ~556-563 sigue vivo, ajustar el
  comentario para que solo hable de ese, no de cámara fría).
- Funcional: guard de acceso — la nueva card usa `canSeeEtiquetado` (ya
  declarado en el componente, línea ~69: `isEnabled('etiquetado') &&
  canSee('etiquetado')`), **no** `canSeeRecipes`. `recetasCard` reubicada
  sigue gateada por `canSeeRecipes` (sin cambio, solo cambia su posición en
  el grid).

## Architecture

No se crea un hook nuevo: `use-dashboard-kpis.ts` ya se consume en esta
página (`kpis` está disponible en el scope del componente, se ve usado en
`kpis?.scheduledDraftOrders` etc.). Solo hace falta leer el nuevo campo
`kpis?.expiringLabels` del mismo objeto — la fase 2 ya lo añadió al backend y
al tipo del hook.

Referencia de estilo para el rojo: `pedidosPendientesCard` (línea ~180-199)
ya usa `bg-error` para el badge numérico y `text-error font-bold`/`font-medium`
para texto condicional — replicar esos tokens exactos, no introducir un color
nuevo.

## Related Code Files

- Modify: `frontend/src/app/dashboard/page.tsx`
  - Eliminar: `const [temp, setTemp] = useState(3.2)` y su `useEffect` de
    simulación (~líneas 87-116).
  - Eliminar: bloque JSX `Temp. Cámara Fría` (~líneas 565-576).
  - Nuevo: `const caducidadesAlertCard = (...)` (definido junto a los demás
    fragmentos reutilizados, cerca de `recetasCard` ~línea 434).
  - Reordenar en la sección desktop (~líneas 550-577): 1ª columna =
    `caducidadesAlertCard`, 3ª columna = `recetasCard` (antes al revés,
    sin la card de cámara fría).
  - Actualizar bloque móvil (~líneas 523-532) y su comentario (~519-522).

## Implementation Steps

1. Borrar `temp` state + efecto de simulación.
2. Definir `caducidadesAlertCard` junto a los demás fragmentos (mismo estilo
   `tonal-layer-2 rounded-xl ...` que las cards vecinas, `cursor-pointer`,
   `onClick` al panel).
3. Recolocar `recetasCard` al slot antiguo de cámara fría; poner
   `caducidadesAlertCard` en el slot antiguo de `recetasCard`.
4. Borrar el bloque JSX de cámara fría.
5. Móvil: añadir `{canSeeEtiquetado && caducidadesAlertCard}` justo después
   de `{canSeeAlerts && notificacionesCard}` (línea ~528), quitar cualquier
   resto de comentario sobre cámara fría.
6. Revisar visualmente en `bun run dev` (o `run`/browser skill) ambos layouts
   (desktop grid y móvil) — confirmar que no queda un hueco vacío en el grid
   de 3 columnas ni un salto de layout raro.

## Success Criteria

- [ ] `Temp. Cámara Fría` y su simulación han desaparecido del código (grep
      `cámara fría`/`camara fria` sin resultados en `page.tsx`).
- [ ] `recetasCard` sigue navegando a `/dashboard/recipes` desde su nueva
      posición.
- [ ] Con `kpis.expiringLabels.count > 0`: card nueva muestra título en rojo
      y navega a `/dashboard/appcc/caducidades` al hacer click.
- [ ] Con `count === 0`: card en tono neutral, sin rojo, sigue navegando al
      panel igualmente (no queda "muerta" cuando no hay alertas).
- [ ] Card nueva respeta `canSeeEtiquetado` (oculta si el módulo/sección no
      está disponible para el usuario).
- [ ] Grid desktop de 3 columnas sin huecos; orden móvil coherente.
- [ ] `bun run build` frontend sin errores; smoke visual en `/dashboard` con
      y sin alertas de caducidad simuladas (usar datos de prueba).

## Risk Assessment

- **Regresión visual**: es la página de entrada de la app — verificar en
  ambos breakpoints (móvil/desktop) antes de dar por cerrada la fase, no
  solo compilar.
- **`kpis` puede tardar en cargar**: replicar el mismo patrón de loading que
  ya usan `pedidosPendientesCard`/`notificacionesCard` (estado `--`/skeleton
  mientras `kpisLoading`), no un layout distinto para esta card nueva.
- **Guard equivocado**: usar `canSeeEtiquetado` y no inventar un
  `canSeeAppcc` nuevo — el dato viene de `FoodLabel` (módulo `etiquetado`),
  igual que en la fase 3.
