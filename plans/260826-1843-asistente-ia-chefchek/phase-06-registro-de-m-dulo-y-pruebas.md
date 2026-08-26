---
phase: 6
title: Registro de módulo y pruebas
status: completed
priority: P2
dependencies:
  - 3
  - 5
---

# Phase 6: Registro de módulo y pruebas

## Overview

Registrar "Asistente IA" como módulo activable/desactivable por tenant (igual que el resto de funcionalidades), y cerrar el ciclo con pruebas de extremo a extremo y verificación manual en navegador.

## Requirements

- Funcional: el módulo se puede activar/desactivar por tenant desde la pantalla de gestión de módulos existente (superadmin/owner), igual que `compras`, `albaranes`, etc.
- Funcional: con el módulo desactivado, ni el widget ni la página `/dashboard/asistente` son accesibles (ni por navegación ni por URL directa).
- No-funcional: cobertura de test mínima en las piezas de mayor riesgo (aislamiento por tenant, loop de tools, config de API key) ya definida en fases 1-3; esta fase añade el smoke test de extremo a extremo y la verificación manual real en navegador.

## Architecture

Sigue el patrón ya existente descrito en memoria `modules-registry-per-tenant-activation`: `MODULE_REGISTRY` (backend) + `@RequireModule("asistente-ia")` en el controller + entrada equivalente en `nav-config.ts` (frontend) que oculta la navegación si el módulo está desactivado.

## Related Code Files

- Modify: `backend/src/modules/modules/constants/registry.ts` (nueva entrada `{ id: "asistente-ia", name: "Asistente IA", ... }`)
- Modify: `backend/src/modules/ai-assistant/ai-assistant.controller.ts` (añadir `@RequireModule("asistente-ia")`, de fase 3)
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (gatear la entrada de fase 5 por el mismo id de módulo)
- Modify: `backend/src/app.module.ts` (confirmar que `AiAssistantModule` y su controller quedan registrados — cierre de fase 3)
- Create: `backend/src/modules/ai-assistant/ai-assistant.e2e-smoke.spec.ts` (o ubicación equivalente a los smoke tests existentes del proyecto — confirmar convención mirando `backend/src` o carpeta de e2e si existe)
- Modify: `docs/system-architecture.md` (si existe y documenta módulos — añadir una entrada breve; solo si el archivo ya lista módulos existentes, no crear estructura nueva)

## Implementation Steps

1. Añadir la entrada del módulo a `MODULE_REGISTRY` con `defaultEnabled: true` (confirmado en validación, consistente con el resto de módulos del registro). El endpoint ya degrada con un mensaje propio de Chefchek pidiendo configurar el proveedor si `hasApiKey` es `false` (fase 3, paso 4), así que aparecer activado sin config aún no rompe nada, solo pide el paso siguiente.

<!-- Updated: Validation Session 1 - defaultEnabled true (no false) -->

2. Aplicar `@RequireModule("asistente-ia")` al controller de fase 3 (los 3 endpoints: ask, listar conversaciones, ver conversación).
3. En `nav-config.ts`, usar `moduleForPath` / el mecanismo ya existente (memoria: `dashboard-kpi-and-alerts-cards-were-dead-reconnected`, `nav-config-restructured-into-category-dropdowns`) para que `/dashboard/asistente` y el widget flotante desaparezcan si el módulo está desactivado — confirmar cómo el layout ya oculta/muestra elementos condicionados a `isEnabled()` (ver `dashboard/layout.tsx`, ya usa `useModules()`).
4. Smoke test de extremo a extremo (o verificación manual documentada si el proyecto no tiene infraestructura e2e para esto): activar el módulo, configurar un proveedor con key de test/mock, hacer las dos preguntas del usuario original, verificar respuestas coherentes.
5. Verificación manual en navegador (Chrome) — dev server propio del worktree, no el de `:3000` (memoria `dev-server-3000-runs-from-main-checkout`): activar módulo, configurar Settings, abrir widget, preguntar "¿quién me ha subido precios este mes?" y "¿qué producto se compró más la última semana?", confirmar que las respuestas citan datos reales del tenant de prueba y no inventan cifras.
6. Verificar aislamiento manualmente con dos tenants de prueba: preguntar lo mismo en ambos y confirmar que las respuestas no se cruzan.
7. Ejecutar suite completa backend (`bunx jest`) y typecheck frontend (`tsc --noEmit` o `bun run build`) antes de dar la fase por cerrada.

## Success Criteria

- [ ] Módulo "Asistente IA" aparece en la pantalla de gestión de módulos y se puede activar/desactivar por tenant.
- [ ] Con el módulo desactivado, `/dashboard/asistente` redirige (mismo comportamiento que otras rutas de módulo desactivado) y el widget no se monta.
- [ ] Las dos preguntas de ejemplo del usuario funcionan de extremo a extremo contra datos reales en el navegador.
- [ ] Verificado manualmente que dos tenants distintos no se cruzan datos.
- [ ] `bunx jest` (backend) en verde; frontend compila sin errores de tipos.

## Risk Assessment

- **Riesgo**: con `defaultEnabled: true`, todos los tenants ven el asistente activo desde el primer despliegue aunque no tengan proveedor configurado — puede leerse como "está roto" si el mensaje de "configura tu proveedor" no es claro. Mitigación: verificar en fase 6 (paso 5) que ese mensaje incluye un link directo a Ajustes, no solo texto.
- **Riesgo**: probar con API keys reales en tests automatizados filtra costes/secretos en CI. Mitigación: tests automatizados solo con adaptadores mockeados (ya cubierto en fase 3); la verificación con proveedor real queda como paso manual de esta fase, con una key de prueba del propio usuario, nunca committeada.
