# Fase 1 — Prueba comparativa de precisión

## Contexto

- `backend/ocr-microservice/app/services/ai_extraction_service.py` — `extract(ocr_text, image_base64, model, api_key, supplier_hints)`
- `backend/ocr-microservice/app/services/document_processor.py:240-300` — pipeline actual
- Fotos: `~/Documents/Trabajos offline/ChefChek/chefchek/backend/ocr-microservice/user_albaran{,2..7}.*`

## Requisitos

Comparar, para cada foto, tres variantes con el mismo modelo (`openrouter-gemini-flash`):

| Variante | Entrada a la IA |
|---|---|
| A (actual) | foto + texto EasyOCR |
| B (propuesta) | foto, `ocr_text=""` |
| C (refine actual) | solo texto EasyOCR + hints del proveedor, sin foto |

Campos comparados: proveedor, CIF, nº albarán, fecha, nº de líneas, y por línea nombre / cantidad / unidad / precio unitario / total / lote / IVA. Total del documento.

Referencia de verdad: revisión manual contra la foto (lote pequeño). Sin verdad anotada solo se puede medir discrepancia A vs B, no cuál acierta.

## Archivos

- Crear: `backend/ocr-microservice/tests/compare_ai_with_and_without_ocr_text.py` — script, no test de CI (gasta llamadas IA). Lee key de variable de entorno, nunca en el repo.
- Salida: `plans/261007-1830-albaran-ocr-skip-easyocr-ai-path/reports/` — tabla por foto y variante + tiempos.

## Pasos

1. Script: carga foto → mismo resize/EXIF que producción → EasyOCR → llama A, B, C → vuelca JSON y tiempos.
2. Ejecutar con el venv del microservicio (`python_env`), no el python del sistema.
3. Anotar verdad de cada foto y marcar aciertos/fallos por campo.
4. Informe con tabla resumen y veredicto.

## Criterio de paso

- B ≥ A en campos de línea (cantidad, precio, total) y en nº de líneas → fase 2 tal cual.
- B < A solo en CIF → fase 2 + validar CIF de la IA con checksum; aceptable.
- B < A en líneas → no quitar texto OCR; replantear (motor OCR más rápido o prompt).
- C vs A/B decide la variante de fase 3.

## Riesgos

- Lote de 7 fotos: poca potencia estadística. Mitigar con más fotos o con rollout observado (fase 2 deja log de método y tiempos).
- No determinismo del modelo (temperature 0.1): repetir 2 veces las discrepancias.
