# Panel de caducidades APPCC + alertas en dashboard

**Fecha**: 2026-09-14 22:18
**Severity**: Baja (ningún dato roto, cambios de presentación puros)
**Componente**: FoodLabelService, EtiquetadoConfigService, DashboardService, frontend caducidades + dashboard page
**Estado**: Despachado (commit bfed030, local)

## Qué pasó

El usuario pidió en `/ask` un panel APPCC para gestionar caducidades/consumo preferente de elaboraciones, con alertas popup rojo cuando iban a caducar. Durante la consultaría se descubrió que `FoodLabel` (modelo Prisma existente desde 2014) ya llevaba todo: lotes, fecha de preparado, useByDate, frozenUseByDate, condición de almacenamiento. Cero migraciones, cero modelos nuevos. El trabajo fue: exponer un umbral configurable (5 días por defecto), campos derivados de caducidad, un panel paginado bajo APPCC, **y reemplazar dos cards fake del dashboard** (una simulaba "Temp. Cámara Fría" con `Math.random()`).

Pero el usuario se arrepintió a mitad de la consultaría: **"nada de popup"**. Patrón directo del plan anterior de programaciones — reforzar la card del dashboard, sin modal/toast/alert nativo. Decisión explícita, documentada.

La validación de plan (`/ck:plan` tier Full) cazó 2 errores de hecho antes de implementar: (1) la fase 1 decía `findOne()` pero el método real es `getById()`; (2) `EtiquetadoConfigService` no estaba exportado del módulo. Sin eso, code-cook habría envenenado medio backend.

## La verdad brutal

El dato crucial ya existía desde hace años — solo necesitaba un threshold visible. Eso es frustrante: **6 fases de trabajo para exponer algo que ya vivía en Prisma y solo faltaba empaquetar.** Pero es la realidad: un dato en una columna no es útil hasta que alguien puede leerlo, configurarlo, y actuar.

La decisión de revertir el popup a mitad de consultaría fue correcta (es más UX-friendly un card de dashboard que tres clicks para cerrar un popup), pero desestabilizó ligeramente el scope inicial — el plan se alineó tres veces con esa U-turn, y todo confluyó justo. Sin eso, habríamos gastado trabajo en UI que después se tira.

## Detalles técnicos

- 115 tests backend (3 suites: `etiquetado` + `dashboard`); 1935 en la suite completa. Todos verdes.
- Frontend: typecheck + lint limpio. Cero regresiones de contrato.
- **Code review hallazgo #1 (HIGH, arreglado):** grid de 3 columnas del dashboard usaba `&&` para renderizar cards — con un tenant que tuviera `recipes` pero no `etiquetado`, se veía un hueco. Cambio a ternarios con placeholder neutral.
- **Code review hallazgo #2 (MEDIUM, parcial):** "más próximo a caducar" usaba `useByDate` crudo, ignoraba `frozenUseByDate`. El dashboard ahora compara 2 candidatos (fresca vs. congelada) y elige fecha efectiva real — sin SQL crudo, 2 queries indexadas. El panel paginado (listado completo) se deja con la aproximación (ordena solo `useByDate`, minoría congelada, SQL crudo tiene riesgo innecesario) — **decisión del usuario, documentada en código.**

## Pendiente

Verificación manual en navegador: dev server de esta sesión corre desde el checkout principal, no desde este worktree. No hay brecha de código (mismo commit en ambos), solo la cabeza del reloj diferente. Se delegó al usuario.

No hay tareas abiertas en el plan — 6 fases completadas, validation sweep sin contradicciones.
