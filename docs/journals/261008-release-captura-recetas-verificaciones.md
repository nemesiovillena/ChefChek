# Release de captura de recetas fusionado (PR #300) y verificaciones de cierre

**Fecha**: 2026-10-08 19:20
**Severity**: Baja (sin incidencias en el código; dos correcciones de documentación)
**Componente**: `main`, Dokploy (producción `app.chefchek.com` / `api.chefchek.com`), módulo `backend/src/modules/recipe-capture/` y `frontend/src/app/dashboard/captura-recetas/`
**Estado**: PR #300 (módulo) y #303 (arreglo de cuota + diario) en `main`; releases `v20261008-c3add7e` y `v20261008-6c8f897`; producción desplegada por el auto-deploy de Dokploy

## Qué pasó

Se retomó la sesión donde quedó: el módulo `captura-recetas` ya estaba en `develop` (PR #290, merge `42854cd`) y solo faltaba decidir el release `develop → main` (PR #300). Se fusionó con merge commit (método del repo para releases), quedando `main` en `c3add7e`, y el workflow `Release` generó el tag `v20261008-c3add7e`. Las cuatro comprobaciones (Lint/Build/Unit, E2E, E2E Smoke, Lint & Build) pasaron antes de fusionar. El push a `main` disparó el auto-deploy de Dokploy a producción (`app.chefchek.com` / `api.chefchek.com`).

## La verdad brutal

**Corrección (2026-10-08 19:45): sí despliega a producción.** Escribí aquí que fusionar #300 no publicaba nada, basándome en el comentario de `.github/workflows/deploy.yml` (dice que el despliegue a Dokploy está diferido). Ese comentario está **desactualizado**: Dokploy lleva activo desde 2026-07-19 (proyecto "ChefChek" en VPS Hostinger) con **auto-deploy en push a `main`** y `watchPaths` por servicio; el workflow `deploy.yml` solo corta el tag/release. Comprobado en vivo: `api.chefchek.com/api/v1/recipe-captures` → **401** (el endpoint existe; un 404 significaría que no está desplegado) y `app.chefchek.com/dashboard/captura-recetas` → **200** (una ruta inexistente daría 404). Detalle en `docs/deployment.md` y `docs/DEPLOYMENTSTRATEGY.md`. Lección: no fiarse de un comentario de workflow; la fuente de verdad es la documentación de despliegue.

**Otra corrección: el diario del módulo sí está en `develop`.** El archivo `261007-captura-recetas-modulo-completo-pr-290.md` entró en `develop` con el propio PR #290 (`42854cd`), y su contenido es idéntico al de `feat/captura-recetas`. Lo que está solo en `feat/captura-recetas` es el *commit* `3f0e7cf` (misma copia), no el archivo. La comprobación correcta es `git cat-file -e origin/develop:<ruta>`, no `git branch --contains`.

## Verificaciones de cierre

- **Tests backend**: 168/168 en verde en `ai-assistant/providers`, `recipe-capture` y `assistant-completion` (incluye los specs de adjuntos imagen/PDF de los tres adaptadores).
- **Captura por imagen, real (Gemini)**: JPG → `PENDIENTE`, "Tarta de queso al horno", 6 pasos y 6 ingredientes, 4 con artículo sugerido. `gemini-flash-latest` volvió a dar **503** (saturación del modelo), como en la sesión anterior; se hizo con `gemini-flash-lite-latest` y la misma clave del tenant. Con una clave de Gemini nueva facilitada por el usuario se repitieron imagen y PDF: ambos `PENDIENTE` (imagen → "Tarta de queso", 6/6/4; PDF → "Bizcocho de yogur", 4 pasos, 7 ingredientes, 5 sugeridos), en dos intentos seguidos. Un 503 puntual tumbó un intento de PDF porque los adjuntos van con `noRetry`.
- **Anthropic, real**: la clave **es válida** (listó modelos: `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-sonnet-4-5-*`, …) pero la cuenta **no tiene saldo**: cualquier generación responde `400 invalid_request_error: Your credit balance is too low`. No se pudo verificar la generación real, sí la validez de la clave y del listado de modelos.
- **Captura por foto real (Gemini)**: foto real de una tarjeta de receta escrita a mano («Pork Chalupas», en blanco y negro, con perspectiva y fondo de cocina) → `PENDIENTE`, «Chalupas de cerdo», 8 ingredientes traducidos al español, 3 pasos, cocción 8 h (480 min) y 2 sugerencias. Confirma que el camino de imagen funciona con una foto de verdad, no solo con una imagen sintética.
- **Móvil (390×844) y modo claro**: listado, modos Enlace/Texto/Foto y pantalla de revisión, en oscuro y claro. **Sin desbordes horizontales** en ningún caso; buen contraste en ambos temas.
- **Tests backend tras el arreglo de abajo**: 237/237 en verde (`ai-assistant` + `recipe-capture`).

## Lo que queda sin verificar

- **Captura por foto**: verificada con una foto real (tarjeta manuscrita). Sigue sin probarse con una foto hecha con un móvil en el momento (cámara, reflejos, movimiento), pero el camino del adjunto es el mismo.
- **Anthropic y OpenAI**: no se pudo completar una generación real. De Anthropic hay clave y es válida, pero la cuenta no tiene saldo (400 "credit balance is too low"); de OpenAI no hay clave. Siguen cubiertos por specs con respuestas simuladas.
- Receta de ≥ 20 ingredientes y ≥ 12 pasos con los tres proveedores.

## Hallazgos menores de la prueba en navegador

- En 390 px las pestañas de origen se recortan ("Pegar …", "Foto o …"): es cosmético, las tres siguen siendo pulsables.
- La barra de navegación inferior es fija y tapa la última tarjeta mientras no se hace scroll; al llegar al fondo, el contenido queda por encima de ella. No hay contenido inaccesible.
- El usuario de prueba `captura-prueba@chefchek.test` tenía la contraseña desfasada respecto al archivo de la sesión anterior (401). Se regeneró el hash con `bcrypt` (la misma librería y coste que la app) para poder entrar.

## Hallazgo corregido: cuota agotada se mostraba como fallo de configuración

Al probar Anthropic apareció `400 invalid_request_error: Your credit balance is too low`, y la app lo mostraba como *"He tenido un problema para conectar con el proveedor de IA. Revisa la configuración en Ajustes → Asistente IA (modelo/API key)"*. El usuario habría cambiado de modelo o de clave sin motivo: el problema es de saldo/facturación. La causa era que `toUserFacingProviderError` solo reconocía la cuota en respuestas **429**, y Anthropic la señala con **400**.

Arreglado en `provider-error-message.util.ts`: la detección de cuota ahora cubre 400/402/403/429 junto con el motivo (`quota`, `billing`, `credit balance`, `insufficient_quota`), sin tocar el caso 401 (clave inválida), que sigue siendo un problema de configuración. Dos casos nuevos en `assistant-completion.service.spec.ts` (400 de Anthropic con saldo agotado → mensaje de cuota; 400 de validación → mensaje genérico). 10/10 y 237/237 en verde. PR **#301** fusionado en `develop` y publicado en `main` con el release **#303** (`v20261008-6c8f897`).

