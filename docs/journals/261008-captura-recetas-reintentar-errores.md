# Captura de recetas: reintentar una captura con error

**Fecha**: 2026-10-08 20:30
**Severity**: Baja (mejora de usabilidad; no había forma de reintentar sin volver a empezar)
**Componente**: `backend/src/modules/recipe-capture/`, `frontend/src/app/dashboard/captura-recetas/`, migración `20261008200000_recipe_capture_source_file`
**Estado**: PR pendiente de fusionar; al entrar en `main`, Dokploy despliega producción

## Qué pasó

Al probar la captura en producción, la IA respondió con el error de "proveedor saturado" (un 429/5xx transitorio) y la captura quedó en `ERROR`. **No había forma de reintentarla desde la app**: el plan lo había dejado fuera de alcance y la única salida era volver a crearla (para una foto, volviendo a subir el archivo). Se añade un botón de reintentar en el listado y en la pantalla de error.

## Decisiones

- **Reintentar = rehacer la fuente guardada.** `sourceUrl` (enlace) y `sourceText` (texto) ya se guardaban; el **archivo de foto/PDF no**, así que se añade una migración que guarda el archivo (`sourceFile` + `sourceFileMimeType`). Sin esto, reintentar una foto era imposible.
- **El archivo se libera al procesarse bien o al descartar.** Solo se conserva mientras la captura puede reintentarse (`ERROR`), para no hinchar la tabla con fotos de 5 MB ya procesadas.
- **`canRetry` lo decide el servidor** y viaja en el listado y el detalle: enlace y texto siempre se pueden reintentar; una foto/PDF solo si conserva el archivo. Las capturas de archivo creadas **antes** de este cambio (sin archivo) no se pueden reintentar y muestran "vuelve a subir la foto o el PDF" en vez de un botón que fallaría.
- **Un reintento parte de cero**: se borran los ingredientes de un intento previo y se limpian los campos normalizados antes de volver a `PROCESANDO`.
- **Mismos límites que al crear**: tope de 3 capturas simultáneas por tenant (429) y mismo throttle.

## Lo que queda sin verificar

- Reintento con los tres proveedores con IA real. Con Gemini real sí se probó el camino de crear; el de reintentar comparte el mismo código de estructuración.
- Reintento de una captura de foto creada antes de este cambio (debería mostrar el mensaje, no un botón).

## Pruebas

- `recipe-capture.service.spec.ts`: 5 casos nuevos de `retry` (texto, archivo con adjunto, archivo sin archivo guardado → 400, sin captura en error → 404, tope de concurrencia → 429) y actualización de los existentes por los campos nuevos. 132/132 del módulo en verde; `tsc` del frontend en verde.
