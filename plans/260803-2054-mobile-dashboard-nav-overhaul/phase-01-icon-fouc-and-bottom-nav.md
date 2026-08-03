# Fase 1 — Fix FOUC de iconos + ajuste bottom nav móvil

## Archivos
- `frontend/src/app/globals.css`
- `frontend/src/app/dashboard/layout.tsx`

## Pasos
1. En `.material-symbols-outlined` (globals.css) añadir `width: 1em; height: 1em;
   overflow: hidden;` para que, mientras la fuente no cargó, el fallback
   (texto literal del icono) quede recortado al tamaño del icono en vez de
   inflar el contenedor. No depende de preload ni de velocidad de red.
2. Bottom nav móvil (`layout.tsx` ~línea 323): subir `h-14` → `h-16`, iconos
   `text-[20px]` → `text-[22px]`, label `text-[9px]` → `text-[10px]`, algo
   más de `py`. Confirmar que `pb-28` del wrapper de contenido sigue
   dejando aire suficiente.

## Validación
- Chrome DevTools, throttling "Slow 3G" + cache de fuentes deshabilitado,
  recargar `/dashboard`: sin salto de altura en las cards.
