# Fase 4 — Tests + verificación

## Backend (jest, NO bun test — [[backend-tests-use-jest-not-bun-test]])
`backend/src/modules/recipes/recipes.service.spec.ts`:
- create con `totalYieldWeight: 2000`, `portions: 8` → persiste `portionSize: 250`.
- create sin `totalYieldWeight`, `portions: 4`, `portionSize: 125` → `totalYieldWeight: 500`.
- update `{ totalYieldWeight: 1500 }` sobre receta portions 6 → `portionSize: 250`, `portions: 6`.
- update `{ portions: 2.5 }` → se acepta, `costPerPortion = totalCost / 2.5`.
- duplicar receta copia `totalYieldWeight`.

`recipes.controller.spec.ts` / `recipe-response.dto` fixtures: añadir `totalYieldWeight`.

Comando: `cd backend && bun run test -- recipes` (jest runner).

## Frontend
- `bun run build` (o `next build`) sin errores de tipos.
- Smoke manual (agent-browser opcional): abrir receta, editar Peso ración, verificar
  que Raciones se recalcula y persiste tras guardar.

## Regresión de costeo (crítico — cero deriva)
Elegir 1 receta real antes de migrar, anotar `totalCost`, `totalCostPerUnit`,
`costPerPortion`, `pricing.theoreticalSellingPrice`. Tras fases 1-3, sin editarla:
los 4 valores deben ser idénticos.

## Verificación migración
- `bunx prisma migrate status` limpio en la BD :3001.
- `SELECT count(*) FROM recipes WHERE "totalYieldWeight" IS NULL;` → 0.

## Preguntas abiertas
- Ninguna pendiente si el formato `fmtRac` (≤2 decimales) se acepta en fase 3.
