# SICTED fase 9 (sub-PR 4/4): informe anual — cierra la fase, sin bugs propios

**Fecha**: 2026-09-26 11:10
**Severity**: Baja (sin hallazgos de producción; un test propio corregido antes de dar la fase por buena)
**Componente**: `backend/src/modules/sicted/{services/sicted-annual-report,services/sicted-annual-report-pdf,sicted-direccion-report.controller}.ts`, `frontend/src/app/dashboard/sicted/components/sicted-direccion-report-tab.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-9-informe-anual` (sobre `develop`, con sub-PRs 1-3 de fase 9 ya fusionados) — **cierra la fase 9 completa**

## Qué pasó

Cuarto y último sub-PR de la fase 9: el informe anual de calidad (`DIR.10` en la nomenclatura original del manual, aunque ese código concreto pertenece al manual equivocado descartado en sub-PR 1 — el concepto "un export agregado, no un documento manual" sigue siendo válido y es justo lo que pide cualquier manual real de SICTED). No añade ninguna tabla nueva: es puramente un servicio de agregación de solo lectura que reúne en un único `Promise.all` datos de **seis fases distintas del plan** — objetivos y plan de mejora (sub-PR 2 de esta misma fase), eventos y documentos legales vigentes (sub-PR 3), la autoevaluación cerrada más reciente del año con su recuento de obligatorias pendientes (sub-PR 1), incidencias de proveedores (fase 6), formación (fase 7), y quejas/satisfacción de cliente (fase 8). Un PDF con PDFKit y una pestaña de preview en pantalla, mismo patrón exacto que el pack de auditoría de fase 5.

## La verdad brutal

**Tercera fase de este plan sin ningún bug de producción que reportar** (tras fase 8 y el sub-PR 2 de esta misma fase 9). No es casualidad: esta pieza es agregación pura sobre datos que ya existían y ya estaban verificados en sus propias fases — no introduce ningún mecanismo nuevo (ni trigger, ni cron, ni upload), solo lee. El único ajuste fue en el propio test e2e, no en el código: al simular una autoevaluación cerrada dentro del año de prueba, el primer intento actualizaba `closedAt` directamente por Prisma sin pasar por `close()` — dejaba `status` en `DRAFT`, así que el filtro `status: "CLOSED"` del agregado no la encontraba. Corregido usando `assessments.close()` de verdad, que es lo que cualquier código real haría también.

Una decisión de diseño que vale la pena dejar explícita: en vez de reimplementar el cálculo del umbral de SLA de respuesta a quejas (72h por defecto, configurable por tenant desde fase 8), el agregado reutiliza `SictedFeedbackService.overdue()` tal cual y solo filtra el resultado al año del informe. Duplicar ese cálculo habría sido el tipo de deriva silenciosa que rompe cuando alguien cambia el umbral configurado y un informe histórico deja de coincidir con la campana de notificaciones real.

**Lo que NO se llevó a fase 9, documentado explícitamente en el criterio de éxito en vez de callado**: el criterio original "6 prácticas con evidencia automática nunca piden acción manual" pertenecía enteramente al diseño basado en el manual equivocado (códigos `Res-Coc.4/5`, `Res-Hig.3/4`, `PROV.1/8` que no existen en el catálogo real de 144 prácticas BP1-BP6) — el "motor de cobertura automática" tal como estaba concebido simplemente no se construye, porque construirlo habría significado inventar de nuevo qué prácticas del catálogo real tienen equivalente automático, sin ninguna verificación contra un documento real que lo confirme. Tampoco se exportó la autoevaluación al pack de auditoría de fase 5 — este mismo informe anual cubre esa necesidad de una forma distinta (agregado propio).

## Detalles técnicos

- `SictedAnnualReportService.aggregate(tenantId, year)`: mismo patrón `Promise.all` de sub-agregados independientes que `SictedProcurementEvidenceService` de fase 6.
- `SictedAnnualReportPdfService`: PDFKit, una sección por bloque, mismo patrón que `sicted-mantenimiento-pdf.service.ts`/`sicted-plan-pdf.service.ts` (fases 2/4/5).
- `SictedDireccionReportController`: tercer controlador bajo el mismo prefijo `api/v1/sicted/direccion` (junto a `SictedDireccionController` y `SictedDireccionLegalController`), mismo criterio de modularización por archivo que sub-PR 3.
- Descarga PDF iOS-safe: `window.open` síncrono dentro del gesto, blob autenticado cargado después — mismo mecanismo ya verificado en iPhone real en fase 5, reutilizado tal cual.
- 134 suites/2020 tests unitarios backend (sin cambios) + 24 suites/152 tests e2e backend (2 nuevos: agregación correcta con datos sembrados en las 6 fases, filtrado estricto por año; año sin datos devuelve informe vacío en vez de error) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios — 7ª pestaña "Informe anual" en `/dashboard/sicted/direccion`.
- Verificación manual en Chrome contra un tenant de prueba desechable (`fase9-subpr4-browser-test`) con datos sembrados en 7 tablas de 6 fases distintas: cada número mostrado en pantalla coincidió exactamente, cifra a cifra, con lo sembrado (1 objetivo, GRUPO_MEJORA:1, 1 incidencia/0 resueltas, 1/1 acciones de formación, 1 queja/1 abierta, satisfacción media 4.0/5, 1 documento legal vigente) — la coincidencia exacta es la prueba real de que el agregado lee las fuentes correctas con los filtros de fecha/tenant correctos, más allá de lo que un test e2e aislado ya cubre. Descarga de PDF confirmada (blob cargado sin error). Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Fase 9 completa

Los 4 sub-PRs de la fase 9 (Catálogo+autoevaluación → Plan de mejora+objetivos → Eventos+legal → Informe anual) están implementados, testeados y verificados en navegador. El hallazgo más importante de toda la fase, con diferencia, sigue siendo el del sub-PR 1: el catálogo de prácticas se había diseñado sobre el manual equivocado durante casi una semana de planificación, y solo se corrigió porque el usuario conocía el contenido real de ambos manuales y lo señaló antes de sembrar datos.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario — para el plan entero, no solo fase 9.
- Fase 10 (Docs y cierre) es la última fase del plan.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-9-informe-anual`.
