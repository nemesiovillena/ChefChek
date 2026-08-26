---
phase: 4
title: Frontend config en Settings
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 4: Frontend config en Settings

## Overview

Nueva sección "Asistente IA" en `/dashboard/settings`, calcada del patrón de `smtp-config-section.tsx`, para elegir proveedor/modelo y guardar la API key.

## Requirements

- Funcional: selector de proveedor (OpenAI / Gemini / Anthropic), campo de modelo, campo de API key (tipo password, nunca precargado con el valor real — solo un placeholder si `hasApiKey`).
- Funcional: guardar con el campo de key vacío conserva la key ya guardada (igual que SMTP).
- No-funcional: mismo look & feel que el resto de secciones de Settings (M3, sin `confirm()` nativo — usar `useConfirm()` si hiciera falta confirmar algo, aunque aquí probablemente no aplica).

## Architecture

Reusa el patrón exacto de `use-smtp-config.ts` + `smtp-config-section.tsx`: un hook de React Query con `useQuery` (leer config pública) + dos `useMutation` (guardar, y opcionalmente "probar" con una pregunta de humo tipo "¿cuántos productos tengo?").

## Related Code Files

- Create: `frontend/src/hooks/use-ai-assistant-config.ts`
- Create: `frontend/src/app/dashboard/settings/components/ai-assistant-config-section.tsx`
- Modify: `frontend/src/app/dashboard/settings/page.tsx` (montar la nueva sección)
- Reference: `frontend/src/app/dashboard/settings/components/smtp-config-section.tsx`, `frontend/src/hooks/use-smtp-config.ts` (si existe con ese nombre — confirmar path exacto al implementar)

## Implementation Steps

1. Leer `use-smtp-config.ts` completo (hook de referencia) para replicar exactamente el patrón de query keys / invalidation usado en el proyecto.
2. `use-ai-assistant-config.ts`: `useAiAssistantConfig()` (GET), `useSaveAiAssistantConfig()` (PUT con invalidation de la query anterior).
3. `AiAssistantConfigSection`: formulario con `provider` (select: OpenAI/Gemini/Anthropic), `model` (input texto libre con placeholder sugerido según proveedor elegido, p.ej. `gpt-4o-mini` / `gemini-2.0-flash` / `claude-3-5-haiku-latest`), `apiKey` (password, vacío al editar, con hint "déjalo en blanco para conservar la key guardada" si `hasApiKey`).
4. Notificación de éxito/error con `useNotification()` (mismo patrón que SMTP), nunca `alert()`.
5. Montar `<AiAssistantConfigSection />` en `settings/page.tsx` junto a las secciones existentes.

## Success Criteria

- [ ] Se puede elegir proveedor+modelo, guardar la API key, y tras recargar la página se ve `hasApiKey: true` sin exponer la key real en el DOM/network tab.
- [ ] Guardar dejando el campo de key vacío conserva la key anterior (verificado preguntando algo al asistente después, en fase 5/6).
- [ ] Sin errores de consola ni de build (`bun run build` en frontend, o al menos `tsc --noEmit`).

## Risk Assessment

- **Riesgo**: precargar por error la key real en el input al editar (fuga por DOM/devtools). Mitigación: el estado de edición siempre arranca con `apiKey: ''`, igual que `startEditing()` en `smtp-config-section.tsx`.
