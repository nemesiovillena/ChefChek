# Release de captura de recetas fusionado (PR #300) y verificaciones de cierre

**Fecha**: 2026-10-08 19:20
**Severity**: Baja (sin incidencias; el release solo corta tag, no despliega todavía)
**Componente**: `main`, workflow `Release` (`.github/workflows/deploy.yml`), módulo `backend/src/modules/recipe-capture/` y `frontend/src/app/dashboard/captura-recetas/`
**Estado**: PR #300 fusionado, release `v20261008-c3add7e` publicado; despliegue real a producción (Dokploy) sigue diferido por diseño

## Qué pasó

Se retomó la sesión donde quedó: el módulo `captura-recetas` ya estaba en `develop` (PR #290, merge `42854cd`) y solo faltaba decidir el release `develop → main` (PR #300). Se fusionó con merge commit (método del repo para releases), quedando `main` en `c3add7e`, y el workflow `Release` generó el tag `v20261008-c3add7e`. Las cuatro comprobaciones (Lint/Build/Unit, E2E, E2E Smoke, Lint & Build) pasaron antes de fusionar.

## La verdad brutal

**"Fusionar #300 despliega a producción" era falso.** El workflow `deploy.yml` se llama `Release` y su único job, `Create release tag`, corta un tag con `softprops/action-gh-release`. El comentario del propio archivo lo dice: el despliegue a Dokploy (VPS, Docker Compose) está diferido hasta que el proyecto avance; cuando se active hay que añadir un job `deploy`. Es decir, el merge deja el código en `main` y tagueado, pero **no publica nada**. Conviene corregir esa expectativa en las notas del release.

**El diario de cierre del módulo nunca llegó a `develop`.** El commit `3f0e7cf docs(captura-recetas): diario de cierre del módulo` está solo en `feat/captura-recetas` (y su remoto), no en `develop` ni `main`; `git branch --contains` lo confirma. El código del módulo sí está en ambos por el PR #290. Queda como cabo suelto: si se quiere el diario junto al código, hay que llevarlo a `develop`.

## Verificaciones de cierre

- **Tests backend**: 168/168 en verde en `ai-assistant/providers`, `recipe-capture` y `assistant-completion` (incluye los specs de adjuntos imagen/PDF de los tres adaptadores).
- **Captura por imagen, real (Gemini)**: JPG → `PENDIENTE`, "Tarta de queso al horno", 6 pasos y 6 ingredientes, 4 con artículo sugerido. `gemini-flash-latest` volvió a dar **503** (saturación del modelo), como en la sesión anterior; se hizo con `gemini-flash-lite-latest` y la misma clave del tenant.
- **Móvil (390×844) y modo claro**: listado, modos Enlace/Texto/Foto y pantalla de revisión, en oscuro y claro. **Sin desbordes horizontales** en ningún caso; buen contraste en ambos temas.

## Lo que queda sin verificar

- **Captura por foto real**: la prueba usó una imagen JPG sintética (texto renderizado), no una foto de un móvil. El camino del adjunto es el mismo, pero no se ha probado con una foto real con perspectiva, sombras o mala luz.
- **Anthropic y OpenAI**: siguen sin probarse con IA real. **No hay claves configuradas** en el entorno local ni en la base de datos (el único tenant con asistente, `chefchek-demo`, usa Gemini). Solo están cubiertos por specs con respuestas simuladas.
- Receta de ≥ 20 ingredientes y ≥ 12 pasos con los tres proveedores.

## Hallazgos menores de la prueba en navegador

- En 390 px las pestañas de origen se recortan ("Pegar …", "Foto o …"): es cosmético, las tres siguen siendo pulsables.
- La barra de navegación inferior es fija y tapa la última tarjeta mientras no se hace scroll; al llegar al fondo, el contenido queda por encima de ella. No hay contenido inaccesible.
- El usuario de prueba `captura-prueba@chefchek.test` tenía la contraseña desfasada respecto al archivo de la sesión anterior (401). Se regeneró el hash con `bcrypt` (la misma librería y coste que la app) para poder entrar.
