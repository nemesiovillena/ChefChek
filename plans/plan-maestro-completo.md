# Plan Maestro - ChefChek: Planificación Exhaustiva

## Contexto

**Problema:** Necesidad de planificación exhaustiva y roadmap para implementar ChefChek, un SaaS Multi-tenant modular para cocinas profesionales.

**Objetivo:** Crear documentación completa, roadmap detallado con sprints y tareas organizadas para construir todos los módulos del sistema según las especificaciones en `docs/plan-maestro.md`.

**Tech Stack Decidido:**
- Backend: NestJS (framework principal)
- Frontend: Next.js 16.2.6 (última versión estable)
- Auth: Lucia Auth + Prisma
- Base de datos: PostgreSQL (Prisma ORM)
- Editor: TipTap (JSON estructurado)
- Arquitectura: API-First, Multi-tenant modular

## Arquitectura General del Sistema

### Estructura Modular
```
ChefChek/
├── Core/                          # Módulo base
│   ├── Autenticación (Lucia Auth)
│   ├── Multi-tenancy (Tenants)
│   ├── Usuarios y Roles
│   └── Configuración básica
├── Escandallos/                   # Core Fase 1 - PRIORIDAD ABSOLUTA
│   ├── Productos y Ingredientes
│   ├── Recetas y Sub-recetas
│   ├── Menús y Cartas
│   ├── Costeos y Rendimientos
│   └── Fichas técnicas
├── Seguridad/                     # Seguridad alimentaria
│   ├── Alérgenos (cascada)
│   ├── APPCC
│   └── Controles sanitarios
├── Producción/                    # Control de producción
│   ├── Partidas de trabajo
│   ├── Órdenes de producción
│   ├── Hojas de pedido
│   └── Mise en place
├── Almacenes/                     # Gestión de inventarios
│   ├── Entradas (albaranes)
│   ├── Salidas
│   └── Inventarios teóricos vs reales
├── Sala/                          # Módulo QR
│   ├── Carta digital QR
│   ├── Branding personalizado
│   └── Filtros de alérgenos
├── Ingesta/                       # Omnicanal
│   ├── Bot de Telegram
│   ├── OCR + IA
│   └── Webhooks seguros
└── Conocimiento/                  # Control interno
    ├── Wiki de procedimientos
    └── Roadmap tracker
```

## Roadmap con Sprints Detallados

### Sprint 0: Fundamentos (1 semana)
**Objetivo:** Configuración técnica base y primeros archivos

**Tareas:**
- [ ] Configuración inicial del proyecto
- [ ] Setup NestJS backend structure
- [ ] Configuración Prisma + PostgreSQL
- [ ] Setup Lucia Auth
- [ ] Definir estructura de módulos
- [ ] Configurar TipTap editor
- [ ] Setup Design System base (Tailwind/Estilos)
- [ ] Configurar multiidioma base (i18n)

**Documentación a crear:**
- [ ] `docs/system-architecture.md` - Arquitectura completa del sistema
- [ ] `docs/tech-stack.md` - Stack tecnológico detallado
- [ ] `docs/database-schema.md` - Esquema de base de datos
- [ ] `docs/api-conventions.md` - Convenciones de API
- [ ] `docs/authentication-flow.md` - Flujo de autenticación

**Verificación:**
- Proyecto estructura creada
- Prisma schema inicial definido
- Lucia Auth configurado
- Design System base funcionando

---

### Sprint 1: Core Multi-tenancy + Autenticación (2 semanas)
**Objetivo:** Fundamentos de SaaS con aislamiento completo de datos

**Backend (NestJS):**
- [ ] Modelo de Tenant/Company con aislamiento estricto
- [ ] Sistema de usuarios con roles y permisos
- [ ] Lucia Auth integración completa
- [ ] Middleware de verificación de tenant
- [ ] Sistema de sesiones seguras
- [ ] API endpoints de autenticación
- [ ] Protección de rutas por tenant
- [ ] Validación de permisos por módulo

**Frontend:**
- [ ] Login/Logout UI
- [ ] Panel de administración base
- [ ] Gestión de usuarios del tenant
- [ ] Configuración de tenant (idioma, moneda, etc.)
- [ ] Sistema de notificaciones base

**Documentación:**
- [ ] `docs/multi-tenancy-architecture.md`
- [ ] `docs/authorization-model.md`
- [ ] `docs/api-endpoints-auth.md`

