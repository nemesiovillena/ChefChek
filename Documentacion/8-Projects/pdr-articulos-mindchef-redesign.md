# PDR: Rediseño Artículos → Estilo MindChef Stock

**Fecha:** 2026-06-11
**Estado:** Pendiente de aprobación
**Prioridad:** Alta
**Referencia:** https://mindchefai.com/stock/ | Video: https://www.youtube.com/watch?v=NYEDqy61qw0

---

## 1. Objetivo

Rediseñar la sección "Artículos" de ChefChek para replicar la experiencia de gestión de inventario de MindChef: interfaz limpia con dropdowns de categoría tipo combobox, listado compacto tipo tabla con inline actions, y doble vía de entrada de datos (manual + upload OCR de albaranes/facturas).

## 2. Contexto Actual

### Lo que tenemos (Artículos hoy)
- **Vista:** Tabla plana con columnas fijas (nombre, categoría, proveedor, precio, stock, estado)
- **Filtros:** 3 `<select>` nativos encadenados (Familia → Subfamilía → Proveedor) + campo búsqueda
- **Creación:** Modal con 5 tabs (Peso/Precio, Formato Compra, Alérgenos, Proveedor/Stock, Nutrición)
- **OCR:** Existe módulo ingesta con Google Vision + Tesseract, pero NO integrado en la vista Artículos
- **Categorías:** Jerarquía Familia → Subfamilía con `context: "articles"` ya funcional
- **Stock:** Modelo Stock con min/max/reservado ya en BD

### Lo que falta vs MindChef
| Aspecto | ChefChek Hoy | MindChef Target |
|---------|-------------|-----------------|
| Filtros categoría | `<select>` nativos feos | Combobox con búsqueda, agrupados por familia |
| Listado artículos | Tabla monolítica | Tabla compacta con filas expandibles/inline edit |
| Entrada de datos | Solo manual (modal 5 tabs) | Manual + Upload albarán OCR |
| Alta rápida | No existe | Alta rápida inline (nombre + categoría mínimos) |
| Estado stock | Indicador básico | Badge color semáforo (verde/amarillo/rojo) |
| Categoría en fila | Texto plano | Badge/pill con color de categoría |
| Acciones fila | Botones separados | Inline actions al hover/focus |
| Upload documentos | En sección OCR separada | Botón "Añadir desde albarán" integrado en vista |

## 3. Requisitos Funcionales

### RF-01: Combobox de Categorías Mejorado
- [x] Reemplazar `<select>` nativos por componentes **Combobox** (shadcn/ui Command + Popover)
- [x] Dropdown con búsqueda inline (type-to-filter)
- [x] Agrupación visual: items agrupados por Familia, con subfamilías indentadas
- [x] Permitir selección de familia (filtra todas sus subfamilías) o subfamilía específica
- [x] Indicador visual de categoría seleccionada (icono + color + nombre)
- [x] Opción "Todas las categorías" como default

### RF-02: Listado de Artículos Tipo MindChef
- [x] Tabla compacta con columnas: Nombre, Categoría, Proveedor, Precio Compra, Stock, Estado
- [x] Columna "Categoría" como **pill/badge** con color de la categoría
- [x] Columna "Stock" con **badge semáforo**: 🟢 > min, 🟡 entre min y 0, 🔴 = 0
- [x] Fila expandible o modal centrado para ver detalle completo (5 tabs actuales)
- [x] Inline actions al hover: editar, eliminar, generar QR, duplicar
- [x] Alternar vista tabla / vista tarjetas (toggle)
- [ ] Paginación con control de items por página (25/50/100)

### RF-03: Alta Rápida de Artículo
- [x] Botón primario "+ Añadir artículo" en toolbar
- [x] Click → abre formulario inline o modal simplificado con campos mínimos:
  - Nombre (obligatorio)
  - Categoría/Familia (obligatorio, combobox)
  - Unidad de compra (default: kg)
  - Precio de compra
  - Proveedor (opcional)
