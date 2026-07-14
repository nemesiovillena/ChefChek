# PDR - Módulo Compras (gestión centralizada de compras y pedidos a proveedores)

**Fecha**: 2026-07-14
**Estado**: Aprobado (decisiones de producto confirmadas 2026-07-14)
**Prioridad**: Alta
**Estimación**: ~100-115 horas (13-15 días) repartidas en 8 sprints
**Plan de sprints**: `plans/260714-1357-modulo-compras/`

---

## Contexto

ChefChek gestiona hoy artículos, proveedores, albaranes (con OCR/IA), recetas y escandallos, pero **no existe el ciclo de pedido de compra**: el flujo empieza en el albarán (recepción) sin registro previo de qué se pidió, a quién, cuándo ni a qué precio pactado. Se necesita un módulo **Compras** que centralice pedidos, envío al proveedor por su canal preferido, conciliación con albaranes/facturas, control de precios pactados, catálogos de proveedor con IA, programación de pedidos y analítica de compras.

**Estado actual (infraestructura reutilizable)**:
- ✅ `Supplier` con `email/phone/whatsapp`, `orderMethods` (EMAIL/PHONE/WEB/WHATSAPP), CRUD completo en `/api/v1/products/suppliers*`
- ✅ `ProductSupplierOffer`: ofertas multi-proveedor por artículo con oferta preferida (base de comparativas)
- ✅ `Stock.minimumStock/maximumStock/reorderLevel` + UI en pestaña Proveedor/Stock (mín/máx "ya implementado")
- ✅ Pipeline albaranes con OCR/IA (`backend/ocr-microservice/`, multi-proveedor OpenAI/Gemini/Anthropic/OpenRouter) y actualización de precios/stock al confirmar
- ✅ `ProductPriceHistory` + `SupplierPriceHistory` + gráficas recharts
- ✅ Sistema de módulos por tenant: `MODULE_REGISTRY` + `@RequireModule` + toggle superadmin (genérico, sin migración)
- ❌ Sin modelo real de pedido de compra (el módulo `orders` existente es un prototipo roto: su servicio referencia modelos Prisma inexistentes)
- ❌ Sin scheduler (`@nestjs/schedule` no instalado), email = stub que solo loguea, sin integración WhatsApp
- ❌ `Invoice` = stub plano sin líneas ni módulo
- ❌ Sin entidad "local" (multi-local)

**Localización actual relevante**:
- Backend: `backend/src/modules/albaranes/`, `backend/src/modules/products/` (suppliers), `backend/src/modules/modules/constants/registry.ts`
- Frontend: `frontend/src/app/dashboard/albaranes/`, `frontend/src/app/dashboard/articulos/`, `frontend/src/features/modules/lib/nav-config.ts`

---

## Decisiones de producto (confirmadas por el usuario, 2026-07-14)

1. **Módulo nuevo `compras`**; el prototipo `orders` ("Pedidos") se retira de registro/nav/app.module. Tablas stub se conservan (cero pérdida de datos).
2. **Envío MVP**: WhatsApp vía deep-link `wa.me` con mensaje pre-redactado; email real vía SMTP configurable por tenant (nodemailer); teléfono vía `tel:` + registro manual del envío; PDF del pedido descargable/adjuntable.
3. **Pedidos programados = borrador + notificación**: el scheduler genera el pedido sugerido (según mín/máx) y notifica; una persona revisa y envía. Sin auto-envío desatendido.
4. **Multi-local: nueva entidad `Location`** bajo el tenant (grupos con varios locales). Cambio aditivo: `locationId` opcional en entidades de compras y almacenes; local por defecto autocreado por tenant. Usuarios/permisos por local quedan fuera de alcance.

---

## Objetivos

1. Centralizar todo el ciclo de compra: checklist → pedido → envío → recepción (albarán) → factura, con trazabilidad completa y en tiempo real desde cualquier dispositivo.
2. Enviar pedidos al proveedor por su canal preferido (WhatsApp/email/teléfono) sin salir de la app.
3. Detectar automáticamente desviaciones sobre precios pactados y notificar al instante.
4. Subir catálogos/tarifas de proveedor y, mediante IA, proponer el mejor precio por artículo (comparativa entre proveedores), activable por local.
5. Programar pedidos recurrentes por proveedor y día (generación automática de borradores).
6. Analítica de compras: top-20 de gasto, compras por proveedor, desviaciones de precio, comparativas.
7. Módulo activable/desactivable por tenant desde el panel superadmin, como los demás.

