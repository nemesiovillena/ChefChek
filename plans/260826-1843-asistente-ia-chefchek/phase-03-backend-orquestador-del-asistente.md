---
phase: 3
title: Backend orquestador del asistente
status: completed
priority: P1
dependencies:
  - 1
  - 2
---

# Phase 3: Backend orquestador del asistente

## Overview

Módulo `ai-assistant` que expone `POST /ai-assistant/ask`: arma el prompt con la persona "Chefchek", llama al proveedor configurado con tool-calling, ejecuta las tools server-side, y persiste la conversación.

## Requirements

- Funcional: `POST /ai-assistant/ask { conversationId?: string, message: string }` → crea conversación si no existe, añade el mensaje del usuario, llama al LLM, ejecuta tools si el LLM las pide, devuelve la respuesta final en lenguaje natural.
- Funcional: `GET /ai-assistant/conversations` (lista del usuario actual) y `GET /ai-assistant/conversations/:id` (mensajes de una conversación, solo si pertenece al usuario+tenant actual).
- Funcional: si no hay proveedor/API key configurado, responde 200 con un mensaje del propio "Chefchek" pidiendo configurarlo en Ajustes — no un 500 genérico.
- No-funcional: sin SDKs pesados por proveedor — adaptadores finos por `fetch` nativo (Node ≥18) normalizados a una interfaz común, para no acoplar el backend a 3 librerías distintas para algo que ya son llamadas HTTP simples.
- No-funcional: límite de turnos de tool-calling (p.ej. máx. 4 llamadas a tools por pregunta) para evitar loops si el LLM insiste en llamar tools sin converger.
- No-funcional: rate limit específico y más estricto que el default de `ThrottlerModule` sobre `/ai-assistant/ask` (llamadas a LLM cuestan dinero).

## Architecture

```
POST /ai-assistant/ask
  → AiAssistantController (AuthGuard, tenantId/userId del request)
  → AiAssistantService.ask(tenantId, userId, conversationId?, message)
      1. resuelve conversación (crea si falta), guarda mensaje "user"
      2. arma system prompt persona "Chefchek" + historial reciente
      3. providerAdapter.chat(messages, toolSchemas)
      4. si respuesta trae tool_calls:
           - ToolRegistryService.executeTool(tenantId, name, params) por cada uno
           - guarda mensaje "tool" con el resultado
           - vuelve a llamar al provider con el resultado añadido (hasta el límite de turnos)
      5. guarda mensaje "assistant" final, devuelve texto
```

Adaptadores (`ProviderAdapter` interface: `chat(messages, tools): Promise<{content?, toolCalls?}>`):
- `openai-provider.adapter.ts` — Chat Completions API con `tools`.
- `gemini-provider.adapter.ts` — Generative Language API con `functionDeclarations`.
- `anthropic-provider.adapter.ts` — Messages API con `tools`.

System prompt persona "Chefchek": nombre del asistente, tono cercano, instrucción explícita de usar SIEMPRE una tool para cualquier dato numérico/de negocio (nunca inventar cifras), y de responder en español.

## Related Code Files

- Create: `backend/src/modules/ai-assistant/ai-assistant.module.ts`
- Create: `backend/src/modules/ai-assistant/ai-assistant.controller.ts`
- Create: `backend/src/modules/ai-assistant/ai-assistant.service.ts`
- Create: `backend/src/modules/ai-assistant/dto/ask-assistant.dto.ts`
- Create: `backend/src/modules/ai-assistant/providers/provider-adapter.interface.ts`
- Create: `backend/src/modules/ai-assistant/providers/openai-provider.adapter.ts`
- Create: `backend/src/modules/ai-assistant/providers/gemini-provider.adapter.ts`
- Create: `backend/src/modules/ai-assistant/providers/anthropic-provider.adapter.ts`
- Create: `backend/src/modules/ai-assistant/ai-assistant.service.spec.ts`
- Create: `backend/src/modules/ai-assistant/ai-assistant.controller.spec.ts`
- Modify: `backend/src/app.module.ts` (import `AiAssistantModule`, registrar `AiAssistantController` si el patrón del proyecto lista controllers aparte — confirmar mirando cómo lo hace `OcrConfigModule`)
- Reference: `backend/src/modules/ocr/python-ocr.service.ts` (patrón de llamada HTTP a servicio externo), `backend/src/websocket/websocket.gateway.ts` (NO se usa en v1, solo referencia de qué NO hacer — sin streaming)

## Implementation Steps

1. Definir `ProviderAdapter` interface y los 3 adaptadores. Cada uno recibe `{ apiKey, model }` (de `AiAssistantConfigService.resolveForRequest`) y normaliza la respuesta a `{ content?: string, toolCalls?: Array<{id, name, params}> }`.
2. `AskAssistantDto`: `conversationId?: string`, `message: string` (validado, no vacío, límite de longitud razonable p.ej. 2000 chars).
3. `AiAssistantService.ask()`: implementa el loop descrito en Architecture, con límite duro de turnos (constante `MAX_TOOL_TURNS = 4`).
4. Manejo del caso "sin config": si `AiAssistantConfigService.getPublicConfig(tenantId).hasApiKey === false`, devolver directamente un mensaje fijo de Chefchek pidiendo configuración, sin llamar a ningún adaptador.
5. Persistencia: cada paso del loop (user/tool/assistant) se guarda como `AssistantMessage`; el título de la conversación (para listarla) se genera con las primeras palabras del primer mensaje del usuario.
6. Controller: `AuthGuard` + inyectar `tenantId`/`userId` desde el request (mismo patrón que el resto de controllers del proyecto, p.ej. `compras.controller.ts`). Aplicar un `@Throttle()` más estricto en el endpoint `ask` (revisar sintaxis actual de `@nestjs/throttler` ya usada en `app.module.ts`).
7. Tests: mockear los 3 adaptadores (no llamar APIs reales en tests) y verificar: respuesta directa sin tools, respuesta con 1 tool call, respuesta con 2 tools encadenadas, corte al llegar a `MAX_TOOL_TURNS`, y el mensaje de "sin config".

## Success Criteria

- [ ] `POST /ai-assistant/ask` responde con una pregunta real ("¿qué producto se compró más la última semana?") usando datos reales de un tenant de prueba con provider configurado.
- [ ] Sin config guardada, el endpoint responde 200 con el mensaje de "configura tu proveedor", nunca 500.
- [ ] El loop de tools nunca excede `MAX_TOOL_TURNS`, verificado con un mock que siempre pide otra tool.
- [ ] Un usuario del tenant A nunca puede leer (`GET /ai-assistant/conversations/:id`) una conversación de otro tenant o de otro usuario del mismo tenant.
- [ ] Tests en verde vía `bunx jest`; `bunx tsc --noEmit` limpio en el backend.

## Risk Assessment

- **Riesgo**: el LLM devuelve un `tool_call` con `name` que no existe en el registro (alucinación). Mitigación: `ToolRegistryService.executeTool` ya rechaza nombres desconocidos (fase 2); el servicio debe capturar ese error y devolvérselo al LLM como resultado de tool ("esa función no existe, elige otra") en vez de romper la request.
- **Riesgo**: coste descontrolado si un tenant hace spam de preguntas. Mitigación: throttle específico en el endpoint (más agresivo que el global 100/60s).
- **Riesgo**: distinto shape de "function calling" entre OpenAI/Gemini/Anthropic hace el adaptador frágil. Mitigación: interfaz común mínima (`chat(messages, tools)`) y tests por adaptador con fixtures de respuesta real de cada API (grabadas, no llamadas en vivo).
