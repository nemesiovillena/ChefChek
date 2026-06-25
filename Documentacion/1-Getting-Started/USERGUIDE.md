# ChefChek - Guía de Usuario

## Table of Contents

1. [Introducción](#introducción)
2. [Dashboard Principal](#dashboard-principal)
3. [Módulos Principales](#módulos-principales)
4. [Gestión de Usuarios](#gestión-de-usuarios)
5. [Configuración del Sistema](#configuración-del-sistema)

---

## Introducción

ChefChek es una plataforma SaaS diseñada para cocinas profesionales que proporciona herramientas integrales para gestión de inventario, recetas, producción, y cumplimiento APPCC.

### Navegación Principal

- **Sidebar izquierdo**: Acceso rápido a todos los módulos
- **Barra superior**: Información de usuario, cambio de tenant, notificaciones
- **Área de contenido**: Páginas y funcionalidades específicas

---

## Dashboard Principal

El dashboard proporciona una visión general de las operaciones de cocina:

### KPIs Principales
- **Órdenes Activas**: Número de órdenes en preparación
- **Stock Alertas**: Productos con bajo inventario
- **Tareas Pendientes**: Tareas de producción sin asignar
- **Progreso**: Porcentaje de completitud de objetivos

### Gráficos y Análisis
- Producción diaria/semanal/mensual
- Tendencias de costos
- Cumplimiento de controles

---

## Módulos Principales

### 1. Productos

#### Gestión de Inventario
- **Ver productos**: Lista completa con stock actual
- **Crear producto**: Agregar nuevos items al inventario
- **Editar detalles**: Modificar precios, proveedores, unidades
- **Stock movements**: Registrar entradas y salidas

#### Almacenes
- Crear y gestionar almacenes
- Definir ubicaciones y capacidades
- Asignar productos a ubicaciones

### 2. Recetas

#### Creación de Recetas
1. Ir a **Recetas** → **Crear Receta**
2. Completar información básica:
   - Nombre y descripción
   - Porciones y tamaño
   - Categorías
3. Agregar ingredientes:
   - Seleccionar productos del inventario
   - Especificar cantidades y unidades
   - Costos se calculan automáticamente
4. Agregar instrucciones (texto enriquecido)
5. Guardar y publicar

#### Cálculo de Costos
- Los costos se calculan automáticamente de los ingredientes
- Ver escandallos detallados
- Comparar con presupuestos
- Análisis de variaciones

### 3. Menús

#### Creación de Menús
1. Ir a **Menús** → **Crear Menú**
2. Definir periodo de vigencia
3. Agregar recetas al menú
4. Configurar precios y márgenes
5. Generar menú digital con QR

#### QR Digital
- Generar códigos QR para cada menú
- Personalizar colores y diseños
- Seguir estadísticas de visualización
- Descargar e imprimir QR codes

### 4. Producción

#### Órdenes de Producción
- Crear órdenes de producción desde menús
- Asignar recetas y cantidades
- Programar fechas y horas
- Asignar personal

#### Lotes de Trabajo (Work Batches)
- Crear lotes de producción
- Agrupar órdenes relacionadas
- Seguimiento de progreso
- Gestionar dependencias

#### Tareas
- Asignar tareas a personal
- Seguir completitud
- Actualizar estados
- Reportar tiempos

### 5. APPCC

#### Controles de Temperatura
- Crear puntos de control
- Registrar mediciones
- Alertas automáticas fuera de rango
- Historial completo

#### Planes de Limpieza
- Crear planes de limpieza
- Definir frecuencias y responsables
- Seguir completitud
- Documentar evidencia

#### Control de Plagas
- Registrar tratamientos
- Programar controles
- Documentar productos usados
- Alertas de vencimiento

### 6. Inventario (Ingesta)

#### OCR AI
- Subir documentos (facturas, recibos)
- Reconocimiento automático de productos
- Validación y corrección
- Historial de documentos

#### Gestión de Stock
- Ver niveles de stock actuales
- Alertas de bajo inventario
- Solicitudes de reposición
- Análisis de consumo

### 7. Knowledge Base

#### Artículos
- Crear documentación de procesos
- Compartir mejores prácticas
- Búsqueda de artículos
- Categorización y etiquetas

### 8. Usuarios y Roles

#### Gestión de Usuarios
- Crear nuevos usuarios
- Asignar roles (ADMIN, USER, VIEWER)
- Gestionar permisos
- Activar/desactivar usuarios

#### Roles y Permisos
- **ADMIN**: Acceso completo a todas las funcionalidades
- **USER**: Crear y editar datos, ver reportes
- **VIEWER**: Solo lectura, ver información

---

## Gestión de Usuarios

### Cambiar Contraseña
1. Ir a perfil de usuario (esquina superior derecha)
2. Seleccionar "Configuración"
3. Hacer clic en "Cambiar contraseña"
4. Ingresar contraseña actual y nueva contraseña
5. Guardar cambios

### Perfil Personal
- Actualizar nombre y email
- Configurar preferencias
- Gestionar notificaciones
- Ver historial de actividad

---

## Configuración del Sistema

### Tenant Settings
- Configurar nombre y logo del tenant
- Definir zonas horarias
- Configurar moneda y formatos
- Gestionar notificaciones del sistema

### Alertas
- Configurar umbrales de stock
- Definir alertas de temperatura
- Configurar notificaciones por email
- Gestionar prioridades de alertas

### Integraciones
- Configurar API de Telegram
- Conectar sistemas externos
- Configurar webhooks
- Gestionar claves API

---

## Mejores Prácticas

### Gestión de Inventario
- Realizar inventarios físicos regularmente
- Configurar niveles de reorden
- Usar alertas de bajo stock
- Documentar movimientos

### Recetas y Costos
- Mantener recetas actualizadas
- Revisar costos mensualmente
- Usar escandallos para análisis
- Documentar variaciones

### APPCC
- Registrar controles diariamente
- Mantener documentación actualizada
- Revisar planes regularmente
- Capacitar al personal

### Producción
- Planificar producciones con anticipación
- Asignar tareas apropiadamente
- Monitorear tiempos reales
- Documentar desviaciones

---

## Solución de Problemas

### Problemas Comunes

#### Login Fallido
- Verificar credenciales correctas
- Comprobar nombre de tenant
- Limpiar caché del navegador
- Contactar administrador

#### Datos No Actualizándose
- Recargar la página
- Verificar conexión de red
- Comprobar estado del backend
- Revisar consola para errores

#### Alertas No Recibidas
- Verificar configuración de notificaciones
- Comprobar filtros de email
- Revisar permisos de usuario
- Verificar integraciones externas

### Soporte Técnico

Para problemas técnicos:
- Revisar logs del sistema
- Consultar documentación técnica
- Abrir ticket de soporte
- Contactar al equipo de desarrollo

---

## Atajos de Teclado

### Globales
- `Ctrl + K`: Búsqueda rápida
- `Ctrl + /`: Abrir comandos
- `Esc`: Cerrar modales

### Navegación
- `Alt + [1-9]`: Navegar a módulos principales
- `Ctrl + ←/→`: Navegar entre páginas
- `Ctrl + Shift + R`: Recargar página

### Formularios
- `Ctrl + Enter`: Guardar formulario
- `Ctrl + Shift + Enter`: Guardar y crear otro
- `Esc`: Cancelar cambios

---

## Actualizaciones y Novedades

ChefChek se actualiza regularmente con nuevas funcionalidades:
- Revisar registro de cambios
- Probar nuevas características en staging
- Reportar problemas y sugerencias
- Participar en beta testing

---

**¡Gracias por usar ChefChek!** 🍳