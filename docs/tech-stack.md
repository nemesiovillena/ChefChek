# Tech Stack - ChefChek

## Backend

### Framework
- **NestJS**: Framework progresivo Node.js para construir aplicaciones eficientes
- **TypeScript**: Tipado estático para mayor robustez del código
- **Express.js**: Motor HTTP subyacente de NestJS

### Database
- **PostgreSQL**: Base de datos relacional robusta para datos multi-tenant
- **Prisma ORM**: ORM moderno con migrations y schema definido en Prisma Schema
- **Multi-tenant Design**: Aislamiento estricto de datos por tenant

### Autenticación
- **Lucia Auth**: Sistema de autenticación basado en sesiones seguras
- **Prisma Session Manager**: Gestión de sesiones en PostgreSQL
- **Middleware de Tenant**: Verificación de tenant en cada request

### APIs & Comunicación
- **RESTful API**: Estándar REST para comunicación cliente-servidor
- **Type Safety**: DTOs con validación automática (class-validator)
- **CORS**: Configurado para Next.js frontend

## Frontend

### Framework
- **Next.js 16.2.6**: Framework React con SSR y App Router
- **React 18**: Biblioteca UI para interfaces interactivas
- **TypeScript**: Tipado estático para type-safety completo

### Estado & Datos
- **Next.js Server Actions**: Para mutaciones de servidor
- **React Query**: Para cache y sincronización de datos (a implementar)
- **Zustand**: Gestión de estado global (a implementar)

### Editor de Contenido
- **TipTap React**: Editor de texto enriquecido con JSON estructurado
- **StarterKit**: Extensiones básicas (formato, lista, alineación)
- **Extensiones**: Text-align, List-item, Underline, Text-style

### Styling & UI
- **Tailwind CSS**: Framework CSS utility-first
- **shadcn/ui**: Componentes reutilizables base (a implementar)
- **CSS Variables**: Design System centralizado
- **Responsive Design**: Mobile-first approach

### Internacionalización
- **next-intl**: Soporte multiidioma nativo
- **i18n Routing**: Rutas con slugs dinámicos por idioma
- **JSON Messages**: Traducciones en formato estructurado

## DevOps & Despliegue

### Version Control
- **Git**: Control de versiones distribuido
- **GitHub**: Hosting de código y releases
- **GitHub Actions**: CI/CD pipelines (a configurar)
- **Semantic Versioning**: Versionado desde el plan

### Testing
- **Jest**: Unit testing en backend (NestJS)
- **Vitest**: Unit testing en frontend (Next.js)
- **Playwright**: E2E testing (a implementar)

### Development
- **Node.js >=18.0.0**: Motor de ejecución
- **npm**: Gestión de dependencias
- **TypeScript 5.1.3**: Compilador TypeScript

## Seguridad

### Data Protection
- **Multi-tenant Isolation**: Aislamiento estricto de datos
- **Session-based Auth**: Lucia Auth con sesiones en DB
- **Input Validation**: DTOs con class-validator
- **SQL Injection Protection**: Prisma con parametrized queries

### Compliance
- **UE 1169/2011**: Cumplimiento de regulación alérgenos
- **APPCC**: Registro digital de controles sanitarios
- **GDPR Ready**: Manejo de datos personales por tenant

## Performance

### Backend
- **Prisma Queries**: Queries optimizados con índices
- **Connection Pooling**: Gestión eficiente de conexiones DB
- **Caching Estrategia**: Cache de sesiones y configuración (a implementar)

### Frontend
- **Server Components**: Next.js App Router con RSC
- **Code Splitting**: Carga optimizada de componentes
- **Image Optimization**: next/image para optimización automática

## Arquitectura Modular

### Backend Modules
- `core/`: Auth, tenants, users, roles
- `escandallos/`: Products, recipes, menus, costos
- `seguridad/`: Alérgenos, APPCC, controles
- `producción/`: Partidas, órdenes, hojas pedido
- `almacenes/`: Inventory, stock movements
- `sala/`: QR menus, branding
- `albaranes/`: Gestión, alta manual y upload de albaranes
- `ocr/`: Motor OCR/IA compartido (microservicio Python) para lectura de albaranes
- `conocimiento/`: Wiki, roadmap tracker

### Frontend Structure
- `app/`: Next.js App Router
- `components/`: Componentes reutilizables
- `lib/`: Utilidades y helpers
- `hooks/`: Custom React hooks
- `styles/`: Estilos globales
- `types/`: Definiciones TypeScript

## Compatibilidad

### Navegadores
- **Chrome/Edge**: Últimas 2 versiones mayores
- **Firefox**: Últimas 2 versiones mayores
- **Safari**: Últimas 2 versiones mayores
- **Mobile**: iOS Safari 14+, Chrome Mobile

### Deploydments
- **Development**: Localhost con hot-reload
- **Staging**: Vercel/Railway (a configurar)
- **Production**: Vercel/Railway con escalado horizontal

## Monitoreo y Logs

### Application Monitoring
- **Sentry**: Error tracking (a configurar)
- **APM**: Performance monitoring (a configurar)
- **Uptime Monitoring**: Health checks (a implementar)

### Logging
- **Winston**: Logging estructurado (a implementar)
- **Structured Logs**: JSON logs para análisis
- **Log Levels**: Debug, Info, Warn, Error, Fatal