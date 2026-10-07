# Plan: lectura de albaranes más rápida (IA directa, EasyOCR solo de respaldo)

Estado: IMPLEMENTADO, sin commit — pendiente despliegue y verificación en producción · Creado: 2026-10-07 · Research: [informe](../reports/research-261007-1824-albaran-ocr-latency-reduction-report.md)

## Objetivo

Bajar el tiempo por hoja en producción de ~42 s a ~5 s, sin perder precisión de extracción.

## Fases

| # | Fase | Estado | Depende de |
|---|---|---|---|
| 1 | [Prueba comparativa de precisión](phase-01-prueba-comparativa-precision.md) | Hecha — [resultado](reports/phase-01-261007-1855-ai-with-vs-without-ocr-text-comparison-report.md) | — |
| 2 | [IA directa, EasyOCR perezoso](phase-02-ia-directa-easyocr-perezoso.md) | Hecha | — |
| 3 | [Paso refine](phase-03-paso-refine.md) | Hecha (3a: retirado) | — |

Fase 1 es puerta: si la IA sin texto OCR pierde precisión, la fase 2 no se hace tal cual (ver criterio).

## Criterios de aceptación

- Camino IA no ejecuta EasyOCR ni preprocesado salvo fallo de IA.
- Si la IA falla o devuelve 0 productos, el resultado es el mismo que hoy (EasyOCR + regex).
- Precisión en el lote de prueba ≥ la actual (fase 1).
- Tiempo por etapa en el log (IA, EasyOCR, total) para verificar en producción.
- Tests de `python-ocr.service` y `albaranes.service` en verde (jest).

## Fuera de alcance

- Paralelizar hojas y proceso en segundo plano (después, si hace falta).
- Cambiar de motor OCR.
- Catálogos (ya van por IA directa).

## Decisiones tomadas

- Lote de prueba: 24 fotos de la app Fotos (fuera del repo).
- Key IA de la prueba: la del tenant `sicted-demo` en BD dev.
- Fase 3: variante 3a (quitar refine) — refine falla siempre con OpenRouter.

## Desviaciones respecto al plan

- Prompt sin cambios: se envía con el bloque de texto OCR vacío, que es exactamente lo validado en fase 1 (y lo que ya hace Catálogos).
- Sin filtro "CIF = el del propio restaurante": `Tenant.cifNif` está vacío en todos los tenants, sería código muerto. La causa real (regex sobre texto OCR) desaparece en el camino IA.
- Refine retirado entero: llamada, cliente Nest, endpoint `/ocr/refine` y modelo. Los `ocrLayoutHints` se siguen aprendiendo pero ya nadie los lee.
- Nota del albarán: "leído con IA" en vez de un % de confianza que la IA no mide.

## Verificado en local (Mac)

- IA directa: 4 fotos, 3,6-11,6 s por hoja, sin EasyOCR. Key inválida y sin modelo → EasyOCR + regex como antes.
- jest `src/modules/albaranes` + `src/modules/ocr` en verde; tsc sin errores en los archivos tocados.
- No probado: subida real desde la UI, PDF, albarán multi-hoja, servidor de producción.

## Pendiente

1. Commit + PR a `develop` (rama `perf/albaran-ocr-ia-directa`).
2. Desplegar microservicio OCR y backend; medir en el log la línea "Procesamiento completado ... (método=, ia=, ocr=)".
