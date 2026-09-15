---
phase: 1
title: Backend umbral y calculo caducidad
status: completed
priority: P2
dependencies: []
---

# Phase 1: Backend umbral y cálculo de caducidad

## Overview

Añade el umbral de aviso configurable por tenant (`expiryWarningDays`) y expone
campos derivados de caducidad (`daysUntilExpiry`, `expiryStatus`) en las
respuestas de `FoodLabel`. Sin migración: `expiryWarningDays` se guarda en la
tabla genérica `Configuration` (mismo patrón que `thermalProfiles`/
`defaultFormat`, ver `etiquetado-config.service.ts:44-84`).

## Requirements

- Funcional: `GET /etiquetado/config` devuelve `expiryWarningDays` (default 5
  si no hay valor guardado — confirmado en validación). `PUT
  /etiquetado/config` acepta actualizarlo, rango `1-30` días (confirmado en
  validación), solo `ADMIN` (mismo guard que el resto del endpoint).
- Funcional: cada `FoodLabel` no anulado (`voidedAt === null`) expone
  `daysUntilExpiry` (entero, puede ser negativo) y `expiryStatus`
  (`'ok' | 'expiring_soon' | 'expired'`), calculados sobre
  `frozenUseByDate ?? useByDate` contra `now` y el `expiryWarningDays` del
  tenant. Labels anuladas: sin estos campos o `null` (no se muestran en
  paneles de caducidad).
- Funcional: `ListFoodLabelsDto` gana `expiringWithinDays?: number` (filtra
  `daysUntilExpiry <= N`, incluye ya caducadas) y `sortBy?: 'preparedAt' |
  'useByDate'` (default `preparedAt` como hoy, para no romper el listado
  existente de `/dashboard/etiquetado`).
- No funcional: reusar `EtiquetadoConfigService` para leer el umbral — no
  duplicar el acceso a `Configuration` en `FoodLabelService`.

## Architecture

`expiryStatus` es un campo **derivado**, no persistido: se calcula en el
mapeo de salida de `FoodLabelService` (donde ya se hace algo similar para
otros campos de salida), no en Prisma ni en el modelo. Esto evita datos
desincronizados si cambia el umbral del tenant — cada lectura recalcula con
el umbral vigente.

```
daysUntilExpiry = floor((effectiveExpiry - now) / 86400000)
  donde effectiveExpiry = frozenUseByDate ?? useByDate

expiryStatus =
  daysUntilExpiry < 0            → 'expired'
  daysUntilExpiry <= warningDays → 'expiring_soon'
  else                           → 'ok'
```

`expiringWithinDays` en el listado se traduce a un filtro Prisma sobre
`frozenUseByDate`/`useByDate` (no puede filtrar por el campo derivado
directamente en SQL — construir el `where` con `OR` sobre ambas columnas
comparando contra `now + N días`, análogo a cómo ya se combinan `from`/`to`
sobre `preparedAt` en el servicio actual).

## Related Code Files

- Modify: `backend/src/modules/etiquetado/services/etiquetado-config.service.ts`
  — añadir `EXPIRY_WARNING_DAYS_KEY`, `getExpiryWarningDays(tenantId)`,
  `setExpiryWarningDays(tenantId, days, userId)`, incluir en `getConfig()`.
  Default: `5` si no hay fila en `Configuration` (confirmado en validación).
- Modify: `backend/src/modules/etiquetado/dto/update-etiquetado-config.dto.ts`
  — `expiryWarningDays?: number` (`@IsInt`, `@Min(1)`, `@Max(30)`).
- Modify: `backend/src/modules/etiquetado/etiquetado.controller.ts`
  — `PUT /config`: incluir `expiryWarningDays` en el chequeo de "nada que
  actualizar" y en la llamada a `setExpiryWarningDays` cuando venga.
- Modify: `backend/src/modules/etiquetado/services/food-label.service.ts`
  — inyectar `EtiquetadoConfigService`; helper privado
  `computeExpiryFields(label, warningDays)`. **Verificado (fact-check):** no
  existe un mapeo de salida compartido — `list()` (línea 245) devuelve `data`
  (array crudo de Prisma) + paginación; `getById()` (línea 291, no
  `findOne()`), `create()` (línea 53) y `update()` (línea 337) devuelven el
  objeto `FoodLabel` de Prisma directamente sin transformar. Añadir el
  `.map()`/spread explícito en los 4 puntos de retorno (no hay gancho
  existente que reutilizar). `list()` también fija `orderBy: { preparedAt:
  "desc" }` fijo (línea 275) y ya excluye anuladas por defecto vía
  `...(query.includeVoided ? {} : { voidedAt: null })` (línea 268) — no hace
  falta tocar la exclusión de anuladas, solo añadir `sortBy` al `orderBy` y
  `expiringWithinDays` al `where`.
