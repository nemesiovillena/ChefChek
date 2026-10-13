# Catálogo de modelos: gemini-3.1-flash-lite como predeterminado de captura

**Fecha**: 2026-10-09 18:30
**Severity**: Baja (mejora de fiabilidad; sin cambios de código de producto)
**Componente**: `frontend/src/lib/ai-models.ts`, `frontend/src/app/dashboard/settings/components/recipe-capture-config-section.tsx`
**Estado**: PR pendiente; al entrar en `main`, Dokploy despliega

## Qué pasó

Medido el catálogo con la tarea real de captura (la receta del usuario por enlace y una foto de una tarjeta manuscrita), con el mismo prompt y opciones del servicio. Resultados (3 intentos de texto + 1 de foto):

| Modelo | Texto | Foto | Latencia |
|---|---|---|---|
| **gemini-3.1-flash-lite** | **3/3** (4 pasos) | OK | 2-9 s |
| gemini-3.6-flash | 0/3 (503) | 1 (1 paso) | 4-20 s |
| gemini-flash-latest | 0/3 (timeout/503) | fallo | 20-45 s |
| gemini-3.8-flash | 0/3 (503) | fallo | — |
| OpenCode Zen (todos) | 403 "Model access is disabled" | — | <1 s |
| OpenAI / Anthropic | sin clave / cuenta sin saldo | — | — |

## Cambios

- **Fuera del catálogo**: `gemini-3.6-flash` y `gemini-flash-latest` (fallaban con una clave de Google válida por saturación, no por configuración).
- **Dentro**: `gemini-3.1-flash-lite` (con visión), que es además el que mejor rindió.
- **Predeterminado de captura**: la sección de Configuración usa `VISION_MODELS[0]`; ahora fija explícitamente `gemini-3.1-flash-lite` como predeterminado.

## Qué NO se toca (y por qué)

- **OpenCode Zen**: el 403 es de la **clave** del tenant ("Model access is disabled"), no del modelo; con una clave con acceso funcionarían. Quitarlos rompería a otros clientes que sí los tengan.
- **OpenAI / Anthropic**: no se pudieron verificar (sin clave / cuenta sin saldo); no hay motivo para quitarlos.

## Lo que queda sin verificar

- `gemini-3.1-flash-lite` con recetas muy largas (≥20 ingredientes) y con PDF: probado con la receta del usuario (15 ingredientes) y una foto, no con el máximo.
- El 503 de los "Flash" grandes es saturación temporal de Google; podrían volver a funcionar más adelante.
