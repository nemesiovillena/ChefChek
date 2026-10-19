# Plan: Cuiner — Medidas de servicio

Estado: fases 1-3 hechas (PR #403) · Creado 2026-10-19
Investigación: `../reports/research-261019-1433-cuiner-medidas-servicio-bebidas-report.md`

## Objetivo
Plato de venta directa enlazado a artículo + medida (Chupito 4 cl, Caña 20 cl…). Descuenta la medida, no 1 L/1 ud.

## Decisiones (usuario, 2026-10-19)
- Medidas iniciales = las propuestas en la investigación; editables por tenant.
- Combinados: el refresco se elige aparte en el TPV (modificador tipo I) → la medida del combinado solo descuenta el destilado; el modificador se enlaza a su refresco (1 ud).
- «COPA»: dos medidas (Copa licor 5 cl / Copa vino 15 cl); se sugiere según el artículo.

## Fases
| # | Fase | Archivo | Depende |
|---|------|---------|---------|
| 1 | Backend: modelo, catálogo, consumo | phase-01-backend-medidas-y-consumo.md | — |
| 2 | Frontend: pestaña Medidas + selector en enlace | phase-02-frontend-medidas-y-enlace.md | 1 |
| 3 | Enlace masivo asistido por marca | phase-03-enlace-masivo-asistido.md | 1, 2 |

## Aceptación
- «BARCELO CHUPITO» → Ron Barceló 0,7 L + Chupito 4 cl; 10 ventas = 0,571 botellas.
- «CAÑA» → Barril 30 L + Caña 20 cl; 150 cañas = 1 barril.
- Enlace sin medida = 1 ud (igual que hoy). Enlaces existentes en prod intactos.
- Medida de volumen sobre artículo en ud/kg → 400 al enlazar.
- Cambiar una medida afecta a ventas futuras; movimientos aplicados no cambian.
- Fase 3: enlazar ~300 platos «MARCA + MEDIDA» en pocas confirmaciones.

## Riesgos
- Prod tiene enlaces ya hechos: columnas nuevas nullable, sin backfill.
- BD dev compartida: limpiar DROPs ajenos del migration.sql (memoria prisma-migrate-diff).
