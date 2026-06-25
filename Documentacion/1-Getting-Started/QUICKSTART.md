# ChefChek - Guía de Inicio Rápido

## Bienvenido a ChefChek

ChefChek es una plataforma SaaS integral para gestión de cocina profesional que incluye control de inventario, recetas, producción, APPCC, y mucho más.

## Requisitos Previos

- Node.js 18+ para desarrollo
- PostgreSQL 14+ para base de datos
- npm o yarn para gestión de paquetes
- Git para control de versiones

## Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/chefchek.git
cd chefchek
```

### 2. Backend - Configuración

```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno en .env
npx prisma generate
npx prisma db seed
npm run start:dev
```

Backend ejecutará en: `http://localhost:3001`

### 3. Frontend - Configuración

```bash
cd frontend
npm install
cp .env.example .env.local
# Configurar variables de entorno
npm run dev
```

Frontend ejecutará en: `http://localhost:3000`

### 4. Primer Login

1. Navegar a `http://localhost:3000/login`
2. Usar credenciales por defecto:
   - Email: `admin@chefchek.local`
   - Password: `admin123`
   - Tenant: `chefchek-demo`

## Características Principales

### Gestión de Inventario
- Seguimiento de stock en tiempo real
- Alertas de bajo stock
- Gestión de almacenes y ubicaciones
- Historial de movimientos

### Recetas y Costos
- Editor de recetas con texto enriquecido
- Cálculo automático de costos
- Escandallos detallados
- Análisis de variación de precios

### Producción
- Órdenes de producción
- Asignación de tareas
- Seguimiento de progreso
- Mise en place

### APPCC y Cumplimiento
- Controles de temperatura
- Planes de limpieza
- Control de plagas
- Alertas y notificaciones

### OCR AI
- Reconocimiento de productos desde documentos
- Procesamiento automático de facturas
- Clasificación inteligente

## Soporte

Para soporte técnico, preguntas, o problemas:
- Email: support@chefchek.com
- Documentación: [docs/](./)
- Issues: [GitHub Issues](https://github.com/tu-usuario/chefchek/issues)

## Próximos Pasos

- Explorar los módulos disponibles en el dashboard
- Configurar tu tenant y usuarios
- Importar datos existentes
- Configurar alertas y notificaciones

¡Disfruta de ChefChek! 🍳