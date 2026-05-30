# System Architecture - ChefChek

## Arquitectura General

ChefChek es una plataforma SaaS Multi-tenant modular diseñada para cocinas profesionales. La arquitectura sigue el patrón **API-First** con separación clara entre backend y frontend.

### Componentes Principales

**Backend (NestJS)**
- API RESTful con endpoints protegidos
- Multi-tenancy estricto con aislamiento de datos por tenant
- Middleware de verificación de tenant para todas las peticiones
- Autenticación con Lucia Auth y sesiones seguras
- Base de datos PostgreSQL con Prisma ORM

**Frontend (Next.js 16.2.6)**
- Panel de administración con routing basado en tabs con URL amigable
- Dashboard interactivo con métricas en tiempo real
- UI reactiva con actualizaciones optimizadas
- Multi-idioma nativo con next-intl
- Design System centralizado con Tailwind CSS

**Base de Datos (PostgreSQL)**
- Esquema multi-tenant con aislamiento estricto de datos
- Modelos de negocio optimizados para rendimiento
- Soporte para relaciones complejas y consultas eficientes
- Índices optimizados para queries frecuentes

## Módulos del Sistema

### Core (Fundamentos)
- **Autenticación**: Login/Logout con Lucia Auth
- **Multi-tenancy**: Gestión de tenants con aislamiento de datos
- **Usuarios y Roles**: Sistema de permisos granular
- **Configuración**: Ajustes por tenant (idioma, moneda, módulos activos)

### Escandallos (Core Fase 1)
- **Productos y Ingredientes**: Gestión con multi-unidad (UC/UA/UR)
- **Recetas**: Sistema recursivo con sub-recetas anidadas
- **Menús y Cartas**: Composición dinámica con drag&drop
- **Costeos**: Motor de cálculo automático con precios netos
- **Fichas Técnicas**: Generación parametrizada en PDF

### Seguridad
- **Alérgenos**: Trazabilidad automática cascada (UE 1169/2011)
- **APPCC**: Controles sanitarios obligatorios
- **Alertas**: Sistema de detección de conflictos

### Producción
- **Partidas de Trabajo**: Organización por zonas de cocina
- **Órdenes de Producción**: Guías de mise en place
- **Hojas de Pedido**: Clasificación por proveedor/zona

### Almacenes
- **Gestión de Stock**: Entradas, salidas e inventarios
- **Alertas**: Sistema de aviso de stock bajo
- **Comparación**: Teórico vs real

### Sala (Módulo QR)
- **Carta Digital QR**: Landing pages personalizadas
- **Branding**: Logotipos, colores corporativos
- **Filtros**: Alérgenos interactivos en tiempo real

### Ingesta Omnicanal
- **Bot Telegram**: Webhooks seguros para fotos de documentos
- **OCR + IA**: Procesamiento inteligente de albaranes
- **Queue de Procesamiento**: Sistema asíncrono de análisis

### Conocimiento
- **Wiki de Procedimientos**: Base de conocimiento interno
- **Roadmap Tracker**: Sistema de seguimiento de desarrollo

## Flujo de Arquitectura

### 1. Solicitud del Cliente
```
Frontend (Next.js) → API Gateway → Backend (NestJS)
```

### 2. Verificación de Tenant
```
Middleware Tenant Check → Validación del tenant → Aislamiento de contexto
```

### 3. Procesamiento de Negocio
```
Controller → Service → Prisma (PostgreSQL) → Response
```

### 4. Multi-idioma
```
next-intl → Traducciones en JSON → UI localizada
```

### 5. Seguridad
```
Lucia Auth → Validación de permisos → API protegida
```

## Patrones de Diseño

### Multi-tenancy Estricto
- Cada tenant tiene su propio contexto de datos
- Middleware de tenant en todas las rutas API
- Aislamiento físico y lógico de información

### API-First
- API desarrollada primero, frontend consume después
- Contratos estables y documentados
- Versionado de endpoints para compatibilidad

### Componentización Modular
- Módulos independientes con funciones específicas
- Activación dinámica según suscripción
- Monetización por módulo activo

### TipTap JSON
- Contenido enriquecido almacenado como JSON estructurado
- Soporte para traducciones automatizadas
- Manipulación limpia de datos de negocio

## Tecnologías Clave

- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js 16.2.6 (React)
- **Database**: PostgreSQL (Prisma ORM)
- **Auth**: Lucia Auth + Prisma
- **Editor**: TipTap (JSON estructurado)
- **Styling**: Tailwind CSS
- **i18n**: next-intl
- **API**: RESTful con NestJS