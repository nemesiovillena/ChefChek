---
phase: 5
title: Frontend chat (widget + página)
status: completed
priority: P2
dependencies:
  - 3
---

# Phase 5: Frontend chat (widget + página)

## Overview

UI de chat con la persona "Chefchek": un widget flotante global en el dashboard y una página dedicada `/dashboard/asistente`, ambos compartiendo el mismo componente de conversación.

## Requirements

- Funcional: widget flotante (icono fijo, p.ej. esquina inferior derecha) visible en cualquier pantalla del dashboard, abre/cierra un panel de chat compacto.
- Funcional: página `/dashboard/asistente` con la misma conversación pero a pantalla completa, con lista de conversaciones anteriores en un lateral.
- Funcional: mensajes de "Chefchek" identificados con su nombre/avatar; estado de carga mientras espera respuesta (el request es síncrono, sin streaming — mostrar un indicador tipo "Chefchek está pensando…").
- No-funcional: mismo widget y misma página deben poder seguir una conversación ya empezada (compartir `conversationId` vía el hook, no vía URL obligatoriamente).

## Architecture

Componente compartido `AssistantChatPanel` (mensajes + input + envío) usado por:
- `AssistantFloatingWidget` (montado una vez en `dashboard/layout.tsx`, junto al resto de UI global) — icono + popover con `AssistantChatPanel` dentro.
- `app/dashboard/asistente/page.tsx` — layout a pantalla completa con `AssistantChatPanel` + sidebar de conversaciones (`GET /ai-assistant/conversations`).

Hook `use-ai-assistant.ts`:
- `useAskAssistant()` — mutation `POST /ai-assistant/ask`.
- `useAssistantConversations()` — query lista.
- `useAssistantConversation(id)` — query mensajes de una conversación.

## Related Code Files

- Create: `frontend/src/hooks/use-ai-assistant.ts`
- Create: `frontend/src/components/assistant/assistant-chat-panel.tsx`
- Create: `frontend/src/components/assistant/assistant-floating-widget.tsx`
- Create: `frontend/src/app/dashboard/asistente/page.tsx`
- Modify: `frontend/src/app/dashboard/layout.tsx` (montar `AssistantFloatingWidget`)
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (entrada de navegación a `/dashboard/asistente`)
- Reference: `frontend/src/components/notification-system.tsx` (patrón de panel flotante global ya existente en el layout — icono + dropdown/popover)

## Implementation Steps

1. Leer `notification-system.tsx` y la sección de la campana de notificaciones en `dashboard/layout.tsx` para replicar el mismo patrón de posicionamiento fijo + toggle de visibilidad (evita reinventar z-index/overlay).
2. `use-ai-assistant.ts`: mutation + queries sobre los endpoints de fase 3, con manejo de error visible (toast) si el backend responde con el mensaje de "sin config" — en ese caso, ofrecer un link directo a `/dashboard/settings`.
3. `AssistantChatPanel`: input de texto + lista de mensajes (scroll, distinto estilo bubble para user/assistant), estado de "pensando" mientras la mutation está en curso.
4. `AssistantFloatingWidget`: botón fijo con icono (persona "Chefchek", usar el propio logo/mascota de la app si existe uno reutilizable, si no un icono de chat), popover con `AssistantChatPanel` dentro, cerrado por defecto.
5. `app/dashboard/asistente/page.tsx`: layout de dos columnas — lista de conversaciones (izquierda) + `AssistantChatPanel` de la conversación seleccionada (derecha), con estado inicial "nueva conversación" si no hay ninguna.
6. Registrar la ruta en `nav-config.ts` bajo el grupo que tenga más sentido (o como entrada suelta si no encaja en ninguna categoría existente) — coordinar con fase 6, que además la gatea por módulo.
7. Verificar en móvil: el widget flotante no debe chocar con la barra de navegación inferior ya existente (memoria: `dashboard-tasks-drag-and-drop-sortorder`, `mobile-dashboard-nav-overhaul` — revisar z-index/posición en breakpoints móviles).

## Success Criteria

- [ ] Desde cualquier pantalla del dashboard se puede abrir el widget, preguntar "¿qué producto se compró más la última semana?" y recibir una respuesta coherente con datos reales.
- [ ] La página `/dashboard/asistente` muestra el historial de conversaciones anteriores y permite continuar una.
- [ ] En móvil el widget no tapa ni es tapado por la barra de navegación inferior.
- [ ] Sin config de proveedor guardada, el widget muestra el mensaje de Chefchek pidiendo configuración con un link a Ajustes, no un error genérico.

## Risk Assessment

- **Riesgo**: el widget flotante global se solapa con otros elementos fijos ya existentes (campana de notificaciones, nav móvil). Mitigación: probar en las mismas pantallas donde vive la campana de notificaciones, reusando su z-index de referencia.
- **Riesgo**: latencia real de la llamada al LLM (varios segundos) sin streaming se siente lento. Aceptado como trade-off de la decisión v1 (sin streaming); documentar como mejora futura si el usuario lo pide tras probarlo.
