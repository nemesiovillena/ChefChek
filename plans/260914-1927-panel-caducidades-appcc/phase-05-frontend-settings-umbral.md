---
phase: 5
title: Frontend settings umbral
status: completed
priority: P3
dependencies:
  - 1
---

# Phase 5: Frontend — control de umbral en Settings

## Overview

Control numérico para `expiryWarningDays` en
`frontend/src/app/dashboard/settings/components/etiquetado-config-section.tsx`,
junto a los controles existentes de perfiles térmicos/formato por defecto.

## Requirements

- Funcional: input numérico (días), validación en cliente reflejando los
  límites del backend (`Min(1)`, `Max(30)`, fase 1).
- Funcional: guardar vía `useUpdateEtiquetadoConfig` (hook ya existente,
  `frontend/src/hooks/use-food-labels.ts`) — extender el payload de la
  mutation con `expiryWarningDays?: number`, mismo flujo que
  `thermalProfiles`/`defaultFormat` (botón "Guardar" único, no un guardado
  separado para este campo).
- No funcional: solo visible/editable por `ADMIN` (el backend ya lo exige en
  `PUT /config` — el frontend debe ocultar o deshabilitar el control para
  roles sin permiso, no solo confiar en el 403 del backend).

## Related Code Files

- Modify: `frontend/src/hooks/use-food-labels.ts` — `EtiquetadoConfig`
  interface: `expiryWarningDays: number;`. Payload de
  `useUpdateEtiquetadoConfig`: `expiryWarningDays?: number;`.
- Modify: `frontend/src/app/dashboard/settings/components/etiquetado-config-section.tsx`
  — nuevo campo de formulario junto a `defaultFormat` (línea ~36-110 es donde
  vive el resto del formulario de config).

## Implementation Steps

1. Extender tipos en el hook (fase 1 ya definió el contrato backend).
2. Añadir el input al formulario existente, con el mismo patrón de estado
   local + draft que ya usa `defaultFormatDraft` (línea ~40-45) — no un
   formulario/mutation separado.
3. Incluir el campo en el `updateConfig.mutateAsync({...})` existente
   (línea ~75-77).
4. Gate de rol `ADMIN` en el render del control (revisar cómo el resto de la
   página de Settings ya oculta/deshabilita secciones por rol, replicar ese
   patrón, no inventar uno nuevo).

## Success Criteria

- [ ] Campo visible en Settings → Etiquetado, con el valor actual precargado.
- [ ] Guardar persiste el valor (verificar recargando la página).
- [ ] Valor fuera de rango (0, 31) bloqueado en cliente antes de enviar.
- [ ] Usuario no-ADMIN no puede editarlo (oculto o disabled, coherente con el
      resto de esta página de Settings).
- [ ] `bun run build` frontend sin errores.

## Risk Assessment

- **Bajo riesgo** — es un campo más en un formulario ya existente, mismo
  flujo de guardado. Único cuidado: no crear un botón "Guardar" duplicado
  para este campo cuando ya existe uno para el resto de la sección.
