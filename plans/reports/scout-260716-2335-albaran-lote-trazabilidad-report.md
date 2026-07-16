# Scout Report: Lote en líneas de albarán → APPCC / recetas / etiquetas

## Objetivo del scout
Ubicar todo lo relacionado con "lote" (batch/lot number) de artículos de albarán, para poder usarlo después en APPCC, recetas y etiquetas de platos/menús.

## Hallazgo principal
El campo `lot` **ya existe** en el schema Prisma, DTOs y servicios backend desde la migración inicial. No es "añadir un campo nuevo": es **cablear la propagación** que hoy está rota en 2 puntos, y **decidir el modelo de datos** para trazabilidad real.

## Estado actual (lo que YA funciona)

### Backend (NestJS + Prisma)
- `AlbaranLine.lot String?` — `backend/prisma/schema.prisma:1694`
- `Product.lot String?` — `backend/prisma/schema.prisma:177` (escalar único, se sobrescribe en cada compra — sin histórico)
- `CreateAlbaranLineDto.lot?`, `UpdateAlbaranLineDto.lot?` — ya soportan lot
- `albaranes.service.ts` ya lee/escribe `lot` en: creación manual (`:57`), update de línea (`:198-199`), creación desde OCR (`:455`), `addLine` (`:546`)
- `AlbaranLine` tiene FK real a `Product` vía `matchedProductId` (contradice memoria previa "sin FK a product" — está confirmado como FK nullable, no ausente)

### OCR microservice (Python/FastAPI)
- Prompt de extracción IA (`ai_extraction_service.py:17-73`) ya pide `"lot": "número de lote o null"` por producto
- `_parse_json_response()` ya normaliza `product["lot"]`
- Modelo Pydantic `ExtractedProduct` (`app/models.py:30`) ya tiene `lot: Optional[str]`
- Regex fallback (sin IA) NO extrae lote — inviable de forma fiable por regex (formato de lote no estandarizado)

### Frontend
- Tipo `AlbaranLine` (`frontend/src/lib/api-albaran.ts:15`) ya tiene `lot: string | null`
- `updateLine()` ya acepta `lot?: string` en el payload (`api-albaran.ts:164`)
- `EditableLineCell` es genérico (`field: string`) — añadir columna lote es solo instanciarlo, sin tocar el componente

## Gaps (lo que falta / está roto)

1. **Bug OCR (raíz del problema):** `ocr-microservice/app/services/document_processor.py`, función `_build_document_from_ai()` (~línea 415-423) construye `ExtractedProduct(...)` SIN pasar `lot`, `article_number`, `vat_percent`, `price_with_vat` — se descartan aunque la IA los extraiga. Fix de una línea.

2. **UI de líneas no muestra/edita lote:** `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx` no tiene columna ni `EditableLineCell field="lot"`. `AddLineForm`/`addAlbaranLine()` tampoco pasan `lot` (backend sí lo soporta).

3. **Propagación a stock/producto rota:** `AlbaranStockService.processStockOnConfirmation()` (`backend/src/modules/albaranes/services/albaran-stock.service.ts`) nunca copia `line.lot` a `Product.lot` (ni al crear producto nuevo `:236-253`, ni al actualizar `:207-229`/`:277-284`). `Stock` y `StockMovement` NO tienen columna `lot` — no existe forma de saber qué lote hay en stock hoy.

4. **Limitación de modelo de datos:** `Product.lot` es un escalar que se sobrescribe. Trazabilidad real (varios lotes en stock simultáneamente, saber qué lote se usó en qué receta/producción, imprimir el lote correcto en la etiqueta) requiere una decisión de arquitectura:
   - Opción A (mínima/YAGNI): mantener `Product.lot` como "último lote conocido", suficiente para el caso de uso inmediato del usuario
   - Opción B: modelo `Lot`/`ProductLot` propio con cantidad/caducidad, vinculado a Stock — necesario si se requiere "qué lote entró en esta receta concreta" con precisión (rompe la unicidad actual de `Stock` en `[productId, warehouseId]`)

5. **Módulo APPCC desconectado:** `GoodsReception` (modelo APPCC existente) es JSON-blob sin FK a `Albaran`/`AlbaranLine`/`Product` — entrada manual duplicada, no reutiliza el pipeline de albaranes. Sin modelo de trazabilidad en absoluto hoy.

6. **RecipeIngredient sin dimensión de lote:** referencia `Product` de forma estática (BOM), no "Producto X, lote Y". Vincular lote a "qué se usó en esta preparación concreta" es un concepto distinto (¿producción/consumo real vs receta plantilla?). Existe ya "Lotes de Producción" en `dashboard/production` — concepto de fabricación, no relacionado hoy con compras.

7. Flujo `ManualAlbaranForm`/`useCreateManualAlbaran` (crear albarán 100% manual desde `dashboard/compras`) — no confirmado si soporta lote (usa forma de línea distinta, `ManualAlbaranLineInput`).

## Archivos relevantes
- `backend/prisma/schema.prisma` — `AlbaranLine`, `Product`, `Stock`, `StockMovement`, `RecipeIngredient`, `GoodsReception`, `AppccControl`
- `backend/src/modules/albaranes/albaranes.service.ts`
- `backend/src/modules/albaranes/services/albaran-stock.service.ts`
- `backend/src/modules/albaranes/dto/{create-albaran.dto.ts,update-albaran.dto.ts}`
- `backend/src/modules/appcc/*`
- `backend/ocr-microservice/app/services/{ai_extraction_service.py,document_processor.py}`
- `backend/ocr-microservice/app/models.py`
- `frontend/src/lib/api-albaran.ts`
- `frontend/src/app/dashboard/albaranes/[id]/lineas/page.tsx`
- `frontend/src/components/albaranes/{editable-line-cell.tsx,add-line-form.tsx}`
- `frontend/src/app/dashboard/appcc/page.tsx`, `frontend/src/hooks/use-appcc.ts`

## Preguntas abiertas (para el usuario, antes de planificar)
1. ¿Alcance inmediato = solo arreglar la propagación (OCR→línea→UI→Product.lot como "último conocido"), dejando trazabilidad multi-lote real para cuando se construya APPCC de verdad?
2. ¿O se quiere ya la base de datos correcta para trazabilidad real (modelo `Lot` propio, stock por lote) para no tener que migrar de nuevo cuando llegue APPCC/etiquetas?
3. ¿El flujo de albarán manual (`dashboard/compras`) también necesita soportar lote ahora, o solo el flujo OCR?
