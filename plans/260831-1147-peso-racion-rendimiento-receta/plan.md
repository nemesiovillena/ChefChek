# Peso ración / rendimiento de receta (opción B)

**Estado: IMPLEMENTADO** (2026-08-31, rama `feat/recipe-yield-weight-anchor`).
Fases 1-4 completas. Backend 1806 tests verdes, frontend build + tsc + eslint OK.
Ver `reports/impl-260831-1147-peso-racion-rendimiento-receta-report.md`.

## Objetivo
Añadir "Peso total elaborado (g)" a la receta como ancla de rendimiento. El usuario
edita cualquiera de los tres campos (Peso total, Raciones, Peso ración) y los otros
se recalculan manteniendo la invariante `pesoTotal = raciones × pesoRación`.
Raciones pasa a admitir decimales.

## Decisiones (confirmadas con el usuario)
- Opción B: campo persistido nuevo `Recipe.totalYieldWeight` (Float, gramos, opcional).
- Backfill de recetas existentes: `totalYieldWeight = portions × portionSize`.
- `Recipe.portions` Int → Float (raciones con decimales).
- Regla de recálculo ("Raciones manda"): editar Peso total NUNCA cambia Raciones
  (recalcula Peso ración). Editar Raciones o Peso ración recalcula el otro.
- `portionSize` sigue siendo columna persistida (derivada = pesoTotal / raciones en
  guardado) → `computeCostPerYieldUnit` y todo el costeo aguas abajo quedan intactos.
- `costPerPortion = totalCost / portions` sin cambios (ahora portions puede ser decimal).
- Fuera de alcance: `Menu.portions` (modelo distinto, sigue Int).

## Fases
| # | Fase | Depende de | Archivo |
|---|------|-----------|---------|
| 1 | Migración schema + backfill | — | phase-01-schema-migration.md |
| 2 | Backend: DTO, service, response | 1 | phase-02-backend-yield.md |
| 3 | Frontend: campos enlazados + tipos + fix parseFloat | 2 | phase-03-frontend-linked-fields.md |
| 4 | Tests + verificación | 2,3 | phase-04-tests-verificacion.md |

## Criterios de aceptación
- Editar "Peso ración" en una receta guarda y recalcula Raciones (decimales).
- Editar "Peso total" recalcula Peso ración, deja Raciones fija.
- Recetas existentes abren con `totalYieldWeight` = raciones×pesoRación previos, sin
  cambio de coste.
- `costPerPortion`, `totalCostPerUnit`, PVP teórico y márgenes idénticos a antes para
  una receta sin editar.
- `bun run` build backend + `jest` recipes verdes.

## Riesgos
- Cambio de tipo de columna `portions` en Postgres: `ALTER COLUMN ... TYPE double
  precision` es seguro (widening) pero requiere migración manual sin TTY
  (ver [[prisma-migrate-dev-non-interactive-workaround]]).
- Dos bases Postgres en dev ([[two-postgres-databases-dev]]): migrar la del :3001.
- `@Min(1)` en DTO portions rechazaría raciones < 1 derivadas (p.ej. 100g / 250g =
  0.4) → bajar a `@Min(0.01)`.

## Preguntas abiertas
- ¿Formato de visualización de raciones decimales en listado/PDF? (propuesta: hasta 2
  decimales, sin ceros de relleno). Confirmar en fase 3.
