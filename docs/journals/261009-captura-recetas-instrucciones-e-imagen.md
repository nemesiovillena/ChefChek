# Captura de recetas: instrucciones vía metadatos e imagen del plato

**Fecha**: 2026-10-09 01:15
**Severity**: Media (bug que vaciaba la receta de pasos + una funcionalidad que faltaba)
**Componente**: `backend/src/modules/recipe-capture/` (extractor, fetcher, servicio, promoción), `frontend/src/app/dashboard/captura-recetas/`, migración `20261008210000_recipe_capture_image_url`
**Estado**: PR pendiente; al entrar en `main`, Dokploy despliega producción

## Qué pasó

El usuario capturó una receta en producción y salió **sin las instrucciones y sin la imagen del plato**. Diagnosticado con su URL real (`eurekarecetas.com/receta/suquet-rape-y-cigalas/268513.html`).

## La verdad brutal

**La IA no veía las instrucciones.** No era el prompt ni el parser: el extractor de HTML solo leía el texto *entre etiquetas*, y esa web publica la receta entera (descripción + pasos, pegados como "…Navidad.**1.** En una sartén…") dentro del `<meta property="og:description">`. El texto visible eran solo 949 caracteres (ingredientes y poco más), así que el modelo devolvía `"steps": []` con toda la razón. Incluyendo los metadatos, el texto pasó a 3036 caracteres y el modelo devolvió **4 pasos** correctos. Reproducido con IA real antes y después.

**La imagen nunca se había implementado**: en el plan estaba explícitamente fuera de alcance. El sistema sí soporta `Recipe.imageUrl`, pero la captura no lo rellenaba.

## Decisiones

- **Leer los metadatos**: `<title>` y `og:description`/`description`/`twitter:description` se añaden al texto que ve la IA (muchas webs solo publican ahí la receta). Con la misma pasada lineal, sin regex sobre la entrada completa.
- **Imagen descargada y alojada por nosotros**, no enlazada: la URL sale del HTML de una web cualquiera (podría apuntar a la LAN), así que se descarga con la **misma barrera SSRF** que las páginas (`fetchPublicImage`, 5 MB, `image/*`) y se sube a nuestro almacenamiento (Bunny). Guardar el enlace externo dejaría al optimizador de Next haciendo de proxy de esa URL.
- **Foto/PDF**: en una captura de archivo se usa la **propia foto subida** como imagen del plato (un PDF no).
- **Best-effort**: si la imagen no se puede descargar o subir, la captura termina `PENDIENTE` igual y se registra un aviso; nunca tumba la receta.
- **Se copia al pasar a Recetas** (`RecipeCapture.imageUrl` → `Recipe.imageUrl`), así que la receta nace con su foto.

## Verificación

- Reproducción real con la URL del usuario: texto 949 → 3036 chars; `steps` 0 → 4; imagen extraída (`og:image`). Con `gemini-flash-lite-latest` (el tenant de pruebas tiene `gemini-flash-latest`, que da 503).
- Tests: 269/269 en `recipe-capture` + `ai-assistant`; `tsc` backend y frontend y `next build` en verde.

## Lo que queda sin verificar

- En producción, de punta a punta (activar módulo + IA del cliente). La subida a Bunny en local cae a `/uploads` (disco), así que el camino Bunny solo se ejerce en producción.
- Capturas de archivo anteriores a este cambio no tienen imagen ni pasos recuperables (no guardaban el archivo); las nuevas sí.