**Verificación:**
- Registro de nuevos tenants funciona
- Login/Logout seguro
- Aislamiento de datos verificado
- Roles y permisos funcionando

---

### Sprint 2: Escandallos - Parte 1: Productos (2 semanas)
**Objetivo:** Sistema de gestión de productos con multi-unidad

**Backend:**
- [ ] Modelo de Producto/Ingrediente
- [ ] Sistema Multi-unidad (UC/UA/UR)
- [ ] Configuración de proveedores
- [ ] Gestión de categorías de productos
- [ ] Sistema de precios (bruto vs neto)
- [ ] Cálculo de rendimientos y mermas
- [ ] Importación/exportación de productos

**Frontend:**
- [ ] CRUD de productos completo
- [ ] Formulario multi-unidad complejo
- [ ] Gestión de proveedores
- [ ] Vista detallada de producto
- [ ] Cálculo de costeo en tiempo real
- [ ] Importación masiva (CSV/Excel)

**Documentación:**
- [ ] `docs/multi-unit-system.md`
- [ ] `docs/cost-calculation-rules.md`
- [ ] `docs/product-data-model.md`

**Verificación:**
- Alta/baja/modificación de productos
- Conversión correcta entre UC/UA/UR
- Cálculo de precios netos precisos
- Rendimientos y mermas calculados

---

### Sprint 3: Escandallos - Parte 2: Recetas (3 semanas)
**Objetivo:** Motor de recetas con recursividad y TipTap

**Backend:**
- [ ] Modelo de Receta con sub-recetas recursivas
- [ ] Sistema de elaboración en TipTap JSON
- [ ] Cálculo automático de costeos
- [ ] Gestión de rendimientos escalados
- [ ] Sistema de versionado de recetas
- [ ] Copia/duplicación de recetas
- [ ] Filtros y búsqueda avanzada

**Frontend:**
- [ ] Editor de recetas con TipTap
- [ ] Selector de productos multi-unidad
- [ ] Gestión de sub-recetas anidadas
- [ ] Vista previa de ficha técnica
- [ ] Cálculo de costeo en vivo
- [ ] Historial de versiones
- [ ] Comparación entre versiones

**Documentación:**
- [ ] `docs/recipe-data-model.md`
- [ ] `docs/recursive-recipe-system.md`
- [ ] `docs/tiptap-integration.md`
- [ ] `docs/cost-engine-algorithm.md`

**Verificación:**
- Recetas con sub-recetas funcionan
- TipTap editor JSON correcto
- Costeos calculados automáticamente
- Versionado de recetas funciona
- Duplicación de recetas correcta

---

### Sprint 4: Escandallos - Parte 3: Menús y Cartas (2 semanas)
**Objetivo:** Sistema de menús con composición dinámica

**Backend:**
- [ ] Modelo de Menú
- [ ] Modelo de Carta Digital
- [ ] Sistema de composición de menús
- [ ] Gestión de categorías de carta
- [ ] Ordenación y priorización
- [ ] Disponibilidad por temporada
- [ ] Multi-idioma en menús/cartas

**Frontend:**
- [ ] Constructor de menús drag&drop
- [ ] Gestión de cartas
- [ ] Vista de composición de menú
- [ ] Selector de recetas por categoría
- [ ] Gestión de disponibilidad
- [ ] Traducción de menús/cartas

**Documentación:**
- [ ] `docs/menu-composition-system.md`
- [ ] `docs/digital-menu-architecture.md`
- [ ] `docs/multi-lingual-menu-system.md`

**Verificación:**
- Menús con composición dinámica
- Cartas con categorías funcionales
- Multi-idioma en menús/cartas
- Drag&drop de recetas funciona

---

### Sprint 5: Alérgenos y Seguridad Alimentaria (2 semanas)
**Objetivo:** Sistema de trazabilidad automática de alérgenos

**Backend:**
- [ ] Modelo de alérgenos base (UE 1169/2011)
- [ ] Sistema de declaración en productos
- [ ] Propagación cascada automática
- [ ] Cálculo de alérgenos en recetas
- [ ] Cálculo de alérgenos en menús/cartas
- [ ] Sistema de alertas y conflictos
- [ ] Reporte de cumplimiento legal

**Frontend:**
- [ ] Gestión de alérgenos en productos
- [ ] Visualización de cascada de alérgenos
- [ ] Alertas de conflictos
- [ ] Filtros de alérgenos en recetas
- [ ] Reporte de cumplimiento
- [ ] Exportación legal

