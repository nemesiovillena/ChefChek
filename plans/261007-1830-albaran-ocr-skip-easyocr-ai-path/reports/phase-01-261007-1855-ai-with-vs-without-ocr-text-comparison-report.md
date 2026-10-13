# Fase 1 — Resultado: IA con texto OCR vs IA solo foto

Fecha: 2026-10-07 · Modelo: `openrouter-gemini-flash` · Script: `backend/ocr-microservice/tests/compare_ai_with_and_without_ocr_text.py`

## Veredicto

**Pasa.** La IA solo con la foto (B) extrae lo mismo que con foto + texto EasyOCR (A) en lo que importa. Fase 2 adelante, con dos ajustes (ver "Consecuencias").

Límite de la prueba: mide **coincidencia A vs B**, no acierto contra el papel. Solo se cotejó con la foto 1 caso (6404). Máquina: Mac M4 Pro, no el servidor.

## Lote

24 fotos reales de iPhone (HEIC), 13-ago a 7-oct 2026, 17 proveedores distintos, incluye ticket térmico, albarán manuscrito y hojas con sello "COPIA". Sacadas de Fotos (búsqueda "albarán"), guardadas fuera del repo.

## Resultados

| Métrica | A (foto + OCR) | B (solo foto) |
|---|---|---|
| Extracciones con éxito | 24/24 | 24/24 |
| Nº de líneas igual que A | — | 24/24 |
| Total del documento igual que A | — | 24/24 |
| Cantidad/precio/total de línea iguales | — | 22/24 documentos |
| Tiempo IA mediana / máx | 4,9 s / 14,6 s | 4,6 s / 9,9 s |
| EasyOCR previo (este Mac) | 4,7-8,1 s | 0 |

Discrepancias, repitiendo cada una 2 veces (A, A2, B, B2):

| Foto | Campo | A | B | Estable | Mejor |
|---|---|---|---|---|---|
| 6338 | Proveedor | WARYNESSY (es el cliente) | ANTONIO DE MIGUEL | sí, ambas | **B** |
| 6404 manuscrito | Total línea (papel: 173,46) | 173,46 | 143,6 / 173,6 | A sí, B no | **A** |
| 6404 | Precio (papel: 490) | 0,49 | 490 | sí | discutible |
| 6416 | Cantidad L1 y L3 (total = 6 × precio) | 1 | 6 / 1 | A sí, B no | B a veces |
| 6365 | CIF proveedor | B03124682 | null | sí | A (sin verificar) |
| 6407 | CIF proveedor | null | A46569240 | sí | B (sin verificar) |
| 6141 | IVA línea | 21 | null / 21 | B no | ruido |
| 6450, 6264 | Unidad (ud/kg) | ud | kg / ud | B no | ruido |
| 6254, 6450 | Lote | "244126" | "2441 26" | — | solo espacios |

Lecturas:
- A es muy determinista (A = A2 en todos). B varía algo entre ejecuciones en campos secundarios (IVA, unidad) y en manuscrito.
- El texto OCR a veces **engaña**: en 6338 hace que la IA tome al cliente como proveedor, de forma estable.
- Manuscrito es el punto débil de B (1 caso).

## Hallazgos colaterales

1. **Refine no funciona con OpenRouter.** Variante C: 0/15 con éxito. `/ocr/refine` envía `image_base64=""` → data-URL vacía → OpenRouter responde 400 "Invalid image data-url". Con `openrouter-gemini-flash` (110 de 118 albaranes en BD) refine falla siempre y el backend lo ignora ("no crítico"). Hoy no aporta nada.
2. **CIF del cliente guardado como CIF del proveedor.** En BD, el `cif_code` más frecuente es B03770245 (15 de 112 albaranes IA), que es el CIF de Warynessy, el cliente. Lo saca el validador regex del texto OCR, que tiene prioridad sobre el de la IA (`document_processor.py:429`).
3. El venv `python_env` del checkout principal no tiene `openai` instalado; para la prueba se usó una instalación temporal.

## Consecuencias para el plan

- Fase 2: sin cambios de enfoque. Añadir: CIF = el de la IA validado por checksum, y descartarlo si coincide con el CIF del propio tenant.
- Fase 3: variante **3a (quitar refine)**. No cambia el comportamiento real con OpenRouter.
- Riesgo aceptado: algo más de variabilidad en IVA/unidad y en manuscrito. Mitigación barata si molesta: `temperature=0` (hoy 0,1).

## Sin resolver

1. Acierto real contra el papel no anotado (solo coincidencia A/B). Las 24 extracciones están guardadas para revisarlas si se quiere.
2. Tiempos en el servidor de producción sin medir.
3. ¿CIF de 6365 (Nogueras) y 6407 (Jet Extramar) correctos? Sin cotejar.
4. Comportamiento con otros modelos (Gemini directo, Claude, GPT) no probado; solo el que usa producción.
