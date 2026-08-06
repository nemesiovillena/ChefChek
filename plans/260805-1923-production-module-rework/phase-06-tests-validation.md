# Fase 6: tests y validación end-to-end

## Contexto
- Backend usa `jest`, no `bun test` (memoria [[backend-tests-use-jest-not-bun-test]] — `bun test` falla en specs con `jest.requireActual`). Ejecutar siempre `bun run test`.
- Backend en modo `dist` no tiene hot-reload (memoria [[backend-dist-mode-not-watch]]) — tras cada cambio de servicio hace falta `build` + relanzar antes de probar manualmente en navegador.
- Puede haber dos Postgres en dev divergentes (memoria [[two-postgres-databases-dev]]) — verificar que las pruebas manuales pegan contra la misma BD que se migró en fase 1.

## Requisitos

### Backend (automatizado)
- `production.service.spec.ts` / `production.controller.spec.ts`: actualizar mocks de Prisma a los nuevos modelos/campos (`ProductionTask`, `Milestone`, `ProductionReport`, campos nuevos de `WorkBatch`/`ProductionOrder`/`ProductionAlert`).
- Cobertura mínima por caso ya enumerada en cada fase (2, y regresión IDOR de mise en place). Consolidar aquí una pasada única: `bun run test -- production` tras cerrar fase 2, y de nuevo tras cualquier ajuste retroactivo de fase 4 (nuevos endpoints de `StaffMember`/`ProductionTask`).
- `bun run typecheck` (o el script equivalente del backend) para confirmar que quitar los `as any` no dejó errores de tipo sueltos.

### Frontend (manual, con navegador real — no basta con typecheck)
Recorrido completo en `/dashboard/production`, en orden:
1. Cargar la página → sin error de carga de lotes.
2. Crear lote completo (fase 3) → aparece con todos sus datos.
3. Crear miembro de staff (fase 4) → aparece en disponibles.
4. Crear orden de producción ligada al lote (fase 3), con receta real e ingredientes.
5. Crear hoja de mise en place para la orden y verificarla (fase 4).
6. Crear tarea de producción y asignarla al staff creado (fase 4); confirmar que se bloquea al superar `maxTasks`.
7. Iniciar lote y orden; esperar o forzar un retraso; confirmar que aparece la alerta (fase 5, según la decisión tomada sobre bridge a `Alert` genérico o panel propio).
8. Resolver la alerta.
9. Completar orden y lote.
10. Generar reporte de KPIs con el rango de fechas de la prueba → números coherentes con lo creado (1 lote, 1 orden completada, etc.).
11. Repetir el mismo recorrido logueado con OTRO tenant y confirmar que no ve nada de lo creado en el paso 1-10 (scoping multi-tenant).

### Verificación de seguridad puntual
- Confirmar explícitamente (con dos tenants de prueba) que `PUT mise-en-place/items/:itemId` de un tenant no puede tocar el item de otro tenant (regresión del IDOR encontrado en el diagnóstico original) — esto es el único hallazgo de seguridad real del audit inicial y merece un check manual además del test automatizado de fase 2.

## Archivos a modificar
- `backend/src/modules/production/production.service.spec.ts`
- `backend/src/modules/production/production.controller.spec.ts`
- Ninguno nuevo si los specs existentes se actualizan en el sitio; crear specs nuevos solo si se añaden servicios (`WorkBatchNumberService`, `ProductionOrderNumberService`) sin cobertura propia.

## Criterios de salida de esta fase (= criterios de aceptación del plan completo)
Los mismos 6 puntos de `plan.md` § Criterios de aceptación, todos verificados en el recorrido manual de arriba, más los tests automatizados en verde.

## Riesgos / rollback
- Ninguno nuevo: esta fase no cambia comportamiento, solo lo verifica. Si algo falla, el rollback es el de la fase que introdujo el problema (identificar cuál con el recorrido paso a paso, no revertir todo el plan de golpe).