**Documentación:**
- [ ] `docs/allergen-propagation-system.md`
- [ ] `docs/ue-1169-2011-compliance.md`
- [ ] `docs/allergen-conflict-detection.md`

**Verificación:**
- Declaración de alérgenos en productos
- Propagación cascada automática
- Visualización de alérgenos en recetas/menús
- Alertas de conflictos funcionan
- Cumplimiento legal verificado

---

### Sprint 6: Fichas Técnicas y Documentos (2 semanas)
**Objetivo:** Sistema de generación de fichas técnicas parametrizadas

**Backend:**
- [ ] Motor de generación de fichas técnicas
- [ ] Plantillas parametrizadas
- [ ] Sistema de diseño de fichas
- [ ] Generación de PDF dinámicos
- [ ] Descarga masiva de documentos
- [ ] Hub central de documentos

**Frontend:**
- [ ] Selector de plantillas de ficha
- [ ] Vista previa de ficha técnica
- [ ] Diseñador de plantillas
- [ ] Exportación PDF
- [ ] Gestión de documentos
- [ ] Filtros de descarga masiva

**Documentación:**
- [ ] `docs/technical-sheet-generation.md`
- [ ] `docs/template-system-architecture.md`
- [ ] `docs/pdf-generation-engine.md`

**Verificación:**
- Fichas técnicas generadas correctamente
- Plantillas parametrizadas funcionales
- Exportación PDF funciona
- Descarga masiva de documentos

---

### Sprint 7: APPCC y Control Sanitario (2 semanas)
**Objetivo:** Sistema de registro digital de controles sanitarios

**Backend:**
- [ ] Modelo de controles APPCC
- [ ] Registro de temperaturas de cámaras
- [ ] Planes de limpieza
- [ ] Control de plagas
- [ ] Recepción de mercancías
- [ ] Sistema de alertas y recordatorios
- [ ] Reportes de cumplimiento

**Frontend:**
- [ ] Dashboard de controles APPCC
- [ ] Formularios de registro
- [ ] Visualización de temperaturas
- [ ] Gestión de planes de limpieza
- [ ] Sistema de alertas
- [ ] Reportes de cumplimiento

**Documentación:**
- [ ] `docs/appcc-system-architecture.md`
- [ ] `docs/sanitary-control-procedures.md`
- [ ] `docs/appcc-compliance-reporting.md`

**Verificación:**
- Registro de controles sanitarios funciona
- Temperaturas de cámaras registradas
- Planes de limpieza gestionados
- Alertas funcionan correctamente

---

### Sprint 8: Control de Producción (2 semanas)
**Objetivo:** Sistema de partidas de trabajo y mise en place

**Backend:**
- [ ] Modelo de partidas de trabajo
- [ ] Órdenes de producción
- [ ] Organización por zonas de cocina
- [ ] Hojas guía de mise en place
- [ ] Sistema de asignación de tareas
- [ ] Seguimiento de progreso

**Frontend:**
- [ ] Dashboard de producción
- [ ] Gestión de partidas de trabajo
- [ ] Vista por zonas de cocina
- [ ] Hojas de mise en place
- [ ] Asignación de tareas
- [ ] Seguimiento de progreso

**Documentación:**
- [ ] `docs/production-control-system.md`
- [ ] `docs/work-batch-architecture.md`
- [ ] `docs/mise-en-place-management.md`

**Verificación:**
- Partidas de trabajo creadas
- Órdenes de producción generadas
- Zonas de cocina organizadas
- Hojas de mise en place funcionales

---

### Sprint 9: Hojas de Pedido Automatizadas (1 semana)
**Objetivo:** Sistema de generación automática de pedidos

**Backend:**
- [ ] Motor de cálculo de necesidades
- [ ] Clasificación por proveedor
- [ ] Clasificación por zona de conservación
- [ ] Generación de plantillas de compra
- [ ] Sistema de optimización

**Frontend:**
- [ ] Generador de hojas de pedido
- [ ] Clasificación por proveedor/zona
- [ ] Vista de necesidades vs existencias
- [ ] Exportación de plantillas

**Documentación:**
- [ ] `docs/automated-order-system.md`
- [ ] `docs/supplier-classification.md`
- [ ] `docs/conservation-zone-mapping.md`

**Verificación:**
- Hojas de pedido generadas correctamente
- Clasificación por proveedor funciona
- Clasificación por zona de conservación funciona

---

### Sprint 10: Almacenes e Inventarios (2 semanas)
**Objetivo:** Sistema de gestión de almacenes completo