- [ ] Guardar → crea artículo en estado "borrador" con datos mínimos (pendiente schema migration isDraft)
- [x] Opción "Completar datos" → abre modal completo con 5 tabs
- [x] También: click en fila vacía al final de tabla → inline add

### RF-04: Upload de Albarán/Factura con OCR
- [x] Botón secundario "📄 Añadir desde albarán" en toolbar
- [x] Click → abre modal de upload con:
  - Zona drag & drop para imágenes (JPG, PNG) y PDFs
  - Soporte multi-archivo (subir varias páginas/facturas)
  - Preview del documento subido
  - Progreso de procesamiento OCR
- [x] Tras OCR:
  - Lista de productos detectados con confianza (%)
  - Cada producto: checkbox para incluir + campos editables (nombre, precio, cantidad, categoría)
  - Matching automático contra productos existentes (fuzzy match via ProductRecognitionService)
  - Productos nuevos → crear; productos existentes → actualizar stock/precio
- [x] Confirmación → lote de creación/actualización
- [ ] Guardar albarán original en modelo Document con referencia a productos creados (pendiente schema migration source/sourceDocumentId)

### RF-05: Proveedor Combobox
- [x] Reemplazar `<select>` de proveedor por Combobox con búsqueda
- [ ] Mostrar: nombre + CIF + score fiabilidad
- [x] Opción "Sin proveedor" y "Añadir proveedor" inline

### RF-06: Búsqueda Mejorada
- [x] Búsqueda global con debounce (300ms)
- [x] Busca en: nombre, marca, código de barras, proveedor
- [ ] Highlight de términos coincidentes en resultados
- [ ] Shortcut: Ctrl+K para foco en búsqueda

### RF-07: Filtros Avanzados
- [x] Panel de filtros desplegable (toggle "Filtros")
- [x] Filtros: Categoría, Proveedor, Estado stock (ok/bajo/agotado)
- [x] Tags activos debajo de búsqueda mostrando filtros aplicados
- [x] "Limpiar filtros" botón
- [ ] Filtros persistidos en URL params (shareable state)
- [ ] Filtro: Rango de precio
- [ ] Filtro: Con/sin alérgenos

### RF-08: Vista Detalle de Artículo
- [x] Modal centrado tipo Recetas (overlay + max-w-4xl centrado, igual que sección Recetas)
- [x] Modal con tabs: Peso/Precio, Formato Compra, Alérgenos, Proveedor/Stock, Nutrición
- [x] Botón cerrar (X) + botones Cancelar/Guardar en footer
- [ ] Edición inline dentro del modal (sin modal adicional)
- [ ] Botón "Historial" → ver movimientos de stock del artículo

## 4. Requisitos No Funcionales

### RNF-01: Rendimiento
- [ ] First paint < 1s para listado de hasta 1000 artículos
- [ ] OCR processing feedback en < 3s desde upload
- [ ] Virtualización de lista si > 200 artículos visibles

### RNF-02: UX
- [ ] Consistencia visual con design system shadcn/ui
- [ ] Responsive: funcional en tablet (1024px+) — prioridad cocina
- [ ] Transiciones suaves (200ms) en expand/collapse, modal, filtros
- [ ] Accesible: keyboard navigation, ARIA labels, focus management

### RNF-03: Datos
- [ ] Los productos creados via OCR se guardan con `source: "ocr"` y referencia al Document
- [ ] No se crean duplicados — fuzzy match antes de insert
- [ ] Albarán original preservado para auditoría

## 5. Arquitectura de Cambios

### Frontend (Nuevo/Modificado)