---

## Especificación

### F1. Panel central de compras

**Mostrar**: página `dashboard/compras` con vistas Pedidos / Listas / Programaciones / Catálogos / Precios pactados / Analítica; listado de pedidos con estado, proveedor, local, importe, fecha, canal de envío.
**Comportamiento**: filtros por estado/proveedor/local/fechas; paginación server-side (patrón artículos); acceso rápido al albarán/factura vinculados.
**Backend**: `GET/POST /v1/compras/pedidos`, `GET/PATCH/DELETE /v1/compras/pedidos/:id`, `PATCH /v1/compras/pedidos/:id/estado`. Máquina de estados `BORRADOR→PENDIENTE_ENVIO→ENVIADO→RECIBIDO_PARCIAL→RECIBIDO→CANCELADO` (patrón `albaran-status.service.ts`). Numeración `PED-N` con `$queryRaw MAX` (gotcha soft-delete en secuencias).
**Frontend**: `frontend/src/app/dashboard/compras/` + hooks `use-purchase-orders.ts` sobre `useCrud`; `useConfirm()` en acciones destructivas; tabs con `role="tablist"`.

### F2. Checklist de artículos por proveedor (listas de compra)

**Mostrar**: listas nombradas (p. ej. "Pedido semanal pescado") por proveedor y opcionalmente por local, con artículos marcables tipo checklist y cantidades.
**Comportamiento**: crear pedido desde lista en 1 clic; cantidades sugeridas según `Stock` (si `quantity < minimumStock` → sugerir hasta `maximumStock`); recuerda última cantidad pedida.
**Backend**: `PurchaseList` + `PurchaseListItem`; CRUD `/v1/compras/listas`; endpoint `POST /v1/compras/listas/:id/generar-pedido` que calcula sugerencias desde `Stock.minimumStock/maximumStock/reorderLevel`.
**Frontend**: vista checklist con selección múltiple, inputs de cantidad, botón "Generar pedido".

### F3. Envío del pedido por canal del proveedor

**Mostrar**: diálogo "Enviar pedido" que ofrece los canales de `Supplier.orderMethods`: WhatsApp (wa.me), Email (SMTP), Teléfono (tel:), Web (registro manual).
**Comportamiento**:
- WhatsApp: abre `wa.me/<whatsapp>?text=<pedido>` con el pedido pre-redactado; al volver, el usuario confirma "Marcado como enviado".
- Email: envío real con PDF adjunto vía SMTP del tenant; marca ENVIADO automáticamente si el SMTP acepta.
- Teléfono: enlace `tel:` + botón "Pedido comunicado" (registro manual).
- Todo envío/cambio de estado escribe `PurchaseOrderEvent` (auditoría: quién, cuándo, canal).
**Backend**: nuevo módulo `backend/src/modules/mail/` (nodemailer; config SMTP por tenant en `Configuration`, category `SMTP`, password cifrado); `POST /v1/compras/pedidos/:id/enviar` (canal + resultado); `GET /v1/compras/pedidos/:id/pdf` (generación PDF, patrón fichas técnicas).
**Frontend**: diálogo de envío, vista previa del mensaje/PDF, timeline de eventos del pedido.

### F4. Recepción y conciliación con albaranes y facturas

**Mostrar**: en el detalle del pedido, albarán vinculado y diferencias línea a línea (pedido vs recibido: cantidades y precios); factura asociada (registro mínimo).
**Comportamiento**: al subir/confirmar un albarán se puede vincular a un pedido ENVIADO del mismo proveedor (sugerencia automática por proveedor+fechas); las líneas se concilian por producto; discrepancias marcadas visualmente; el pedido pasa a RECIBIDO_PARCIAL/RECIBIDO.
**Backend**: `Albaran.purchaseOrderId?` (FK opcional, aditivo); servicio de conciliación en módulo compras; `Invoice` mínimo enlazado a albarán/pedido (número, importe, fecha, archivo opcional) — SIN módulo completo de facturación (ampliación futura).
**Frontend**: selector de pedido en flujo de albarán; tabla de discrepancias en detalle de pedido.

