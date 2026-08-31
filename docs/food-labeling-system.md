# Sistema de Etiquetado de Alimentos

Módulo `etiquetado` — emisión e histórico re-imprimible de etiquetas de cocina
con trazabilidad, para platos elaborados y artículos comprados manipulados.

## Alcance

- **Plato elaborado** (`ELABORATED`): se etiqueta desde una receta. Lote de
  producción autogenerado, consumo preferente calculado, alérgenos de la receta,
  y los lotes de los ingredientes directos elegidos a mano al etiquetar.
- **Artículo manipulado** (`HANDLED`): se etiqueta desde un artículo cuando se
  abre/reenvasa para conservar. Lote del proveedor (del albarán, modelo `Lot`),
  caducidad original del fabricante, fecha de manipulación, consumo preferente
  secundario calculado.

Cada etiqueta se persiste (`FoodLabel`) como registro consultable. Anular =
`voidedAt` (soft), nunca borrado físico. Re-imprimible (`reprintCount`).

## Gating

- Módulo: `etiquetado` en `MODULE_REGISTRY`, `defaultEnabled: false` (opt-in por
  tenant).
- Rol: secciones `etiquetado` (ver) y `etiquetado.emit` (crear / anular /
  imprimir) en `SECTION_REGISTRY`.

## Modelo de datos (aditivo)

### `FoodLabel` (`food_labels`)

Campos snapshot (`itemName`, `allergens`, `createdByName`, `storage*`,
`shelfLifeDaysApplied`) preservan el estado en el momento de emisión y
sobreviven al borrado/renombrado de la receta o el artículo de origen.

| Campo | Notas |
|---|---|
| `labelType` | `ELABORATED` \| `HANDLED` |
| `recipeId` / `productId` | FK `onDelete: SetNull` según tipo |
| `lotNumber` | generado (ELABORATED) o del proveedor / texto libre (HANDLED). `@@unique([tenantId, lotNumber])` |
| `sourceLotId` | FK `Lot` (HANDLED) |
| `productionOrderId` | vínculo opcional (sin UI en v1) |
| `preparedAt` | elaboración o manipulación/reenvasado |
| `manufacturerExpiryDate` | caducidad de fábrica (HANDLED) |
| `useByDate` | consumo preferente calculado |
| `frozenAt` / `frozenUseByDate` | si se congela |
| `storageCondition` | `REFRIGERATED` \| `FROZEN` \| `AMBIENT` |
| `storageTempMin/Max` | °C |
| `allergens` | `Int[]` snapshot de códigos UE |
| `createdByName` | nombre completo (solo se expone en el detalle autenticado) |
| `qrToken` | `cuid()` opaco → credencial de la ficha pública |
| `voidedAt` / `voidReason` | anulación soft |

### `FoodLabelIngredientLot` (`food_label_ingredient_lots`)

Trazabilidad hacia atrás de una etiqueta `ELABORATED`: un registro por
ingrediente directo, con `lotId` (FK `Lot`, opcional) + `lotNumber` snapshot.
`""` / "sin especificar" permitido. Las sub-recetas **no** se desglosan en v1.

### Columnas de conservación en `Recipe` y `Product`

Nullable, editables en el modal de cada entidad; son los valores por defecto al
emitir una etiqueta (ajustables en cada etiqueta):

- `Recipe`: `shelfLifeDays` (tras elaboración), `shelfLifeFrozenDays`,
  `storageCondition`, `storageTempMin/Max`.
- `Product`: `secondaryShelfLifeDays` (tras apertura/manipulación),
  `shelfLifeFrozenDays`, `storageCondition`, `storageTempMin/Max`.

## Número de lote (plato elaborado)

Formato `PREFIJO-DDMMAA-NN`:

- `PREFIJO`: 3–4 letras del nombre de la receta, mayúsculas, sin acentos
  (`deriveLotPrefix`); fallback `ETIQ`.
- `DDMMAA`: fecha (día-mes-año) en zona `Europe/Madrid`.
- `NN`: secuencia diaria por tenant, calculada con `MAX(...)` por SQL crudo (no
  `findFirst`, para no tropezar con anulaciones), con reintento ante colisión de
  `@@unique`.

Ej. `JARR-310826-01`.

## Cálculo de fechas

- `useByDate` = `preparedAt` + días de vida útil efectivos (override en la
  etiqueta > config de la entidad). Se fija a fin del día local (23:59). Si no
  hay días definidos ni fecha explícita → error de validación.
- `frozenUseByDate` = `frozenAt` + `shelfLifeFrozenDays`, solo si se marca
  "se congela".

## API (`/api/v1/etiquetado`)

Autenticado (`AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard` +
`@RequireModule("etiquetado")`):

| Método | Ruta | Sección |
|---|---|---|
| `POST` | `/labels` | `etiquetado.emit` |
| `GET` | `/labels` | `etiquetado` — paginado, filtros `labelType`, `lotNumber`, rango `preparedAt`, `includeVoided` |
| `GET` | `/labels/:id` | `etiquetado` |
| `GET` | `/labels/:id/pdf?format=&copies=&reprint=1` | `etiquetado.emit` |
| `POST` | `/labels/:id/void` | `etiquetado.emit` |
| `GET` | `/prep-context?recipeId=` \| `?productId=` | `etiquetado.emit` |

Público (sin guards, rate-limit propio 20/min):

| `GET` | `/api/v1/etiquetado/public/trace/:qrToken` | — |

La respuesta pública devuelve la ficha completa **salvo el nombre del
responsable**, que sale como iniciales (`responsibleInitials`).

## PDF

`FoodLabelPdfService` (pdfkit). Presets (`label-presets.ts`):

| Formato | Uso |
|---|---|
| `thermal-57x40` | térmica, preset principal |
| `thermal-57x32` | térmica compacto (sin lista de ingredientes) |
| `a4-70x37` | A4 rejilla 3×8 (24/hoja, tipo Apli) |
| `a4-63x38` | A4 rejilla 3×7 (21/hoja) |

El QR codifica `${APP_URL}/e/${qrToken}`. Márgenes de las rejillas A4 en
constantes, ajustables con un PDF real sin tocar la lógica de render.

## Frontend

- `/dashboard/etiquetado` — listado + histórico.
- `/dashboard/etiquetado/nueva` — alta (wizard 2 pasos). Acepta `?recipeId=` /
  `?productId=` para preseleccionar desde la ficha de Receta / Artículo.
- `/dashboard/etiquetado/[id]` — detalle interno (nombre completo del
  responsable, reimprimir, anular).
- `/e/[qrToken]` — **ficha pública** (Server Component, fuera de `/dashboard`,
  sin login). Es lo que abre el QR.
- Botón "Etiquetar" en la fila de Recetas y en el pie del modal de Artículo,
  gateado por `isEnabled('etiquetado') && canSee('etiquetado.emit')`.

## Fuera de v1

- Consumo/decremento real de stock por lote al etiquetar (sigue en
  Producción/Almacenes).
- Integración con partes de cumplimiento APPCC.
- Tool del asistente IA para consultar etiquetas.
- Desglose de lotes en sub-recetas.
- Picker de Orden de Producción (solo la columna `productionOrderId`).
- Plantillas de etiqueta personalizables (layout fijo).

## Preguntas abiertas

- Medidas exactas de la etiquetadora térmica del usuario y stock A4 concreto →
  afinar `LABEL_PRESETS`.
