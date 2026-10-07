# Fase 3 — Paso refine

## Contexto

- `backend/src/modules/albaranes/albaranes.service.ts:725-748` — tras casar proveedor, si tiene `ocrLayoutHints` y hay `raw_text`, 2ª llamada IA solo-texto; `Object.assign` pisa la primera extracción.
- Usa `aiModel/aiApiKey` del request, no `effModel/effKey` → con key guardada en servidor va sin key y falla en silencio (400). Solo corre de verdad si el navegador envía la key.
- 28 de 30 proveedores tienen hints.
- `backend/ocr-microservice/app/main.py` `/ocr/refine`.

## Variantes (decide la fase 1, comparación C)

| Variante | Cuándo | Cambio |
|---|---|---|
| 3a Desactivar | C no mejora a B | Tras fase 2 `raw_text` llega vacío y el refine ya no entra. Quitar la llamada explícitamente y dejar comentario del porqué. Endpoint `/ocr/refine` se conserva sin uso o se elimina. |
| 3b Refine con foto | C mejora a B en proveedores con hints | Reenviar la foto + hints en la 2ª llamada, con `effModel/effKey`. Coste: +1 llamada IA (~5 s). Requiere conservar el buffer de la foto hasta ese punto. |

Recomendación por defecto: 3a (KISS). Los hints siguen aprendiéndose y guardándose; solo deja de usarse la 2ª pasada.

## Archivos

- `backend/src/modules/albaranes/albaranes.service.ts`
- 3b además: `backend/src/modules/ocr/python-ocr.service.ts`, `backend/ocr-microservice/app/main.py`, `app/models.py` (`OCRRefineRequest`)

## Tests

- Specs de `albaranes.service` que cubren el refine: actualizar al comportamiento elegido.
- Subida real de un albarán de proveedor con hints, desde ordenador y desde móvil: mismo resultado.

## Riesgos

- 3a cambia un comportamiento que hoy corre en subidas desde ordenador: es decisión de producto si la fase 1 no es concluyente → preguntar antes de aplicar.
