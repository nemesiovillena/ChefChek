# Plan: Cuiner — Informes de ventas

Estado: fases 1-3 hechas · Creado 2026-10-19
Investigación: `../reports/research-261019-1658-cuiner-informes-ventas-familias-periodos-report.md`
Depende de: PR #403 (medidas de servicio) — no bloquea, solo comparte módulo.

## Objetivo
Listados de ventas del TPV por periodo (día/semana/mes/año/rango) y por familia de carta, con unidades y euros. Exportables.

## Decisiones (usuario, 2026-10-19)
- Histórico: **todo** lo que haya en Cuiner para el centro del tenant. Nunca descuenta stock.
- Acceso: **ADMIN, OWNER, SUPERADMIN**. USER_CUINER no ve facturación.
- Salida elegible en pantalla: **Pantalla, Excel, CSV, PDF**.

## Fases
| # | Fase | Archivo | Depende |
|---|------|---------|---------|
| 1 | Conector + modelo: familia, importes, histórico | phase-01-conector-modelo-historico.md | — |
| 2 | Agregación en servidor + exportación | phase-02-agregacion-y-exportacion.md | 1 |
| 3 | Pantalla de informes | phase-03-pantalla-informes.md | 2 |

## Aceptación
- Ventas de un día cuadran con el total de caja de Cuiner (Σ Base + Impuesto de VentasLin = VentasCab.TOTAL salvo redondeo).
- Histórico importado con status HISTORICO; «Aplicar ventas» no lo toca; stock intacto.
- Agrupar por familia nivel 1 con desglose a nivel 2/3 y platos.
- Excel, CSV y PDF con el mismo contenido que la pantalla.
- USER_CUINER recibe 403 en el informe.

## Riesgos
- Conector vive en SRVCUINER: hay que copiar el PS1 nuevo (manual, documentado).
- Backfill largo: varios ciclos; idempotente (upsert por ticket+línea).
- Familia actual del plato reescribe el histórico (se acepta; anotar en UI).
