---
title: 'Asistente IA Chefchek: consultas en lenguaje natural sobre compras y precios'
description: >-
  Asistente conversacional 'Chefchek' que responde en lenguaje natural preguntas
  sobre precios, compras y proveedores, vía tool-calling seguro sobre la
  analítica existente.
status: completed
priority: P2
branch: fix/technical-sheets-broken-endpoints
tags:
  - ai-assistant
  - compras
  - precios
blockedBy: []
blocks: []
created: '2026-08-26T16:52:09.187Z'
createdBy: 'ck:plan'
source: skill
---

# Asistente IA Chefchek: consultas en lenguaje natural sobre compras y precios

## Overview

Añadir un asistente de IA llamado **Chefchek** (mismo nombre que el producto, inspirado en "Yulia" de Yurest) que responde en lenguaje natural preguntas de negocio como "¿quién me ha subido precios este mes?" o "¿qué producto se compró más la última semana?". Accesible desde un widget flotante global y desde una página dedicada `/dashboard/asistente`, con historial de conversación persistido.

## Decisiones del usuario (vinculantes)

- **Arquitectura**: tool-calling — el LLM elige entre funciones de consulta predefinidas y seguras (no texto-a-SQL libre). Justificación: la app ya es multi-tenant en producción con datos reales; texto-a-SQL libre añade riesgo de fuga entre tenants e inyección sin aportar nada que las funciones no cubran ya casi por completo (`purchase-analytics.service.ts`, `SupplierPriceHistory`, `ProductPriceHistory`, `PriceDeviation` ya existen).
- **Proveedor IA**: configuración propia del asistente (NO reutiliza `ocr-config`), nueva sección en Configuración para elegir y guardar proveedor (OpenAI/Gemini/Anthropic) + modelo + API key, cifrada igual que SMTP/OCR (`encryption.util.ts`, salt propio `"chefchek-assistant"`).
- **UI**: widget flotante global (accesible desde cualquier pantalla del dashboard) **y** página dedicada `/dashboard/asistente` con historial largo. Ambos comparten el mismo componente de chat y el mismo hook.
- **Nombre del asistente**: "Chefchek" — se usa como persona en el system prompt y en la UI (saludo, avatar, título del panel).
- **Alcance v1**: request/response síncrono por HTTP (sin streaming SSE/WS) — más simple, suficiente para preguntas puntuales; se puede añadir streaming después si hace falta.
- **Alcance de preguntas (validación)**: no solo compras/precios/proveedores — v1 incluye también coste de receta, stock bajo y stock de un producto (9 tools en total, fase 2). Ampliable a futuro sin tocar la arquitectura, solo añadiendo tools al registro.
- **Activación del módulo (validación)**: `defaultEnabled: true` en `MODULE_REGISTRY` — el asistente aparece activo por defecto en todos los tenants; sin proveedor configurado responde con un mensaje propio pidiendo configurarlo, nunca un error.

## Arquitectura (resumen)

```
Usuario → Widget/Página (frontend) → POST /ai-assistant/ask
    → AiAssistantService: arma system prompt "Chefchek" + historial + tools
    → Provider adapter (OpenAI/Gemini/Anthropic vía fetch, sin SDK pesado)
    → LLM decide: responder directo O llamar 1+ tools
    → Tool handlers (backend, tenantId inyectado server-side, NUNCA del LLM)
    → Resultado de tools vuelve al LLM → respuesta final en lenguaje natural
    → Se persiste conversación (AssistantConversation/AssistantMessage)
```

Los tools reutilizan y extienden servicios ya existentes en `compras` (analítica, histórico de precios) — no se crea un motor de analítica nuevo.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Modelo de datos y config IA](./phase-01-modelo-de-datos-y-config-ia.md) | Completed |
| 2 | [Tools de consulta (precios y compras)](./phase-02-tools-de-consulta-precios-y-compras.md) | Completed |
| 3 | [Backend orquestador del asistente](./phase-03-backend-orquestador-del-asistente.md) | Completed |
| 4 | [Frontend config en Settings](./phase-04-frontend-config-en-settings.md) | Completed |
| 5 | [Frontend chat (widget + página)](./phase-05-frontend-chat-widget-p-gina.md) | Completed |
| 6 | [Registro de módulo y pruebas](./phase-06-registro-de-m-dulo-y-pruebas.md) | Completed |

Fases 1→3 son backend puro y deben ir en orden (2 y 3 dependen del modelo/config de fase 1). Fase 4 puede empezar en paralelo a fase 2/3 (solo depende de fase 1). Fase 5 depende de fase 3 (necesita el endpoint `/ai-assistant/ask`). Fase 6 cierra el ciclo.

## Dependencias

Ninguna con otros planes activos en `plans/`. No bloquea ni es bloqueada por trabajo en curso (rama actual es un fix no relacionado, `fix/technical-sheets-broken-endpoints`).

## Riesgos transversales

- **Fuga entre tenants**: todo tool handler recibe `tenantId` inyectado desde el JWT/sesión del request, nunca como parámetro que el LLM pueda rellenar. Cubierto explícitamente en criterios de aceptación de fase 2 y 6.
- **Coste/abuso de API**: sin límite, un tenant podría gastar mucho en tokens. Mitigar con un `@Throttle()` propio (no hay precedente de uso por-endpoint en el proyecto — se introduce nuevo en fase 3, ver riesgo específico ahí) sobre `/ai-assistant/ask`, más estricto que el límite global (100/60s).
- **Proveedor sin API key configurada**: el asistente debe degradar con un mensaje claro ("configura tu proveedor de IA en Ajustes"), no un 500. Relevante porque el módulo queda `defaultEnabled: true` (ver Validation Log) — todo tenant lo verá activo desde el día uno.