```
frontend/src/app/dashboard/articulos/
├── page.tsx                          # REESCRIBIR: layout principal
├── components/
│   ├── articulo-modal.tsx            # ELIMINAR → reemplazar por modal centrado
│   ├── articulo-drawer.tsx           # NUEVO: modal centrado tipo Recetas (5 tabs)
│   ├── articulo-quick-add.tsx        # NUEVO: alta rápida inline
│   ├── articulo-table.tsx            # NUEVO: tabla compacta con inline actions
│   ├── articulo-row.tsx              # NUEVO: fila expandible
│   ├── articulo-cards.tsx            # NUEVO: vista tarjetas alternativa
│   ├── category-combobox.tsx         # NUEVO: combobox categorías agrupadas
│   ├── supplier-combobox.tsx         # NUEVO: combobox proveedores
│   ├── stock-badge.tsx               # NUEVO: badge semáforo stock
│   ├── category-pill.tsx             # NUEVO: pill de categoría con color
│   ├── albaran-upload-drawer.tsx     # NUEVO: drawer upload OCR
│   ├── ocr-results-review.tsx        # NUEVO: revisión resultados OCR
│   ├── ocr-product-match.tsx         # NUEVO: matching OCR → producto existente
│   ├── filter-panel.tsx              # NUEVO: panel filtros avanzados
│   ├── filter-tags.tsx               # NUEVO: tags filtros activos
│   ├── tab-peso-precio.tsx           # MANTENER (adaptar a modal)
│   ├── tab-formato-compra.tsx        # MANTENER (adaptar a modal)
│   ├── tab-alergenos.tsx             # MANTENER (adaptar a modal)
│   ├── tab-proveedor-stock.tsx       # MANTENER (adaptar a modal)
│   └── tab-nutricion.tsx             # MANTENER (adaptar a modal)
```

### Backend (Nuevo/Modificado)

```
backend/src/modules/products/
├── products.controller.ts            # MODIFICAR: endpoint bulk create + quick add
├── products.service.ts               # MODIFICAR: lógica bulk + fuzzy match
├── dto/
│   ├── create-product.dto.ts         # MODIFICAR: añadir quickCreate, source
│   ├── bulk-create.dto.ts            # NUEVO: DTO para creación en lote
│   └── ocr-import.dto.ts             # NUEVO: DTO para importar desde OCR

backend/src/modules/ingesta/
├── ingesta.controller.ts             # MODIFICAR: endpoint para Artículos (no solo ingesta general)
├── ocr-ai.service.ts                 # MODIFICAR: output estructurado para productos
├── product-recognition.service.ts    # MANTENER (ya hace fuzzy match)
```

### Base de Datos (Modificado)

```sql
-- Añadir campos a Product
ALTER TABLE "Product" ADD COLUMN "source" TEXT DEFAULT 'manual';  -- 'manual' | 'ocr' | 'import'
ALTER TABLE "Product" ADD COLUMN "sourceDocumentId" TEXT;         -- FK a Document
ALTER TABLE "Product" ADD COLUMN "isDraft" BOOLEAN DEFAULT false; -- alta rápida = borrador
```

### Schema Prisma (Cambios)

```prisma
model Product {
  // ... campos existentes ...
  source            String?            @default("manual")  // manual | ocr | import
  sourceDocumentId  String?            // FK → Document
  sourceDocument    Document?          @relation(fields: [sourceDocumentId], references: [id])
  isDraft           Boolean            @default(false)      // alta rápida → completar después
}
```

## 6. Fases de Implementación

### Fase 1: UI Base — Combobox + Tabla Compacta
**Prioridad:** Alta | **Estimación:** 3-4h

- [ ] Crear `category-combobox.tsx` con shadcn/ui Command + Popover
- [ ] Crear `supplier-combobox.tsx`
- [ ] Reescribir `page.tsx` con nueva toolbar (combobox + búsqueda + botones)
- [ ] Crear `articulo-table.tsx` con tabla compacta
- [ ] Crear `stock-badge.tsx` (semáforo)
- [ ] Crear `category-pill.tsx`
- [ ] Migrar filtros existentes a nuevos combobox

### Fase 2: Modal Centrado + Alta Rápida
**Prioridad:** Alta | **Estimación:** 2-3h

- [x] Crear `articulo-drawer.tsx` — modal centrado tipo Recetas (overlay + max-w-4xl)
- [x] Adaptar tabs existentes al modal centrado
- [x] Crear `articulo-quick-add.tsx` (formulario mínimo inline)
- [ ] Endpoint backend `POST /products/quick` con campos mínimos
- [ ] Añadir campo `isDraft` a schema + migration
- [x] Eliminar `articulo-modal.tsx` (reemplazado por modal centrado)

