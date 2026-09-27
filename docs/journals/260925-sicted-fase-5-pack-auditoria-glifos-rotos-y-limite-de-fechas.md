# SICTED fase 5: pack de auditoría, con glifos rotos en el PDF y dos límites de fecha mal calculados

**Fecha**: 2026-09-25 17:10
**Severity**: Media (un bug de renderizado visible al ojo, dos de lógica de fechas; sin dato de producción afectado)
**Componente**: `backend/src/modules/sicted/services/{sicted-coverage,sicted-registros-pdf,sicted-plan-pdf,sicted-mantenimiento-pdf,sicted-audit-csv}.service.ts`, `sicted-audit.controller.ts`, `frontend/src/app/dashboard/sicted/auditoria/**`
**Estado**: Commit `e97711f` en `feat/sicted-fase-5` (sobre `develop`, con fases 1-4 ya fusionadas), sin push

## Qué pasó

Fase 5 de 10: convertir el dato en lo que el evaluador SICTED pide ver. Panel de cobertura ("¿qué días/hojas no están registrados?", antes de que lo pregunte el auditor), tres PDFs deterministas con huella SHA-256 (Plan por área, cuadrante mensual de un mes con firmas/observaciones, calendario de mantenimiento + libro de averías del año), y CSV de marcas para volúmenes que no caben en un PDF de un mes.

La cobertura reutiliza `isGenerationDay` del motor de checklist de fase 2 — la misma función que decide cuándo el cron genera una hoja de verdad — para que "esperado" nunca se desincronice de "cuándo se genera realmente". Los PDFs siguen el patrón de `food-label-pdf.service.ts` (PDFKit, texto por operadores de bajo nivel, sin plantillas HTML).

## La verdad brutal

**Tres bugs reales, y ninguno saltó por leer el código dos veces — saltaron por escribir tests contra Postgres real y, el más interesante, por mirar el PDF de verdad.**

1. **Los símbolos ✓/✗ no se veían en el PDF.** Los usé para marcar hecho/no-hecho en el cuadrante, igual que en la UI web (que sí puede usar iconos SVG). Pero la fuente Helvetica estándar de PDFKit usa codificación WinAnsi (CP1252), que no incluye esos glifos — en el PDF impreso salían como un carácter roto, ilegible. Mi primer test automatizado con `pdfText()` tenía una aserción que afirmaba "el nombre queda en la huella/observaciones aunque no siempre visible" — algo que ni siquiera era cierto sobre mi propio diseño (nunca pinté el nombre de quien marcó, solo iniciales de supervisor). Lo arreglé viendo el texto decodificado del PDF real, no releyendo mi propio código.
2. **El límite `to` de un rango de cobertura se trataba como inclusivo.** `to` a medianoche UTC ya es el día siguiente en Madrid (UTC+1/+2) — comparar por "día natural de `to`" en vez de por el instante exacto colaba un día de más como "esperado" que no debía contarse. Lo cazó un test que fallaba de forma nada obvia (`toBeGreaterThanOrEqual(1)` recibiendo `0`) hasta rastrear que el hueco venía de un día fuera del rango realmente pedido.
3. **El panel marcaba como "hueco" los días futuros del mes en curso.** Pedir la cobertura de septiembre entero a mitad de mes (25 de septiembre) marcaba el 26-30 como "sin generar" — técnicamente cierto pero engañoso: esos días simplemente no habían llegado todavía. Este lo vi en el navegador, con datos reales sembrados a propósito: 30 "esperadas" cuando solo tenía sentido esperar 25. Ninguno de mis tests automatizados lo habría cazado porque todos usaban rangos ya completamente pasados — hasta que probé con "hoy" de verdad en medio del rango.

## Detalles técnicos

- 134 suites/2020 tests unitarios backend (sin cambios, fase toda e2e) + 16 suites/103 tests e2e backend (12 nuevos: motor de auditoría 7, controlador HTTP 5) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/auditoria`).
- Verificación en navegador con datos reales sembrados (15 ítems × 18 días, con huecos deliberados: 2 días sin generar, 1 incompleta): los 4 tipos de descarga confirmados (blob autenticado, patrón `window.open` síncrono iOS-safe ya verificado en iPhone real para fichas técnicas), panel de cobertura con huecos exactos tras el fix del límite futuro, y el PDF del cuadrante descargado con `curl` y leído página a página (1 sola página, totalmente legible, huella SHA-256 visible en el pie).
- Tenant de prueba desechable creado/borrado en la BD de dev vía script — nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Fases 6-10 pendientes; fase 6 es la siguiente según el plan.
- Sin push ni PR todavía — commit local en `feat/sicted-fase-5`, a la espera del usuario.