### F5. Control de precios pactados

**Mostrar**: por oferta producto-proveedor, precio pactado (`agreedPrice`, vigencia opcional); panel "Desviaciones" con artículos cuyo último precio recibido supera el pactado.
**Comportamiento**: al confirmar albarán o importar catálogo, si `precio > agreedPrice` (tolerancia % configurable, default 0) → notificación instantánea (reutiliza `notifyPriceChange`/`Alert`) + entrada en panel de desviaciones con enlace a reclamación (nota).
**Backend**: campos `agreedPrice/agreedAt/agreedUntil` sobre `ProductSupplierOffer` (KISS: sin tabla nueva salvo que la vigencia histórica lo exija); hook de detección en `albaran-stock.service.ts` y en aplicación de catálogos; `GET /v1/compras/desviaciones`.
**Frontend**: edición de precio pactado en ficha de oferta; panel de desviaciones con estado (pendiente/reclamada/resuelta).

### F6. Catálogo digital y subida de tarifas con IA

**Mostrar**: por proveedor, catálogo de ofertas (productos + precios + formato); pantalla de importación de tarifa (PDF/imagen/Excel) con propuestas extraídas por IA para revisar.
**Comportamiento**: subir archivo → microservicio OCR/IA extrae líneas (producto, formato, precio) → matching contra artículos existentes (patrón `line-matching.service.ts`) → el usuario revisa/corrige → aplicar crea/actualiza `ProductSupplierOffer` y escribe `ProductPriceHistory`. **Nunca** se aplican precios sin revisión humana.
**Backend**: `CatalogImport` + `CatalogImportLine` (estado de propuesta); `POST /v1/compras/catalogos/import` (reutiliza `python-ocr.service.ts` + `ai_extraction_service.py` con prompt nuevo de tarifas; API key viaja por request desde localStorage como en albaranes); `POST /v1/compras/catalogos/import/:id/aplicar`.
**Frontend**: uploader (patrón subir albarán), tabla de revisión con matching y diffs de precio, comparativa "mejor precio" por artículo entre proveedores.

### F7. Comparación de proveedores y activación por local

**Mostrar**: por artículo, todas las ofertas de proveedores con mejor precio destacado; toggle activar/desactivar oferta por local.
**Comportamiento**: activar una oferta puntual en un local hace que las sugerencias de pedido de ese local usen ese proveedor/precio sin tocar nada más; desactivarla vuelve a la preferida.
**Backend**: `OfferLocationSetting` (locationId + offerId + enabled); la resolución de "oferta activa para local X" cae en un helper compartido del módulo compras; `GET /v1/compras/comparativa?productId=`.
**Frontend**: vista comparativa con badges de mejor precio (reutiliza patrones de badges de tendencia), toggles por local.

### F8. Programación inteligente de pedidos

**Mostrar**: programaciones por proveedor: lista base, local, días de la semana y hora; próxima ejecución visible.
**Comportamiento**: al llegar el momento, el scheduler genera un pedido BORRADOR con cantidades sugeridas (mín/máx) y notifica al equipo (Alert + toast); una persona revisa y envía (decisión: sin auto-envío).
**Backend**: `@nestjs/schedule` (nueva dependencia); `PurchaseSchedule` (supplierId, listId, locationId?, daysOfWeek, hora, enabled, lastRunAt); cron cada 5 min que ejecuta programaciones vencidas de forma idempotente; CRUD `/v1/compras/programaciones`.
**Frontend**: CRUD de programaciones con selector de días/hora y toggle.

### F9. Analítica avanzada de compras

**Mostrar**: panel con: **Top-20** artículos por gasto (con % acumulado 80/20), compras por proveedor (importe/nº pedidos/plazo medio), desviaciones de precio en el tiempo, comparativa entre proveedores por artículo; filtros por rango de fechas y local.
**Comportamiento**: datos en tiempo real desde pedidos RECIBIDOS + albaranes confirmados; exportable.
**Backend**: `purchase-analytics.service.ts` con SQL raw parametrizado (allowlist de orden, `deletedAt IS NULL` manual — gotchas conocidos) sobre `PurchaseOrderLine`, `AlbaranLine`, `ProductPriceHistory`; endpoints `GET /v1/compras/analitica/top-gasto`, `/por-proveedor`, `/desviaciones`, `/comparativa`.
**Frontend**: gráficas recharts (patrón `product-price-history-chart.tsx`) + tablas.

