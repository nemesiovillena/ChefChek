# Fase 04: OCR microservice — fix bug de extracción de lote

**Estado: ✅ implementada.** Fix aplicado en `document_processor.py`. No verificado end-to-end contra el microservicio corriendo (requiere levantarlo manualmente, fuera de alcance de la verificación automática) — confirmado por el tester que el único test existente (`test_accuracy.py`) requiere el servicio activo en `:8000`.

## Contexto
Confirmado por scouting: el prompt de IA (`ai_extraction_service.py:17-73`) ya pide `"lot": "número de lote o null"` por producto, y `_parse_json_response()` ya lo normaliza. El modelo Pydantic `ExtractedProduct` (`app/models.py`) ya tiene `lot`, `article_number`, `vat_percent`, `price_with_vat`. Pero `document_processor.py`, función `_build_document_from_ai()` (líneas 412-423), construye `ExtractedProduct(...)` sin pasar esos 4 campos — se pierden silenciosamente antes de llegar a la API/NestJS.

Independiente del resto del plan (repo/proceso Python separado, `backend/ocr-microservice`, arranque manual vía `uvicorn`).

## Archivos a modificar
- `backend/ocr-microservice/app/services/document_processor.py`

## Implementación
Línea 414-423, cambiar:
```python
for p in ai_result.get('products', []):
    products.append(ExtractedProduct(
        name=p.get('name', ''),
        description=p.get('description'),
        quantity=p.get('quantity', 0),
        unit=p.get('unit', 'ud'),
        unit_price=p.get('unit_price', 0),
        total_price=p.get('total_price', 0),
        confidence=ocr_results.get('confidence', 0.7),
    ))
```
por:
```python
for p in ai_result.get('products', []):
    products.append(ExtractedProduct(
        name=p.get('name', ''),
        description=p.get('description'),
        article_number=p.get('article_number'),
        lot=p.get('lot'),
        quantity=p.get('quantity', 0),
        unit=p.get('unit', 'ud'),
        unit_price=p.get('unit_price', 0),
        vat_percent=p.get('vat_percent'),
        price_with_vat=p.get('price_with_vat'),
        total_price=p.get('total_price', 0),
        confidence=ocr_results.get('confidence', 0.7),
    ))
```
Verificar antes de aplicar que los 4 nombres de campo (`article_number`, `lot`, `vat_percent`, `price_with_vat`) coinciden exactamente con los nombres del Pydantic `ExtractedProduct` en `app/models.py` (confirmado por scouting para `lot`; confirmar los otros tres al editar, por si hay alias `Field(alias=...)`).

## Tests / validación
- Microservicio corre como proceso Python separado — arrancar manualmente (`uvicorn`, ver memoria del proyecto sobre arranque del OCR) y verificar `curl :8000/health`.
- Si existe `test_accuracy.py` (mencionado en scouting, sin cobertura de `lot` hoy), añadir un caso con un documento de prueba que incluya lote y verificar que `ExtractedProduct.lot` no es `None`.
- Prueba end-to-end: subir un albarán de prueba con lote visible en la imagen, confirmar que el JSON devuelto por `/ocr/image` incluye `"lot": "..."` no nulo en al menos un producto, y que llega a `AlbaranLine.lot` en el backend (requiere fase 02 aplicada para verificar el tramo final, pero el fix de esta fase es verificable de forma aislada inspeccionando la respuesta HTTP del microservicio).

## Riesgos y rollback
- Riesgo bajo: cambio aditivo de parámetros con nombre en un constructor Pydantic; si algún nombre no coincide, Pydantic lanzará error de validación en el arranque/request (detectable inmediatamente, no un fallo silencioso).
- Si la extracción regex-fallback se usa (sin API key de IA configurada), `lot` seguirá siendo `null` — comportamiento esperado y documentado en el scouting (no cubierto por este fix, fuera de alcance por ser poco fiable vía regex).
- Rollback: revertir el commit; no hay estado persistente en este microservicio.