- Modify: `backend/src/modules/etiquetado/dto/list-food-labels.dto.ts`
  — `expiringWithinDays?: number` (`@IsInt`, `@Min(0)`), `sortBy?: string`
  (`@IsIn(['preparedAt', 'useByDate'])`).
- Modify: `backend/src/modules/etiquetado/services/food-label.service.spec.ts`
  — tests de `computeExpiryFields` (ok/expiring_soon/expired, con y sin
  congelación) y del filtro `expiringWithinDays`.
- Check: `backend/src/modules/etiquetado/etiquetado.module.ts` — confirmar que
  `EtiquetadoConfigService` ya está en `providers` del mismo módulo que
  `FoodLabelService` (debería, ambos son del módulo `etiquetado`) — si no,
  añadirlo a los providers/imports del módulo (no exportar fuera del módulo,
  ver `app-module-duplicate-controller-registration` en memoria del proyecto
  sobre providers/exports duplicados).

## Implementation Steps

1. `etiquetado-config.service.ts`: añadir constante de key, getter/setter
   siguiendo el patrón exacto de `getThermalProfiles`/`setThermalProfiles`
   (parseo con try/catch, default si no hay fila o parseo falla). Incluir en
   `getConfig()`.
2. `update-etiquetado-config.dto.ts`: añadir el campo validado.
3. `etiquetado.controller.ts`: extender el `PUT /config` para aceptar el
   nuevo campo sin romper la actualización parcial existente
   (`thermalProfiles`/`defaultFormat` siguen siendo independientes).
4. `food-label.service.ts`: helper `computeExpiryFields` puro (fácil de
   testear sin mocks de Prisma) + wiring en los puntos de salida.
5. `list-food-labels.dto.ts` + servicio: añadir `expiringWithinDays` al
   `where` y `sortBy` al `orderBy` del `findMany`.
6. Tests unitarios del helper (casos borde: exactamente en el umbral, recién
   caducada, congelada con `frozenUseByDate` distinto de `useByDate`, sin
   `frozenAt`).
7. `bun run build` backend (modo `dist`, no watch) + `jest` para el módulo
   `etiquetado` (no `bun test`, ver memoria del proyecto).

## Success Criteria

- [ ] `GET /etiquetado/config` devuelve `expiryWarningDays` (5 por defecto en
      tenant nuevo).
- [ ] `PUT /etiquetado/config` con `expiryWarningDays` inválido (0, 31,
      string) → 400. Con valor válido → persiste y se refleja en la siguiente
      lectura.
- [ ] Un `FoodLabel` con `useByDate` = mañana y umbral 2 → `expiryStatus:
      'expiring_soon'`. Con `useByDate` = ayer → `'expired'`. Con `useByDate`
      = en 10 días → `'ok'`.
- [ ] Label congelada: el cálculo usa `frozenUseByDate`, no `useByDate`.
- [ ] Label anulada (`voidedAt` seteado): no rompe el cálculo (excluida o
      `null`, a decidir en implementación — pero nunca lanza excepción).
- [ ] `GET /etiquetado/labels?expiringWithinDays=2` devuelve solo labels con
      `daysUntilExpiry <= 2` (incluidas las ya caducadas).
- [ ] `bun run build` backend sin errores; `jest` del módulo `etiquetado` en
      verde.

## Risk Assessment

- **Zona horaria**: `now` debe calcularse en el servidor (UTC/Date nativo
  está bien aquí, a diferencia del cálculo de `nextRunAt` de compras que sí
  exige Europe/Madrid explícito — `useByDate` es una fecha, no un horario de
  cron). Verificar que no se compare contra `Date` del cliente.
- **Umbral 0**: si el usuario configura `expiryWarningDays: 0`, solo las ya
  caducadas cuentan como `expiring_soon`... en realidad con umbral 0 nada
  debería ser `expiring_soon` (solo `expired` para negativos) — confirmar que
  la fórmula no colisiona ambos estados en el límite exacto (`daysUntilExpiry
  === 0` → `expiring_soon`, no `expired`; `expired` es estrictamente `< 0`).