### Fase 3: Upload Albarán OCR Integrado
**Prioridad:** Alta | **Estimación:** 4-5h

- [ ] Crear `albaran-upload-drawer.tsx` (zona drag & drop + preview)
- [ ] Crear `ocr-results-review.tsx` (lista productos detectados con confianza)
- [ ] Crear `ocr-product-match.tsx` (matching + edición antes de guardar)
- [ ] Endpoint backend `POST /ingesta/process-for-stock` → procesa y devuelve productos
- [ ] Endpoint backend `POST /products/bulk` → creación/actualización en lote
- [ ] DTO `bulk-create.dto.ts` y `ocr-import.dto.ts`
- [ ] Añadir campos `source`, `sourceDocumentId` a schema + migration
- [ ] Integrar ProductRecognitionService para fuzzy match automático

### Fase 4: Filtros Avanzados + Vista Tarjetas
**Prioridad:** Media | **Estimación:** 2-3h

- [ ] Crear `filter-panel.tsx` (panel desplegable con filtros)
- [ ] Crear `filter-tags.tsx` (tags filtros activos)
- [ ] Persistir filtros en URL params
- [ ] Crear `articulo-cards.tsx` (vista tarjetas)
- [ ] Toggle tabla/tarjetas en toolbar
- [ ] Keyboard shortcut Ctrl+K para búsqueda

### Fase 5: Pulido UX
**Prioridad:** Baja | **Estimación:** 1-2h

- [ ] Transiciones y animaciones
- [ ] Inline edit en campos clave (precio, stock)
- [ ] Historial de movimientos por artículo
- [ ] Responsive tablet
- [ ] Bulk select + acciones masivas (eliminar, cambiar categoría)

## 7. Dependencias

| Dependencia | Estado | Nota |
|-------------|--------|------|
| shadcn/ui Command | ✅ Disponible | Para combobox |
| shadcn/ui Sheet | ✅ Disponible | Para upload drawer lateral (albarán) |
| shadcn/ui Popover | ✅ Disponible | Para dropdowns |
| Google Vision API | ✅ Configurado | OCR primario |
| Tesseract | ✅ Configurado | OCR fallback |
| ProductRecognitionService | ✅ Existe | Fuzzy match productos |
| Prisma Migration | ⚠️ Pendiente | 3 campos nuevos |

## 8. Criterios de Aceptación

- [ ] Los dropdowns de categoría son combobox con búsqueda y agrupación visual
- [ ] El listado muestra artículos en tabla compacta con stock semáforo
- [ ] Se puede crear un artículo con datos mínimos en < 10 segundos
- [ ] Se puede subir un albarán PDF/imagen y ver productos detectados
- [ ] Los productos detectados por OCR se pueden revisar antes de guardar
- [ ] El fuzzy match sugiere productos existentes al importar vía OCR
- [x] Modal centrado muestra detalle completo con 5 tabs (igual que Recetas)
- [ ] Los filtros persisten en URL y son compartibles
- [ ] No hay regresión en funcionalidad existente (5 tabs, QR, delete, etc.)

## 9. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| OCR baja calidad en albaranes manuscritos | Media | Alto | Mostrar confianza % y permitir edición manual |
| Fuzzy match crea duplicados | Media | Medio | Threshold alto (≥85%) + revisión humana |
| Migración schema rompe datos existentes | Baja | Alto | Fields con defaults, migration testada |
| Rendimiento con >500 artículos | Media | Medio | Virtualización + paginación server-side |

## 10. Out of Scope (No hacer)

- Vista móvil phone (< 768px) — solo tablet/desktop
- Importación desde Excel/CSV (futura fase)
- Integración con proveedores externos (API de distribuidores)
- Cálculo automático de consumo teórico (requiere datos de producción)
- Detección automática de desviaciones de inventario

---

## Historial de Cambios

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-06-11 | Claude | Creación inicial del PDR |
