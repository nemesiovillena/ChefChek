---
phase: 1
title: 'Backend: fusionar OCR multi-archivo'
status: completed
priority: P2
dependencies: []
---

# Phase 1: Backend: fusionar OCR multi-archivo

## Overview

`AlbaranesService.createFromUpload` recibe correctamente hasta 10 archivos pero solo procesa `files[0]`. Esta fase reescribe el método para procesar TODOS los archivos vía OCR y fusionarlos en un único documento antes de entrar al pipeline existente (match de proveedor, refine por layout hints, creación del albarán), que no se toca.

## Requirements

- Funcional: subir N archivos (N ≥ 1) produce un albarán cuyas líneas son la concatenación de los productos detectados en cada archivo que se procesó con éxito, en orden de subida.
- Funcional: si algún archivo falla el OCR pero al menos uno tiene éxito, el albarán se crea igualmente con lo disponible, y sus `notes` mencionan explícitamente qué archivo falló y por qué — no repetir el patrón de pérdida silenciosa que es el bug original.
- Funcional: si TODOS los archivos fallan, se mantiene el comportamiento actual (albarán `FALLBACK-` vacío, notas con el error) — sin regresión.
- No funcional: el caso de un solo archivo (uso actual normal) debe producir un resultado idéntico al comportamiento de hoy — no cambiar nada del pipeline downstream (match de proveedor, enrich, refine, creación de líneas), solo lo que lo alimenta.
- No funcional: procesamiento secuencial (no paralelo) de los archivos — ver justificación en `plan.md` § Decisión de diseño.

## Architecture

Flujo actual (`albaranes.service.ts:391-607`, dentro de un único `try { ... } catch { crea FALLBACK- }`):

```
1. resolveForUpload(tenantId, {aiModel, aiApiKey})  // una vez, config de tenant
2. document = pythonOcrService.processImage(files[0].buffer, ...)  // ← BUG: solo files[0]
3. supplierMatch = supplierMatching.matchSupplier({cif: document.supplier_cif, name: document.supplier_name})
4. si supplierMatch.supplierId: enrichSupplierFromOcr(...) + si supplier.ocrLayoutHints && document.raw_text:
     refined = refineExtraction(document.raw_text, hints, aiModel, aiApiKey)
     si refined.success: Object.assign(document, refined.document)
5. prisma.albaran.create({ ...campos de document, lines: { create: document.products.map(...) } })
```

Flujo nuevo — se inserta un paso de fusión ENTRE 1 y 3, el resto (3, 4, 5) no cambia, solo pasa a leer de `document = mergedDocument` en vez del resultado crudo de un único archivo:

```
1. resolveForUpload(...)  // sin cambios, una vez

1b. NUEVO — para cada file de `files` (secuencial, await en loop):
      try:
        ocrResult = pythonOcrService.processImage(file.buffer, file.originalname, file.mimetype, effModel, effKey)
        si ocrResult.success && ocrResult.document: successfulDocuments.push({ filename: file.originalname, document: ocrResult.document })
        si no: failedFiles.push({ filename: file.originalname, reason: ocrResult.error || "OCR sin éxito" })
      catch (err):
        failedFiles.push({ filename: file.originalname, reason: err.message })
      // el catch es LOCAL al archivo — nunca deja escapar la excepción al try/catch exterior,
      // así un fallo de un archivo no tira todo el upload al fallback vacío

    si successfulDocuments.length === 0:
      throw new Error(`OCR falló en los ${files.length} archivo(s): ${failedFiles.map(f => f.filename).join(', ')}`)
      // deja que el catch exterior existente cree el FALLBACK- de siempre

    mergedDocument = mergeOcrDocuments(successfulDocuments)  // función nueva, pura, testeable
    document = mergedDocument
    extractedProducts = document.products || []

2. (eliminado — sustituido por 1b)
3-5. SIN CAMBIOS, ahora operan sobre `document` = mergedDocument

NUEVO al construir `notes` en el create (paso 5): si failedFiles.length > 0, añadir
  ` Aviso: ${failedFiles.length} de ${files.length} archivo(s) no se pudieron procesar (${failedFiles.map(f => `${f.filename}: ${f.reason}`).join('; ')}) — revisa si faltan líneas.`
  al final del `notes` que ya se genera hoy (`Importado desde OCR (confianza: X%)`).
```

### `mergeOcrDocuments(successfulDocuments)` — reglas de fusión

Función nueva, privada, pura (sin I/O — fácil de testear con jest sin mocks de Prisma/OCR):

