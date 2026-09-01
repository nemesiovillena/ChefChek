# Fix: asistente IA "no funciona" — 503 "high demand" de Gemini sin reintentos

Fecha: 2026-09-01 · Rama: `fix/ai-assistant-provider-retry` (desde `origin/develop` 65a5d7e)

## Síntoma

Usuario pregunta al asistente "muestra la receta de pure de patata" → siempre responde
"He tenido un problema para conectar con el proveedor de IA. Revisa la configuración en
Ajustes → Asistente IA (modelo/API key) e inténtalo de nuevo." La config estaba correcta.

## Causa raíz (evidencia: logs Dokploy backend)

`PROVIDER_ERROR_MESSAGE` (`ai-assistant.service.ts:160`) solo se emite cuando
`adapter.chat()` lanza. Config resuelta OK (si no, saldría el mensaje "sin proveedor").

Errores reales registrados, `provider=gemini model=gemini-3.6-flash`:

- `16:56` — `No se pudo conectar con Gemini: The operation was aborted due to timeout` (32,2 s, superó los 30 s)
- `17:02` — `Gemini respondió 503: {"error":{"code":503,"message":"This model is currently experiencing high demand ... "status":"UNAVAILABLE"}}` (1,2 s)

API key válida (503 JSON real, no 401/403). Modelo válido. **Google satura
`gemini-3.6-flash` de forma intermitente.** Los 3 adaptadores de proveedor no reintentan
nunca: un solo 503/corte de red transitorio tumba la respuesta.

Por qué ahora: modelo nuevo y muy demandado, limitado por capacidad en Google. Ya
había antecedente en memoria (`gemini-model-availability-shifts-fast`).

## Cambios

- **Nuevo** `backend/src/modules/ai-assistant/providers/provider-http.util.ts`
  → `postJsonWithRetry(providerLabel, url, {headers, body}, opts?)`
  - Reintenta: `429, 500, 502, 503, 504` y errores de red que no sean timeout/abort.
  - No reintenta: `4xx` salvo 429, ni `TimeoutError`/`AbortError` (alargaría la espera).
  - Backoff `[500, 1200] ms` (3 intentos); respeta `Retry-After` capado a 5 s.
  - Timeout por intento 30 s (sin cambio). Misma `BadGatewayException` y mismos
    mensajes que antes → sin cambio de contrato para el llamador.
- `gemini-provider.adapter.ts`, `openai-provider.adapter.ts`,
  `anthropic-provider.adapter.ts`: usan el helper. Se borran ~60 líneas duplicadas
  (fetch + try/catch de red + bloque `!res.ok`). Parsing de respuesta intacto.
- **Nuevo** `provider-http.util.spec.ts` (8 tests: 200 directo, retry 503, retry
  429+red, agota reintentos, no-retry 4xx, no-retry timeout, Retry-After).

## Verificación

- `jest src/modules/ai-assistant` → **84/84 verde** (11 suites).
- `tsc --noEmit` → OK. `eslint providers/` → 0 errores (solo warnings `any`
  preexistentes en todo el módulo). `nest build` → OK.
- Blast radius: helper solo lo usan los 3 adaptadores; adaptadores solo los usa
  `AiAssistantService`. Contrato `ProviderAdapter.chat` sin cambios.

## Mitigación inmediata para el usuario (no requiere deploy)

Ajustes → Asistente IA → elegir **Gemini 2.0 Flash** (menos congestionado) o un
modelo de **Anthropic/OpenAI** mientras `gemini-3.6-flash` esté saturado.

## Preguntas abiertas

- ¿Merece la pena un fallback automático de modelo (p.ej. 3.6-flash → 2.0-flash)
  tras N fallos consecutivos? No incluido: YAGNI hasta ver si el retry basta.
- ¿Subir el timeout por intento a 45 s? Descartado: el techo del front es 90 s y
  `MAX_TOOL_TURNS=4`.
