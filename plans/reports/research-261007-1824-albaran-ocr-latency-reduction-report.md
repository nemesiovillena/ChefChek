# Research: bajar el tiempo de lectura de albaranes (OCR)

Fecha: 2026-10-07 18:24 · Rama: feat/captura-recetas · Solo análisis, sin cambios de código.

## Resumen

Sí, se puede bajar mucho. El cuello de botella no es la IA: es **EasyOCR en CPU**, que corre antes de la IA y tarda ~35 s de media por hoja. En el camino IA ese paso es casi redundante: el modelo multimodal ya recibe la foto. Catálogos ya funciona así (IA directa sobre imagen, sin EasyOCR).

Recomendación: en el camino IA, saltar EasyOCR + preprocesado y dejarlo solo como fallback si la IA falla. Estimación en producción: de ~42 s a ~5 s por hoja (EasyOCR ~37 s según BD; IA ~5 s de mediana según log local).

## Datos medidos

Fuente: `albaranes.ocrRawData.processing_time` en BD dev (:5432). Ese campo es **solo** el tiempo de `readtext` de EasyOCR (`document_processor.py:295`), no incluye preprocesado ni IA.

| Métrica | Valor |
|---|---|
| Muestras | 118 albaranes (112 por IA, modelo `openrouter-gemini-flash`) |
| EasyOCR media | 37,0 s |
| EasyOCR mediana | 28,7 s |
| EasyOCR mín / máx | 17,9 s / 96,2 s |
| Por mes (jul / ago / sep) | 36,4 / 38,5 / 34,8 s |
| Confianza media del texto OCR | 0,41 |

Lecturas:
- El resize a 1800 px (commit 1096d43, 23-jul) **no bajó** el tiempo de EasyOCR: ago y sep siguen en ~35-38 s.
- Confianza 0,41 = el texto que EasyOCR pasa a la IA es ruidoso. Aporta poco al prompt.
- Benchmarks públicos dan EasyOCR CPU ~2 s/página (FUNSD/CORD). Aquí 35 s → algo en nuestro pipeline lo infla (probable: imagen binarizada+dilatada genera muchas cajas; o pocos núcleos en el servidor). No perfilado.

### Log local del microservicio (añadido tras localizarlo)

Fuente: `~/Documents/Trabajos offline/ChefChek/chefchek/backend/ocr-microservice/logs/ocr_service.log` (15-jun a 10-sep, este Mac, M4 Pro).

| Etapa | n | Media | Mediana | Máx |
|---|---|---|---|---|
| EasyOCR | 147 | 7,4 s | 6,8 s | 35,8 s |
| Llamada IA (albaranes + páginas de catálogo mezclados) | 959 | 8,1 s | 4,7 s (p90 9,2 s) | 613 s |
| Total por hoja | 135 | 9,5 s | 7,4 s | 36,9 s |
| Preprocesado OpenCV | — | ~0,2-0,3 s | — | — |

Lecturas:
- En este Mac EasyOCR tarda ~7 s; en BD ~37 s. Los datos de BD vienen casi seguro de producción (tenant clonado) → el servidor es ~5× más lento que el Mac en este paso. Inferencia, no comprobado en el servidor.
- Preprocesado es despreciable. No merece tocarlo por tiempo.
- IA ~5 s típicos. En producción, total estimado por hoja ≈ 37 + 5 = ~42 s; sin EasyOCR ≈ ~5 s.
- 55 fallos de IA en el log → el fallback a EasyOCR+regex sigue siendo necesario.

No medido: llamada refine; tiempos reales en el servidor de producción.

## Pipeline actual (por hoja)

```
subida → [Nest] bucle secuencial por archivo
           → [Python] resize 1800px
           → preprocesado OpenCV (CLAHE, Hough, inpaint, binarizado)
           → EasyOCR CPU            ← ~35 s
           → IA multimodal (foto + texto OCR)
         → match proveedor
         → refine: 2ª llamada IA solo-texto si el proveedor tiene hints
         → crear albarán
```