### F10. Multi-local (`Location`)

**Mostrar**: gestión de locales en configuración (nombre, dirección, activo); selector de local en listas, pedidos, programaciones, comparativas y analítica.
**Comportamiento**: cada tenant arranca con un local por defecto (backfill); todo lo existente sigue funcionando sin seleccionar local (`locationId` nullable en todas partes).
**Backend**: modelo `Location` (tenant-scoped, soft-delete); `Warehouse.locationId?` opcional; CRUD `/v1/compras/locales` (o `/v1/locations` si se prevé uso transversal — decidir en sprint 0).
**Frontend**: página/sección de locales, selector persistente de local activo en el panel de compras.

### F11. Activación del módulo (superadmin)

**Mostrar**: "Compras" aparece en el gestor de módulos del superadmin y se activa/desactiva por tenant como los demás.
**Comportamiento**: desactivado → nav oculto, rutas bloqueadas (redirect), backend 403.
**Backend**: entrada `{ id: "compras", name: "Compras", ... }` en `MODULE_REGISTRY`; `@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)` + `@RequireModule("compras")` en el controller (importar `AuthModule` — gotcha conocido). Retirar `orders` del registry/nav/app.module.
**Frontend**: `NavItem` con `moduleId: 'compras'` + entrada en `ROUTE_MODULE_MAP` en `nav-config.ts`. El toggle superadmin es genérico: sin cambios.

---

## Arquitectura Técnica

### Modelo de datos nuevo (Prisma — todo tenant-scoped, `deletedAt` soft-delete, migraciones aditivas y reversibles)

| Modelo | Propósito | Campos clave |
|--------|-----------|--------------|
| `Location` | Local del grupo | name, address?, isDefault, tenantId |
| `PurchaseList` / `PurchaseListItem` | Checklist por proveedor | supplierId, locationId?, name / productId, defaultQuantity |
| `PurchaseOrder` / `PurchaseOrderLine` | Pedido real | orderNumber (PED-N), supplierId, locationId?, status, sentAt/sentVia/sentBy, totales / productId, quantity, expectedPrice, receivedQuantity?, receivedPrice? |
| `PurchaseOrderEvent` | Auditoría | orderId, type, channel?, userId, payload Json |
| `PurchaseSchedule` | Programaciones | supplierId, listId, locationId?, daysOfWeek, timeOfDay, enabled, lastRunAt |
| `CatalogImport` / `CatalogImportLine` | Importación tarifas IA | supplierId, fileUrl, status / extracted Json, matchedProductId?, proposedPrice, lineStatus |
| `OfferLocationSetting` | Oferta activa por local | offerId, locationId, enabled |
| (campos) `ProductSupplierOffer.agreedPrice/agreedAt/agreedUntil` | Precio pactado | — |
| (campo) `Albaran.purchaseOrderId?` | Conciliación | FK opcional |
| (campo) `Warehouse.locationId?` | Local del almacén | FK opcional |

### Backend

```
backend/src/modules/compras/
├── compras.module.ts            (importa AuthModule; registra servicios)
├── compras.controller.ts        (@Controller("api/v1/compras"), guards + @RequireModule("compras"))
├── dto/
└── services/
    ├── purchase-order.service.ts        (+ purchase-order-status / purchase-order-number)
    ├── purchase-list.service.ts
    ├── order-sending.service.ts         (wa.me payload, SMTP, PDF, eventos)
    ├── order-reconciliation.service.ts  (pedido↔albarán)
    ├── price-agreement.service.ts       (pactados + desviaciones)
    ├── catalog-import.service.ts        (OCR/IA + matching + aplicar)
    ├── purchase-schedule.service.ts     (cron @nestjs/schedule)
    ├── purchase-analytics.service.ts    (SQL raw agregado)
    └── locations.service.ts
backend/src/modules/mail/                 (nodemailer, SMTP por tenant en Configuration)
```
Cada servicio con su `.spec.ts` (convención del repo). Swagger en todos los endpoints.

