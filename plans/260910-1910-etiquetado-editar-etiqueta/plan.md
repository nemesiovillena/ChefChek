# Editar etiqueta APPCC (edición directa con límites)

## Estado: en curso

## Problema
El módulo solo permite crear + anular + reimprimir. El usuario se equivoca (refrigerado↔congelado,
fecha, cantidad) y no puede corregir sin anular y rehacer. Decisión del usuario: **edición directa
con límites**, con registro de auditoría (quién/cuándo/qué cambió) y recálculo del consumo preferente.

## Límites de edición (backend, obligatorios)
Editable solo si:
- `voidedAt === null`
- `reprintCount === 0` (solo existe la impresión original)
- `createdAt` cae en el día natural de hoy en Europe/Madrid

Si no → `409 Conflict` con mensaje que remite a «Anular» + nueva etiqueta.

## Campos editables (v1)
`preparedAt`, `storageCondition` + `storageTempMin/Max`, `freeze` + `frozenAt`,
`shelfLifeDays` / `shelfLifeFrozenDays` (override), `useByDate` (override explícito),
`manufacturerExpiryDate` (HANDLED), `quantity`, `quantityUnit`, `portions`, `notes`.

Fuera de v1 (usar anular+rehacer): `labelType`, `itemName`, `lotNumber`, `allergens`,
`ingredientLots`, `recipeId`/`productId`, `sourceLotId`.

## Recálculo
Reutiliza la lógica de `create()`: resolver conservación (base receta/artículo + overrides de la
etiqueta), `frozenUseByDate = frozenAt + shelfLifeFrozenDays` si congela, `useByDate` explícito >
congelado (si freeze) > vida útil normal. Extraer helper compartido `computeLabelDates()`.

## Auditoría
Nuevas columnas `FoodLabel`: `editedAt DateTime?`, `editedByUserId String?`, `editedByName String?`,
`editCount Int @default(0)`, `editLog Json?` (array `{ at, by, changes: { campo: { from, to } } }`).

## Fases
1. **Backend** — schema + migración; `computeLabelDates()` compartido; `UpdateFoodLabelDto`;
   `FoodLabelService.update()` con guardas + diff + editLog; `@Patch("labels/:id")`; tests.
2. **Frontend** — `useUpdateFoodLabel()` + tipos; panel de edición en `[id]/page.tsx` (fecha,
   ConservationFieldset + congelar, consumo preferente override, cantidad/raciones, notas);
   `canEdit` cliente; aviso «Editada … por …»; ofrecer reimprimir corregida tras guardar.
3. **Verificación** — jest etiquetado, tsc backend + frontend, prueba manual local.

## Aceptación
- Cambiar Refrigerado→Congelado en una etiqueta de hoy sin reimprimir recalcula el consumo
  preferente y lo refleja en el PDF.
- Etiqueta anulada / reimpresa / de ayer → botón Editar oculto y API responde 409.
- El detalle muestra quién y cuándo la editó por última vez.
