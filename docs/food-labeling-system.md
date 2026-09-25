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
| `qrToken` | UUID v4 (`@default(uuid())`) → credencial de la ficha pública |
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

- `useByDate` = día natural en `Europe/Madrid` de (`preparedAt` + días de vida
  útil efectivos), donde efectivos = override en la etiqueta > config de la
  entidad. Se materializa como mediodía UTC de ese día (la etiqueta solo imprime
  la fecha, sin hora; independiente de la zona del servidor). Si no hay días
  definidos ni fecha explícita → error de validación.
- `frozenUseByDate` = `frozenAt` + `shelfLifeFrozenDays`, solo si se marca
  "se congela".

## API (`/api/v1/etiquetado`)

Autenticado (`AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard` +
`@RequireModule("etiquetado")`):

| Método | Ruta | Sección |
|---|---|---|
| `POST` | `/labels` | `etiquetado.emit` |
| `GET` | `/labels` | `etiquetado` — paginado, filtros `labelType`, `lotNumber`, `expiringWithinDays`, rango `preparedAt`, `includeVoided`, `sortBy: 'preparedAt'\|'useByDate'` |
| `GET` | `/labels/:id` | `etiquetado` |
| `GET` | `/labels/:id/pdf?format=&copies=&reprint=1` | `etiquetado.emit` |
| `POST` | `/labels/:id/void` | `etiquetado.emit` + rol ≥ USER |
| `GET` | `/prep-context?recipeId=` \| `?productId=` | `etiquetado.emit` |
| `GET` | `/config` | `etiquetado` |
| `PUT` | `/config` | rol `ADMIN` |

Campos derivados en cada `FoodLabel` (GET `/labels`, GET `/labels/:id`, POST/PUT `/labels`):
- `daysUntilExpiry: number` — días restantes hasta caducidad (negativo si ya caducó)
- `expiryStatus: 'ok' | 'expiring_soon' | 'expired'` — estado basado en `expiryWarningDays` del tenant

Config (`/config`): ahora incluye `expiryWarningDays` (1–30 días, default 5), umbral configurable por admin para alertas de caducidad.

`POST /labels` y `POST /labels/:id/void` exigen además rol ≥ USER
(`@Roles("ADMIN","USER")`) — VIEWER es solo lectura.

Público (sin guards, rate-limit propio 20/min):

| `GET` | `/api/v1/etiquetado/public/trace/:qrToken` | — |

La respuesta pública devuelve la ficha completa **salvo el nombre del
responsable**, que sale como iniciales (`responsibleInitials`).

## Salida de impresión: PDF (A4) + ZPL (térmica Zebra)

Dos generadores independientes, con las reglas de negocio de cada campo
(fechas, LOTE, alérgenos, congelado, HANDLED...) compartidas en
`util/food-label-print-format.util.ts` para que no diverjan:

- **`FoodLabelPdfService`** (pdfkit) — solo hojas **A4**. Presets estándar
  built-in **no configurables** (`a4-70x37` = Apli 3×8, `a4-63x38` = Apli
  3×7). Márgenes/gutters en `label-presets.ts`, ajustables con un PDF real sin
  tocar la lógica de render. `GET /labels/:id/pdf?format=a4-70x37|a4-63x38`.
- **`FoodLabelZplService`** — etiquetas **térmicas** (Zebra ZD220D por USB +
  Zebra Browser Print). Genera ZPL puro (texto), sin dependencias de
  hardware; el envío a la impresora lo hace el frontend. Medidas + DPI del
  perfil del tenant, configurables en Ajustes → Etiquetas (`GET/PUT
  /api/v1/etiquetado/config`, PUT solo `ADMIN`, guardado en `Configuration`
  con key `ETIQUETADO_THERMAL_PROFILES`). Cada perfil: `{ id, name, widthMm,
  heightMm, dpi }` (mm 20–200, dpi 100–600; dpi por defecto 203 = Zebra
  ZD220D). Todos los tenants tienen 2 perfiles por defecto: «Principal» 60×40 y
  «Compacto» 57×32 (los nuevos los reciben en lectura; los que ya tenían
  perfiles guardados, por migración aditiva). El formato por defecto se elige
  en Ajustes → Etiquetas (una impresora, un rollo cargado: se cambia al
  cambiar de rollo). Layout derivado de la geometría, no del id del perfil
  (`util/food-label-zpl-layout.util.ts`): alto ≥ 36 mm = estándar (QR arriba a
  la derecha, texto más estrecho a su lado; también 57×51 y cualquier perfil
  propio ≥ 36 mm, con más líneas de ingredientes cuanto más alto); alto < 36 mm = compacto (**sin
  QR**, texto a todo el ancho y tipografía apretada; los ingredientes ocupan
  el hueco libre: nº de líneas = las que quepan sobre la línea «Resp.»). Ajuste de texto vía
  `^FB` nativo de ZPL (recorta sin "…" si no cabe, sin medir texto como
  pdfkit — decisión deliberada, ver plan). Negrita en LOTE/Consumir/Alérgenos/
  nombre vía "doble impresión" desplazada 1 dot (la fuente escalable 0 de
  Zebra no tiene variante bold real). Copias vía `^PQ<n>`, no repitiendo el
  bloque de etiqueta. `GET /labels/:id/zpl?format=thermal:<profileId>`.

El `format` que llega a `/pdf` debe ser un preset A4 (`resolveSpec` rechaza
cualquier otro valor); el que llega a `/zpl` es `thermal:<profileId>`
(`resolveThermalProfile`, cae al primer perfil si el id no existe).

### Preparar impresora (uso diario sin calibrar a mano)

De fábrica la Zebra NO recalibra al arrancar: tras apagar el PC/impresora el
perfil de sensor queda desfasado y las etiquetas salen descuadradas desde la
primera (en lotes con `^PQ` el error se acumula y el texto de una etiqueta
invade la siguiente). Ajustes → Etiquetas → «Preparar impresora» (una sola
vez, idempotente) hace dos cosas por USB vía Browser Print
(`zebra-printer-setup.ts`): sondea el SGD `media.power_up_action` y, si el
firmware lo admite, lo fija a `calibrate` — cada encendido re-mide el rollo
solo — y además envía `^XA^MNY^JUS^XZ` (media troquelada por hueco + config
guardada de forma persistente). Si el firmware no soporta SGD, queda solo el
guardado de config y la calibración manual con FEED (instrucciones en la
misma pantalla). La calibración remota `~JC` se probó y dejó una ZD220d en
error: no se envía nunca desde la app.

El QR codifica `${APP_URL}/e/${qrToken}` (dinámico por etiqueta) en A4 y en
térmica estándar; la térmica compacta (57×32) no lleva QR.

## Frontend

- `/dashboard/etiquetado` — listado + histórico de emisión.
- `/dashboard/etiquetado/nueva` — alta (wizard 2 pasos). Acepta `?recipeId=` /
  `?productId=` para preseleccionar desde la ficha de Receta / Artículo.
- `/dashboard/etiquetado/[id]` — detalle interno (nombre completo del
  responsable, reimprimir, anular).
- `/dashboard/appcc/caducidades` — panel de gestión de caducidades (listado de
  etiquetas ELABORATED + HANDLED con alerta visual por proximidad a vencimiento).
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
- Configuración de rejilla A4 por el usuario (los stocks A4 son estándar; solo la
  térmica es configurable).

## Preguntas abiertas

- Ninguna pendiente de producto. Afinado fino de márgenes A4 con un PDF real de
  la impresora del usuario si hiciera falta.