### Frontend

```
frontend/src/app/dashboard/compras/
├── page.tsx                     (panel: tabs Pedidos/Listas/Programaciones/Catálogos/Precios/Analítica)
├── pedidos/[id]/page.tsx        (detalle: líneas, timeline eventos, conciliación)
└── components/                  (send-order-dialog, purchase-list-checklist, catalog-import-review,
                                  price-deviation-panel, supplier-comparison-table, location-selector, ...)
frontend/src/hooks/use-purchase-orders.ts, use-purchase-lists.ts, use-purchase-schedules.ts,
                   use-catalog-imports.ts, use-locations.ts, use-purchase-analytics.ts
```
Tokens M3 (`var(--...)`, sin `dark:`; `text-primary-foreground`, no `text-on-primary`); tabs con `role="tablist"` (no `<nav>`); pickers de producto con `useProductSearch` (server-side).

---

## Dependencies Check

**Backend**:
- ✅ Prisma, guards (Auth/Tenant/Roles/Module), soft-delete middleware, `Configuration`
- ✅ Microservicio OCR/IA (`ai_extraction_service.py`) — necesita prompt nuevo de tarifas
- ✅ Generación PDF existente (fichas técnicas) como patrón
- ❓ Instalar: `@nestjs/schedule`, `nodemailer`
- ❓ Cifrado de password SMTP en `Configuration` (decidir mecanismo en sprint 2)

**Frontend**:
- ✅ shadcn/ui + tokens M3, recharts, TanStack Query, `useCrud`/`useConfirm`/`useNotifications`, `ai-api-keys.ts` (localStorage)
- ❓ Nada nuevo previsto

---

## Plan de Implementación (sprints)

Detalle ejecutable por sprint en `plans/260714-1357-modulo-compras/phase-NN-*.md` (cada uno con su checklist de **Checking**). Informes de checking en `plans/260714-1357-modulo-compras/reports/`.

| Sprint | Contenido | Estimación | Depende de |
|--------|-----------|-----------|------------|
| 0 Fundaciones | Key `compras` + nav + página esqueleto; retirar `orders`; migración `Location` + backfill; modelos `PurchaseOrder/Line/Event` | 10-12h | — |
| 1 Listas y pedidos | `PurchaseList/Item`, CRUD pedidos, checklist, sugerencias mín/máx, máquina de estados, numeración | 16-18h | 0 |
| 2 Envío multicanal | PDF, wa.me, módulo mail SMTP, tel:, eventos, marcar enviado | 14-16h | 1 |
| 3 Recepción/conciliación | `Albaran.purchaseOrderId`, conciliación, discrepancias, factura mínima | 12-14h | 1 |
| 4 Precios pactados | `agreedPrice`, detección desviaciones, notificaciones, panel | 10-12h | 3 |
| 5 Catálogos IA + comparativa | Importación tarifas IA, revisión, aplicar ofertas, comparativa, `OfferLocationSetting` | 18-20h | 0 (integra 4) |
| 6 Programación | `@nestjs/schedule`, `PurchaseSchedule`, borradores + notificación | 10-12h | 1 |
| 7 Analítica + QA final | Top-20, por proveedor, desviaciones, comparativas (recharts); checking end-to-end del módulo | 14-16h | 2-6 |

**Total estimado**: 104-120 horas.

---

## Criterios de Aceptación

### Módulo y activación
- [ ] "Compras" visible y conmutables en panel superadmin; toggle off → nav oculto, ruta redirige, API 403
- [ ] Prototipo `orders` retirado de registry/nav/app.module sin pérdida de datos ni romper arranque
- [ ] SUPERADMIN bypass funciona como en los demás módulos

### Pedidos y listas
- [ ] Crear lista por proveedor, marcar artículos, generar pedido con cantidades sugeridas según mín/máx de stock
- [ ] Máquina de estados completa con transiciones inválidas rechazadas (400)
- [ ] Numeración PED-N sin colisiones con filas soft-deleted