## Validation Log

### Sesión 1 — 2026-08-26

**Verificación (contra el código real, previa a la entrevista):**
- ❌ FALLO: fase 2 asumía `SupplierPriceHistory` con campos `previousPrice`/`newPrice`. El modelo real (schema.prisma:1788) solo tiene `averagePrice`/`recordDate`. Corregido: usar `ProductPriceHistory` (schema.prisma:1961), que sí tiene el shape necesario.
- ✅ Verificado: `PurchaseOrderLine.receivedQuantity`/`receivedPrice` (schema.prisma:2144) es consistente con el dominio ya usado por `PurchaseAnalyticsService`.
- ✅ Verificado: `docs/system-architecture.md` existe.
- ⚠️ Nota: no existe ningún `@Throttle()` por-endpoint en el proyecto hoy — la fase 3 lo introduce nuevo, no hay patrón previo que copiar.
- Tier: Standard (6 fases → se aplicó verificación dirigida por el propio agente en vez de spawnear 4 roles separados, dado que el agente ya había leído el código fuente relevante durante el scouting inicial).

**Preguntas y decisiones (4):**
1. **Fix ProductPriceHistory** → Confirmado: usar `ProductPriceHistory`, no `SupplierPriceHistory`. Propagado a fase 2.
2. **Criterio "comprado"** → Confirmado: `PurchaseOrderLine.receivedQuantity` (pedido y conciliado), no `AlbaranLine`. Ya era la recomendación original, sin cambios de código, solo confirmación explícita en fase 2.
3. **Activación de módulo** → `defaultEnabled: true` (revierte la recomendación original de `false`). Propagado a fase 6.
4. **Alcance v1** → Ampliado a recetas/costes/stock (3 tools nuevas: `get_recipe_cost`, `get_low_stock_products`, `get_product_stock`), en vez de limitarse a compras/precios/proveedores. Propagado a fase 2 (9 tools totales) y a este overview.

### Whole-Plan Consistency Sweep

Re-leídos `plan.md` y las 6 fases tras la propagación. Sin contradicciones pendientes:
- Ninguna mención restante a `SupplierPriceHistory` como fuente de `get_price_increases` (solo aparece ya corregida/contextualizada).
- Ninguna mención restante a `defaultEnabled: false` para este módulo.
- Recuento de tools consistente en 9 en overview, fase 2 (lista, Related Code Files, Success Criteria) y referencias cruzadas.
- Fase 6 y fase 3 siguen coherentes entre sí sobre el mensaje de "sin config" (mismo comportamiento descrito en ambas).

**Resultado: 0 contradicciones sin resolver. Plan listo para implementación.**

## Implementación completada (2026-08-26)

Las 6 fases implementadas y verificadas: suite completa backend en verde (1671 tests, 106 suites), typecheck limpio backend+frontend, lint limpio en archivos nuevos del frontend, smoke test e2e (`test/e2e/ai-assistant.e2e-spec.ts`) pasando contra la BD real de desarrollo, boot manual del backend compilado confirmando que el DI wiring resuelve sin errores.

### Revisión de código post-implementación

Se lanzó un `code-reviewer` independiente sobre el diff completo antes de cerrar. Hallazgos y resolución:

- **[CRÍTICO — corregido]** Los adaptadores de Gemini y Anthropic rompían con "parallel tool calling" (2+ tool calls en una misma respuesta del LLM, comportamiento por defecto de ambas APIs): el orquestador empuja un `ChatMessage` `role="tool"` por cada llamada, y ambos adaptadores mapeaban cada uno a su propio turno `user` separado, generando 2+ turnos `user` consecutivos — rechazado por ambas APIs (400), con el error crudo del proveedor filtrándose al chat y la conversación quedando en un estado irrecuperable (el turno roto ya persistido se reenviaba en cada mensaje siguiente). Corregido agrupando los `role="tool"` consecutivos en un único turno por adaptador (`buildMessages`/`buildContents`), con tests de regresión en ambos specs de adaptador + uno a nivel orquestador.
- **[MEDIO — corregido]** `AssistantConversation.updatedAt` nunca se actualizaba tras el primer mensaje, así que el listado de conversaciones (`/dashboard/asistente`, ordenado por actividad reciente) no reflejaba uso real. Corregido: se toca `updatedAt` al final de cada `ask()`.
- **[MEDIO — corregido]** El historial completo de la conversación se reenviaba al proveedor en cada turno, sin límite — riesgo real de reventar el context window en conversaciones largas. Corregido: ventana de los últimos 30 mensajes, recortada a un límite "seguro" (nunca empieza a mitad de un intercambio tool-calling huérfano).
- **[BAJO — sin resolver, pendiente de decisión del usuario]** `AiAssistantConfigController` no está gateado por `@RequireModule("asistente-ia")` — un tenant con el módulo desactivado puede seguir viendo/editando la config del proveedor. No estaba en el alcance explícito de fase 6 (que solo lista los 3 endpoints de `ai-assistant.controller.ts`); a confirmar si es el comportamiento deseado o hay que gatearlo también.
- **[BAJO — no bloqueante]** `getConversation` devuelve 404 (tenant ajeno) vs 403 (usuario ajeno mismo tenant) — filtra "este id existe" dentro del mismo tenant. Riesgo bajo (ids son `cuid` no adivinables); comportamiento documentado y testeado, no se cambia sin pedirlo explícitamente.

Tras las correcciones: 1671 tests backend en verde (+6 vs. antes de la revisión), typecheck limpio, e2e limpio.
