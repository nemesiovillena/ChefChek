---
phase: 6
title: Verificacion
status: completed
priority: P2
dependencies:
  - 1
  - 2
  - 3
  - 4
  - 5
---

# Phase 6: Verificación end-to-end

## Overview

Cierre del plan: build + tests de las 5 fases anteriores, más verificación
manual del flujo completo (Settings → umbral → panel APPCC → dashboard).

## Requirements

- Backend: `bun run build` (modo `dist`, no watch — relanzar el proceso para
  probar) + `jest` de los módulos `etiquetado` y `dashboard`.
- Frontend: `bun run build` (typecheck incluido) + smoke visual manual.
- Datos de prueba: crear/editar al menos una `FoodLabel` (vía
  `/dashboard/etiquetado/nueva`) con `useByDate` manipulada a "mañana" para
  poder ver el estado `expiring_soon` en panel y dashboard sin esperar días
  reales.

## Implementation Steps

1. Backend: `bun run build` en `backend/`; relanzar el proceso (modo `dist`,
   no hay watch — ver memoria del proyecto). `jest` del módulo `etiquetado`
   (config + food-label service) y `dashboard` en verde.
2. Frontend: `bun run build`; sin errores de tipos (los tipos extendidos de
   `use-food-labels.ts` deben cuadrar en las 3 fases que los tocan).
3. Manual — Settings: cambiar `expiryWarningDays` a un valor bajo (ej. 1),
   guardar, recargar, confirmar que persiste.
4. Manual — crear una etiqueta con `useByDate` mañana (dentro del umbral) vía
   `/dashboard/etiquetado/nueva`.
5. Manual — panel `/dashboard/appcc/caducidades`: la etiqueta aparece con
   estado en rojo; toggle ELABORATED/HANDLED filtra correctamente; click en
   la fila abre la ficha de detalle existente.
6. Manual — dashboard `/dashboard`: la nueva card muestra el aviso en rojo
   con el contador correcto; click navega al panel; card de recetas en su
   nueva posición sigue funcionando; card de cámara fría ya no existe.
7. Manual — anular la etiqueta de prueba (`void`) y confirmar que desaparece
   del conteo de alertas (dashboard) y del panel por defecto.
8. Manual — probar con un usuario/tenant sin módulo `etiquetado` activo: nav
   item del panel oculto, card de alertas del dashboard oculta, acceso
   directo a la URL del panel bloqueado.
9. Revisar responsive del dashboard (móvil) tras el cambio de cards.

## Success Criteria

- [x] Backend: build + `jest` en verde — suite completa 129 suites/1935
      tests (no solo `etiquetado`/`dashboard`, para pillar regresiones por el
      cambio de constructor de `FoodLabelService` y el nuevo import
      `DashboardModule`→`EtiquetadoModule`).
- [x] Frontend: `tsc --noEmit` + `eslint` en los archivos tocados, sin
      errores.
- [ ] Flujo manual (pasos 3-9): **delegado al usuario** — decisión explícita
      (el dev server accesible en este entorno sirve el checkout principal,
      no este worktree; ver memoria del proyecto). El usuario lo prueba en su
      entorno local.
- [x] Sin regresiones detectadas por `code-reviewer` en
      `/dashboard/recipes`, `/dashboard/etiquetado`,
      `/dashboard/etiquetado/[id]` — confirmado por lectura de diff + suite
      completa en verde.
- [x] Ningún rastro de "cámara fría"/telemetría simulada en el código
      (`grep -rn "cámara fría\|camara fria" frontend/src` sin resultados,
      verificado).

## Risk Assessment

- **Riesgo principal ya cubierto por fases anteriores** — esta fase es de
  verificación, no de implementación nueva. Si algo falla aquí, el fix vuelve
  a la fase correspondiente (no se parchea directamente en esta fase).
