# SICTED fase 1: fundamentos y andamiaje, con subagentes caídos toda la sesión

**Fecha**: 2026-09-24 22:52
**Severity**: Baja (fase 1 de 10, sin tocar dominio ni datos de tenants existentes)
**Componente**: `modules/sicted`, `modules/checklists` (nuevo), `modules/backup`, `modules/modules/constants/registry.ts`, `modules/role-access/constants/section-registry.ts`, `frontend/features/modules/lib/nav-config.ts`
**Estado**: Commit `2b18421` en `feat/sicted-fase-1-fundamentos`, sin push

## Qué pasó

Plan largo (varias sesiones) para SICTED — sistema de calidad turística — construido a partir de documentos reales de Warynessy (el manual oficial de 101 páginas y ~95 checklists/formularios que el restaurante ya usa en papel, no plantillas inventadas). Decisión de arquitectura clave: el motor de checklist (limpieza, mantenimiento, temperatura, averías) es **compartido** entre `sicted` y un futuro `appcc` reconstruido, viviendo en un tercer módulo neutro `checklists` — resuelve la tensión entre "cada módulo se activa por separado" (petición inicial del usuario) y "no duplicar información" (petición posterior): son ortogonales, la independencia es de las rutas/guards, no de dónde vive el dato.

Fase 1 de 10: sin dominio real, solo andamiaje — registro del módulo, guards, y la función Postgres `forbid_mutation()`/`forbid_mutation_after_seal()` que hará inalterable la evidencia (append-only, trigger con escape `SET LOCAL` controlado) a partir de fase 2.

## La verdad brutal

**El spawn de subagentes estuvo roto toda la sesión** (`Could not determine current tmux pane/window`) — 4 intentos de red-team, 1 intento de code-review, todos con el mismo error de infraestructura, no de prompt. El plan (`cook`) exige subagentes obligatorios para review/test/finalize; en su ausencia, hice la revisión yo mismo, inline, con el visto bueno explícito del usuario cada vez. No es lo mismo que un revisor aislado con menos sesgo de "es mi propio código", pero el checklist fue el mismo (criterios de éxito, regresiones, contratos públicos, patrones, seguridad).

Y esa revisión inline **sí encontró un bug real mío**: implementé el filtro que excluye `checklist_*`/`sicted_*` del restore por defecto, pero se me olvidó activar el propio escape `SET LOCAL chefchek.allow_evidence_purge='on'` para el camino `includeEvidenceTables=true`. Sin el fix, el día que existan tablas de evidencia reales (fase 2+), un restore explícitamente confirmado se habría bloqueado contra su propio trigger — habría fallado en producción con un error de Postgres confuso, no con un mensaje claro. Lo arreglé y lo cubrí con un test de integración contra Postgres real que ejercita el camino completo, no solo mocks.

Segundo hallazgo, más serio y ajeno a esta fase: la BD dev local (`localhost:5432`, según memoria del proyecto un **clon de producción**, 9 tenants reales) no tenía tabla `_prisma_migrations` — Prisma no reconocía ninguna de las 61 migraciones previas como aplicada, aunque el esquema físico ya las tenía todas. No lo intenté arreglar sobre la marcha: paré, investigué en modo lectura (comparé una migración reciente contra la BD real, comprobé qué proceso servía `:3001`), presenté la evidencia al usuario, y solo tras su confirmación explícita apliqué `prisma migrate resolve --applied` (contabilidad pura, cero SQL de esquema/datos). Tenants/usuarios antes y después: 9/10, sin cambios.

## Detalles técnicos

- 132 suites / 1991 tests unitarios backend sin regresiones; 3 suites e2e nuevas (12 tests) contra `chefchek_test` real (no mocks): guard stack del módulo, funciones de inalterabilidad, y el escape de restore de extremo a extremo.
- `tsc --noEmit` limpio en backend y frontend; eslint limpio.
- `AuthGuard` exige importar `AuthModule` en el módulo consumidor aunque `GuardsModule` sea `@Global()` — ya estaba en memoria del proyecto, se me olvidó aplicarlo al escribir `sicted.module.ts` la primera vez; el e2e lo cazó de inmediato.
- `git diff --stat` confirmado sin tocar `modules/appcc/**` ni `dashboard/appcc/**`.

## Pendiente

- Retomar el red-team (4 revisores adversariales) cuando el entorno de subagentes se recupere — sigue siendo recomendable dado que el diseño toca integridad de datos e inalterabilidad, aunque la validación previa (23/23 verificado) y esta revisión inline ya dieron 0 contradicciones.
- Fases 2-10 del plan (`plans/260921-2256-sicted-calidad-turistica/`) siguen pendientes; fase 2 es la siguiente (motor de registros: plantillas/hojas/marcas).
- Sin push ni PR todavía — commit local en `feat/sicted-fase-1-fundamentos`, a la espera del usuario.