Hallazgos de código:
1. `albaranes.service.ts:657` — archivos en serie. 3 hojas = 3× el tiempo.
2. `main.py` — endpoints `async def` con trabajo síncrono bloqueante: un albarán en curso bloquea a los demás (y al `/health`).
3. `albaranes.service.ts:735` — refine usa `aiModel/aiApiKey` del request, no `effModel/effKey`. Si la key viene de la config del tenant (móvil), refine va sin key → 400 silencioso. Si viene del navegador, refine corre: 2ª llamada IA **sin imagen**, sobre texto de confianza 0,41, y su resultado pisa el de la multimodal (`Object.assign`). 28 de 30 proveedores tienen hints → afecta a casi todo.
4. `process_pdf` renderiza a 300 dpi y luego reduce a 1800 px; solo procesa la página 1.

## Opciones

| # | Cambio | Ahorro estimado | Riesgo |
|---|---|---|---|
| A | Camino IA sin EasyOCR ni preprocesado; EasyOCR solo si la IA falla | ~35 s+/hoja | Medio: validar precisión |
| B | Paralelizar hojas (2 a la vez, como catálogos) | ~50% en multi-hoja | Bajo, pero requiere A o endpoints no bloqueantes |
| C | Procesar en segundo plano (PROCESANDO + polling, patrón ya hecho en catálogos) | 0 s reales; el usuario no espera | Bajo-medio |
| D | Cambiar EasyOCR por motor ONNX (RapidOCR/OnnxTR) | Grande, sin medir aquí | Medio: nueva dependencia, re-validar regex |
| E | Quitar/arreglar refine | 1 llamada IA | Bajo |

Recomendado: **A + E**, luego B. C solo si tras A sigue molestando la espera. D solo si se quiere conservar texto OCR siempre — con A no hace falta.

## Qué depende hoy del texto OCR (hay que resolverlo en A)

- Prompt `{ocr_text}` → enviar vacío / ajustar prompt (catálogos ya lo hace).
- CIF: `_build_document_from_ai` lo saca del `raw_text` con el validador; ya cae al CIF de la IA si no encuentra. Pasar el CIF de la IA por el checksum del validador.
- `confidence` del documento viene del OCR (0,41 de media, poco útil). Revisar qué hace `validation_service` con ella.
- Refine necesita `raw_text` → sin texto no corre. Coherente con E.
- Fallback regex si la IA falla → lanzar EasyOCR en ese momento.
- `raw_text` en `ocrRawData`: revisar si el aprendizaje de hints (`exampleLines.raw`) lo lee.

## Validación antes de dar A por bueno

Comparar extracción con y sin texto OCR sobre un lote de albaranes reales ya confirmados (proveedor, CIF, nº líneas, cantidades, precios, lote). Existe `backend/ocr-microservice/tests/test_accuracy.py` como base. Gasta llamadas IA reales con la key del tenant.

## Fuentes

- Código: `backend/ocr-microservice/app/services/{document_processor,ocr_service,image_preprocessing,ai_extraction_service,catalog_extraction_service}.py`, `app/main.py`, `backend/src/modules/albaranes/albaranes.service.ts`, `backend/src/modules/ocr/python-ocr.service.ts`
- BD dev: tabla `albaranes`, `suppliers`
- Benchmark EasyOCR/OnnxTR CPU: https://pypi.org/project/onnxtr/0.3.0
- RapidOCR benchmark: https://rbaks-rapidocr-benchmark.hf.space/

## Preguntas sin resolver

1. Confirmar en el servidor de producción que EasyOCR tarda ~37 s (hoy es inferencia: BD ~37 s vs log del Mac ~7 s).
2. Resuelto: la llamada IA tarda ~5 s de mediana (log local).
3. ¿La precisión se mantiene sin texto OCR en el prompt? Requiere la prueba A/B.
4. ¿Refine mejora algo hoy? Tal como está, puede estar empeorando el resultado en subidas desde ordenador.
5. ¿Por qué EasyOCR tarda tanto en el servidor (~5× el Mac)? Probable CPU/núcleos; sin perfilar.