**Backend:**
- [ ] Modelo de almacenes
- [ ] Gestión de entradas (albaranes)
- [ ] Gestión de salidas
- [ ] Inventarios teóricos
- [ ] Inventarios físicos
- [ ] Comparación teórico vs real
- [ ] Sistema de alertas de stock

**Frontend:**
- [ ] Dashboard de almacenes
- [ ] Gestión de albaranes
- [ ] Registro de entradas/salidas
- [ ] Realización de inventarios físicos
- [ ] Comparación de inventarios
- [ ] Alertas de stock

**Documentación:**
- [ ] `docs/warehouse-management-system.md`
- [ ] `docs/inventory-control-architecture.md`
- [ ] `docs/stock-alert-system.md`

**Verificación:**
- Entradas y salidas registradas
- Inventarios teóricos calculados
- Inventarios físicos realizados
- Comparación teórico vs real funciona

---

### Sprint 11: Carta Digital QR (2 semanas)
**Objetivo:** Sistema de cartas digitales QR para comensales

**Backend:**
- [ ] Sistema de generación de QR
- [ ] Landing page de carta digital
- [ ] Sistema de multi-idioma en cartas
- [ ] Filtros de alérgenos en tiempo real
- [ ] Sistema de branding personalizado
- [ ] Analytics de uso

**Frontend:**
- [ ] Generador de QR
- [ ] Landing page responsive
- [ ] Filtros de alérgenos interactivos
- [ ] Selector de idioma
- [ ] Configuración de branding
- [ ] Vista de analytics

**Documentación:**
- [ ] `docs/digital-qr-menu-system.md`
- [ ] `docs/qr-generation-architecture.md`
- [ ] `docs/allergen-filter-system.md`

**Verificación:**
- QR generados correctamente
- Landing page responsive
- Filtros de alérgenos funcionan
- Multi-idioma en cartas funciona
- Branding personalizado aplicado

---

### Sprint 12: Ingesta Omnicanal - Telegram Bot (2 semanas)
**Objetivo:** Sistema de ingesta vía Telegram

**Backend:**
- [ ] Bot de Telegram propietario
- [ ] Sistema de webhooks seguros
- [ ] Asociación de archivos a tenants
- [ ] Sistema de seguridad de archivos
- [ ] Queue de procesamiento

**Frontend:**
- [ ] Dashboard de ingesta
- [ ] Visualización de archivos recibidos
- [ ] Gestión de colas de procesamiento
- [ ] Sistema de errores

**Documentación:**
- [ ] `docs/telegram-bot-architecture.md`
- [ ] `docs/webhook-security-system.md`
- [ ] `docs/file-ingestion-queue.md`

**Verificación:**
- Bot de Telegram funciona
- Webhooks seguros implementados
- Archivos asociados correctamente a tenants
- Sistema de colas funcionando

---

### Sprint 13: Ingesta Omnicanal - OCR + IA (2 semanas)
**Objetivo:** Sistema de procesamiento inteligente de documentos

**Backend:**
- [ ] Motor de OCR
- [ ] Sistema de IA para extracción
- [ ] Análisis de documentos
- [ ] Extracción de ítems, cantidades, precios
- [ ] Alta automática de productos
- [ ] Actualización de costes existentes
- [ ] Recálculo en cascada de escandallos

**Frontend:**
- [ ] Dashboard de procesamiento
- [ ] Visualización de resultados de OCR
- [ ] Validación de datos extraídos
- [ ] Gestión de productos nuevos
- [ ] Confirmación de actualizaciones

**Documentación:**
- [ ] `docs/ocr-engine-architecture.md`
- `docs/ai-extraction-system.md`
- [ ] `docs/automatic-product-creation.md`
- [ ] `docs/cascade-cost-recalculation.md`

**Verificación:**
- OCR funciona correctamente
- IA extrae datos con precisión
- Productos nuevos creados automáticamente
- Costes actualizados en cascada
- Escandallos recalculados

---

### Sprint 14: Dashboard Interactivo (1 semana)
**Objetivo:** Panel de control moderno con métricas clave

**Backend:**
- [ ] Sistema de métricas y KPIs
- [ ] Evolución de costes de proveedores
- [ ] Salud de márgenes financieros
- [ ] Alarmas de pérdidas de beneficios
- [ ] Ingeniería de menús en tiempo real

