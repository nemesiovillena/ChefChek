# Fase 2 — IA directa, EasyOCR perezoso

## Contexto

- `document_processor.py:226-330` `_process_image_array`: hoy preprocesa + EasyOCR siempre, luego IA.
- `document_processor.py:331-410` `_extract_structured_data`: IA → si falla, regex sobre texto OCR.
- `document_processor.py:412-483` `_build_document_from_ai`: CIF desde `raw_text`, `confidence` desde OCR.
- `catalog_extraction_service.py:91-110`: patrón IA directa ya existente (`ocr_text=""`).

## Requisitos

- Con `ai_model` + `ai_api_key`: codificar foto → IA. Sin preprocesado ni EasyOCR.
- IA lanza excepción o devuelve 0 productos → ejecutar preprocesado + EasyOCR + regex como hoy.
- Sin modelo/key: comportamiento actual intacto.
- Contrato de respuesta sin cambios (mismos campos; `raw_text` vacío en camino IA).

## Archivos a modificar

- `backend/ocr-microservice/app/services/document_processor.py`
  - `_process_image_array`: reordenar; OCR en función aparte invocada solo cuando haga falta.
  - `_build_document_from_ai`: aceptar `ocr_results` ausente. CIF = el de la IA pasado por `CifNifValidator` (checksum); `tax_id_confidence` según valide. `confidence` del documento: valor fijo documentado para camino IA (hoy hereda 0,41 de media del OCR, sin significado para la IA).
  - Log de tiempo por etapa: `ai_time`, `ocr_time`, `total`.
- `backend/ocr-microservice/app/services/ai_extraction_service.py`
  - `_build_prompt`: si `ocr_text` vacío, no incluir el bloque "Texto OCR del documento" (hoy catálogos lo envía vacío con el bloque).
- `backend/ocr-microservice/app/services/validation_service.py`
  - Revisar `_validate_confidence` / `_determine_confidence_level`: que el valor fijo del camino IA no dispare avisos falsos de baja confianza.
- `backend/src/modules/albaranes/albaranes.service.ts:779`
  - Nota "Importado desde OCR (confianza: X%)": ajustar texto si la confianza deja de ser del OCR.

## Tests

- `backend/src/modules/ocr/python-ocr.service.spec.ts`, specs de albaranes: jest (no `bun test`).
- Microservicio: prueba manual con `curl -F file=@user_albaran.jpg -F ai_model=... -F ai_api_key=... :8000/ocr/image` en tres casos: IA OK, key inválida (debe caer a regex), sin modelo.
- Subida real desde la UI en dev: albarán de 1 hoja y de 2 hojas (merge usa `raw_text` y `confidence`, `albaranes.service.ts:900-915`).

## Riesgos y rollback

- `raw_text` vacío: lo consumen el refine (fase 3) y `mergeOcrDocuments`. El aprendizaje de hints no (usa `l.description`, `albaran-stock.service.ts:459`).
- Fallo de IA ahora cuesta IA + EasyOCR (~5 + 37 s en prod) — igual que hoy en el peor caso.
- Rollback: revertir el commit; sin migraciones ni cambios de contrato.
- Despliegue: el microservicio es proceso/imagen aparte; reconstruir y relanzar. Backend corre desde `dist`.