### Envío
- [ ] wa.me abre WhatsApp con el pedido pre-redactado del proveedor correcto
- [ ] Email real enviado vía SMTP del tenant con PDF adjunto; error SMTP visible al usuario (nunca `catch {}` silencioso)
- [ ] Cada envío registra evento (usuario, canal, fecha) visible en timeline

### Recepción, pactados, catálogos
- [ ] Albarán vinculable a pedido; discrepancias cantidad/precio visibles; estado RECIBIDO_PARCIAL/RECIBIDO correcto
- [ ] Precio recibido > pactado → notificación instantánea + entrada en panel de desviaciones
- [ ] Importar tarifa (PDF/imagen) extrae líneas vía IA, exige revisión humana y al aplicar actualiza ofertas + histórico
- [ ] Comparativa muestra mejor precio; activar oferta por local cambia sugerencias solo en ese local

### Programación y analítica
- [ ] Programación genera borrador a la hora configurada + notificación; nunca envía sola; idempotente (sin duplicados si el cron se re-ejecuta)
- [ ] Top-20 con % acumulado, compras por proveedor, desviaciones y comparativas correctas contra datos de prueba conocidos

### General
- [ ] Cero pérdida de datos: migraciones aditivas, reversibles, probadas con copia
- [ ] Multi-tenant estricto (`tenantId` en toda query); SQL raw con `deletedAt IS NULL` manual
- [ ] Sin errores TypeScript; specs Jest de servicios nuevos pasan; responsive; tokens M3; `useConfirm()` en destructivos
- [ ] Sin regresiones en albaranes/artículos/proveedores (flujo albarán completo re-probado)

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Multi-local se expande a usuarios/permisos/stock | Alta | Alto | Alcance cerrado: `Location` solo en compras+almacenes; resto = pregunta abierta/roadmap |
| Credenciales SMTP por tenant en BD | Media | Alto | Cifrar valor en `Configuration` (decidir mecanismo sprint 2); nunca exponer en GET |
| IA extrae mal tarifas (formatos heterogéneos) | Alta | Medio | Revisión humana obligatoria antes de aplicar; estados por línea; sin escritura directa |
| Cron duplica pedidos programados | Media | Medio | Idempotencia por `lastRunAt` + ventana; test de re-ejecución |
| SQL raw analítica olvida `deletedAt IS NULL` | Media | Alto | Checklist explícito + test con fila soft-deleted (gotcha ya sufrido 2 veces) |
| Retirar `orders` rompe algo no detectado | Baja | Medio | Grep exhaustivo de referencias antes de quitar; tablas intactas; reversible |
| wa.me no confirma entrega | Alta | Bajo | Estado ENVIADO requiere confirmación manual del usuario tras abrir WhatsApp |

---

## Preguntas Abiertas

1. ¿Los usuarios se restringirán por local en el futuro (roles por local)? Fuera de alcance ahora; condiciona diseño de permisos futuro.
2. Facturas: ¿se querrá módulo completo (líneas, vencimientos, conciliación bancaria)? Ahora solo registro mínimo enlazado.
3. ¿Tolerancia % por defecto para desviación de precio pactado configurable global o por proveedor? (MVP: global en `Configuration`.)
4. Ruta de locales: ¿`/v1/compras/locales` o `/v1/locations` transversal? Decidir en sprint 0 según si otro módulo lo va a consumir pronto.
5. PVP/IVA en PDF de pedido: fuera de alcance (coherente con decisión previa de escandallos).

---

## Referencias

- Plan de sprints: `plans/260714-1357-modulo-compras/plan.md`
- Sistema de módulos: `backend/src/modules/modules/constants/registry.ts`, `backend/src/guards/module.guard.ts`, `frontend/src/features/modules/lib/nav-config.ts`
- Patrones a seguir: `backend/src/modules/albaranes/` (servicios enfocados + máquina de estados), paginación server-side de artículos, `backend/ocr-microservice/app/services/ai_extraction_service.py`
- Schema: `backend/prisma/schema.prisma` (`Supplier` L1069, `ProductSupplierOffer` L221, `Stock` L1107, `Albaran` L1591)
- Regla crítica: `docs/code-standards.md` → "⛔ Cero pérdida de datos"

---

**Siguiente paso**: ejecutar Sprint 0 (`plans/260714-1357-modulo-compras/phase-00-fundaciones.md`)