**Frontend:**
- [ ] Dashboard interactivo
- [ ] Visualización de métricas
- [ ] Gráficos de evolución
- [ ] Sistema de alertas
- [ ] Widgets personalizados

**Documentación:**
- [ ] `docs/dashboard-architecture.md`
- [ ] `docs/kpi-calculation-system.md`
- [ ] `docs/alert-notification-system.md`

**Verificación:**
- Dashboard interactivo funciona
- Métricas calculadas correctamente
- Gráficos de evolución funcionan
- Alertas configuradas

---

### Sprint 15: Wiki de Procedimientos (1 semana)
**Objetivo:** Sistema de conocimiento interno

**Backend:**
- [ ] Sistema de documentación wiki
- [ ] Búsqueda de procedimientos
- [ ] Categorización de procesos
- [ ] Versionado de documentos
- [ ] Sistema de permisos

**Frontend:**
- [ ] Editor de procedimientos
- [ ] Visualización de wiki
- [ ] Sistema de búsqueda
- [ ] Gestión de categorías
- [ ] Historial de cambios

**Documentation:**
- [ ] `docs/wiki-system-architecture.md`
- [ ] `docs/procedure-organization.md`
- [ ] `docs/knowledge-management.md`

**Verificación:**
- Wiki funcional
- Procedimientos documentados
- Búsqueda funciona
- Sistema de permisos activo

---

### Sprint 16: Roadmap/Sprint Tracker Interno (1 semana)
**Objetivo:** Sistema de seguimiento de desarrollo

**Backend:**
- [ ] Modelo de sprints y tareas
- [ ] Sistema de asignación de tareas
- [ ] Seguimiento de progreso
- [ ] Sistema de notificaciones
- [ ] Reportes de progreso

**Frontend:**
- [ ] Dashboard de sprints
- [ ] Gestión de tareas
- [ ] Asignación de desarrolladores
- [ ] Visualización de progreso
- [ ] Reportes de equipo

**Documentation:**
- [ ] `docs/sprint-tracker-architecture.md`
- [ ] `docs/task-management-system.md`
- [ ] `docs/team-coordination.md`

**Verificación:**
- Sprints definidos correctamente
- Tareas asignadas y seguidas
- Progreso visualizado
- Reportes generados

---

## Checklist Final de Verificación

### Funcionalidad Completa del Sistema
- [ ] Multi-tenancy estricto con aislamiento de datos
- [ ] Autenticación segura con Lucia Auth
- [ ] Sistema completo de escandallos
- [ ] Alérgenos con trazabilidad automática
- [ ] Fichas técnicas parametrizadas
- [ ] APPCC y controles sanitarios
- [ ] Control de producción
- [ ] Gestión de almacenes
- [ ] Carta digital QR
- [ ] Ingesta omnicanal (Telegram + IA)
- [ ] Dashboard interactivo
- [ ] Wiki de procedimientos
- [ ] Roadmap tracker interno

### Documentación Completa
- [ ] Documentación de arquitectura del sistema
- [ ] Documentación de APIs
- [ ] Documentación de base de datos
- [ ] Documentación de seguridad
- [ ] Documentación de procedimientos
- [ ] Guías de usuario
- [ ] Documentación de despliegue

### Calidad y Estándares
- [ ] Límite de 1000 líneas por archivo cumplido
- [ ] Reutilización de componentes verificada
- [ ] Ancho de contenido consistente
- [ ] Tabs con URL amigable en admin
- [ ] Convenciones de código respetadas
- [ ] Tests completos pasando
- [ ] Performance óptima
- [ ] Seguridad verificada

## Unresolved Questions

1. **Frontend framework específico:** ¿Next.js, React + Vite, u otro?
2. **Stack de UI:** ¿shadcn/ui, Material UI, custom components?
3. **Stack de testing:** ¿Jest, Vitest, Cypress, Playwright?
4. **Stack de CI/CD:** ¿GitHub Actions, GitLab CI, otro?
5. **Infraestructura cloud:** ¿AWS, GCP, Azure, Vercel, Railway?
6. **Servicios externos:** ¿ qué proveedores para OCR, IA, storage?
7. **Estrategia de i18n:** ¿i18next, next-intl, solución custom?
8. **Estrategia de state management:** ¿Redux, Zustand, Context API?

## Next Steps

Tras aprobación del plan:
1. Setup inicial del proyecto (Sprint 0)
2. Configuración de repository GitHub
3. Configuración de CI/CD pipeline
4. Iniciar Sprint 1: Core Multi-tenancy + Autenticación