- Base: `{ ...successfulDocuments[0].document }` — copia el primer documento entero como punto de partida (preserva cualquier campo no contemplado explícitamente abajo).
- `products`: `successfulDocuments.flatMap(d => d.document.products || [])` — concatenación en orden de subida.
- Para cada campo de cabecera (`supplier_name`, `supplier_cif`, `cif_code`, `supplier_address`, `supplier_phone`, `supplier_email`, `supplier_sanitary_registry`, `document_number`, `document_date`, `gross_amount`, `tax_base`, `vat_total`, `vat_breakdown`, `total_amount`): recorrer `successfulDocuments` en orden y quedarse con el primer valor truthy encontrado (si el documento base ya lo tenía, no hace falta tocarlo — solo rellenar los que falten en la base con el primer documento posterior que sí lo tenga).
- `confidence`: media aritmética de `document.confidence` (tratando `undefined`/`null` como 0) de todos los `successfulDocuments`.
- `raw_text`: `successfulDocuments.map(d => d.document.raw_text || '').filter(Boolean).join('\n\n--- página siguiente ---\n\n')`.
- Con un solo documento en `successfulDocuments` (caso normal de 1 archivo), el resultado de `mergeOcrDocuments` debe ser observacionalmente idéntico al `document` original de hoy (mismo `products`, mismos campos de cabecera, misma `confidence`, mismo `raw_text`) — es el criterio de no-regresión.

## Related Code Files

- Modify: `backend/src/modules/albaranes/albaranes.service.ts` (método `createFromUpload`, líneas ~391-607; añadir función privada `mergeOcrDocuments` en la misma clase o como función standalone exportada en el mismo archivo si se prefiere testear de forma aislada).

## Implementation Steps

1. Sustituir `const file = files[0];` y el bloque `pythonOcrService.processImage(file.buffer, ...)` (línea ~402-448) por el loop secuencial descrito arriba, acumulando `successfulDocuments` y `failedFiles`.
2. Si `successfulDocuments.length === 0`, lanzar un `Error` con mensaje descriptivo (no una excepción de Nest) para que siga cayendo en el `catch` exterior existente y reutilice el flujo `FALLBACK-` sin cambios.
3. Implementar `mergeOcrDocuments(successfulDocuments)` como función privada/pura, siguiendo exactamente las reglas de fusión de la sección Architecture.
4. Reasignar `document = mergeOcrDocuments(successfulDocuments)` y `extractedProducts = document.products || []`, dejando el resto del método (match de proveedor, enrich, refine por layout hints, stamping de `extraction_model`, construcción del `data` para `prisma.albaran.create`) **sin tocar** salvo el punto 5.
5. En la construcción de `notes` dentro de `prisma.albaran.create` (línea ~538), añadir el aviso de fallos parciales cuando `failedFiles.length > 0`, tal como se especifica arriba.
6. Extender los logs existentes (`this.logger.log`) para incluir cuántos archivos se recibieron, cuántos tuvieron éxito/fallo y el total de productos fusionados — mismo estilo que los logs ya presentes en el método.
7. No tocar `PythonOcrService`, el controller, el DTO, ni el microservicio Python — el fix es enteramente interno a `AlbaranesService.createFromUpload`.

## Success Criteria

- [ ] `createFromUpload` recorre todos los elementos de `files`, no solo `files[0]`.
- [ ] 2 archivos, ambos OCR exitoso → líneas del albarán = productos de archivo 1 + productos de archivo 2, en ese orden.
- [ ] 2 archivos, uno falla → albarán se crea con los productos del que sí funcionó, `notes` menciona el archivo fallido y el motivo.
- [ ] 2 archivos, ambos fallan → albarán `FALLBACK-` igual que el comportamiento actual de un solo archivo fallido (sin regresión).
- [ ] 1 archivo (caso actual) → resultado idéntico al comportamiento antes del fix (mismos campos, mismas líneas, mismas notas salvo que no hay aviso de fallo parcial porque no aplica).
- [ ] Ningún cambio en `PythonOcrService`, controller, DTOs ni microservicio Python.

## Risk Assessment

Riesgo bajo, cambio contenido en un método de un servicio. El riesgo principal es alterar sutilmente el comportamiento del caso de 1 archivo (el uso real hoy) — mitigado por el criterio de no-regresión explícito arriba y por los tests de fase 2, que incluyen re-ejecutar sin modificar los 5 tests `createFromUpload` ya existentes. Sin migración de schema, sin cambios de infraestructura — rollback trivial vía `git revert`.
