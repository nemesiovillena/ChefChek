# ChefChek - Documentación Completa del Proyecto

**Bienvenido a la documentación centralizada de ChefChek.** Este directorio contiene toda la documentación técnica, arquitectónica y de usuario para el sistema de gestión de cocinas profesionales.

---

## 📚 Estructura de Documentación

### 🚀 **1-Getting-Started/** 
Documentación inicial para comenzar con el proyecto.

- [QUICKSTART.md](./1-Getting-Started/QUICKSTART.md) - Guía rápida de inicio
- [USERGUIDE.md](./1-Getting-Started/USERGUIDE.md) - Guía de usuario principal
- [PROJECT-README.md](./1-Getting-Started/PROJECT-README.md) - README del proyecto

### 🏗️ **2-Architecture/** 
Documentación arquitectónica del sistema.

- [system-architecture.md](./2-Architecture/system-architecture.md) - Arquitectura general del sistema
- [dashboard-architecture.md](./2-Architecture/dashboard-architecture.md) - Arquitectura de dashboards
- [appcc-system-architecture.md](./2-Architecture/appcc-system-architecture.md) - Arquitectura sistema APPCC
- [digital-menu-architecture.md](./2-Architecture/digital-menu-architecture.md) - Arquitectura menús digitales
- [multi-tenancy-architecture.md](./2-Architecture/multi-tenancy-architecture.md) - Arquitectura multi-tenant

### 🔌 **3-API/** 
Documentación de endpoints y API.

- [api-documentation.md](./3-API/api-documentation.md) - Documentación completa de API
- [api-endpoints-auth.md](./3-API/api-endpoints-auth.md) - Endpoints de autenticación

### ⚙️ **4-Systems/** 
Documentación de sistemas específicos del proyecto.

**Sistemas Principales:**
- [authentication-flow.md](./4-Systems/authentication-flow.md) - Flujo de autenticación
- [authorization-model.md](./4-Systems/authorization-model.md) - Modelo de autorización
- [inventory-control-architecture.md](./4-Systems/inventory-control-architecture.md) - Control de inventario
- [production-control-system.md](./4-Systems/production-control-system.md) - Sistema de producción
- [stock-alert-system.md](./4-Systems/stock-alert-system.md) - Sistema de alertas stock

**Sistemas Especializados:**
- [allergen-filter-system.md](./4-Systems/allergen-filter-system.md) - Filtro alérgenos
- [allergen-conflict-detection.md](./4-Systems/allergen-conflict-detection.md) - Detección conflictos alérgenos
- [allergen-propagation-system.md](./4-Systems/allergen-propagation-system.md) - Propagación alérgenos
- [appcc-compliance-reporting.md](./4-Systems/appcc-compliance-reporting.md) - Reportes APPCC
- [alert-notification-system.md](./4-Systems/alert-notification-system.md) - Sistema alertas

**Sistemas Avanzados:**
- [digital-qr-menu-system.md](./4-Systems/digital-qr-menu-system.md) - Sistema menú QR
- [file-ingestion-queue.md](./4-Systems/file-ingestion-queue.md) - Cola ingestión archivos
- [backup-recovery.md](./4-Systems/backup-recovery.md) - Backup y recuperación
- [ai-extraction-system.md](./4-Systems/ai-extraction-system.md) - Sistema IA extracción
- [automated-order-system.md](./4-Systems/automated-order-system.md) - Sistema pedidos automatizado

**Más Sistemas:**
- [cascade-cost-recalculation.md](./4-Systems/cascade-cost-recalculation.md) - Recálculo costos
- [conservation-zone-mapping.md](./4-Systems/conservation-zone-mapping.md) - Mapeo zonas
- [cost-engine-algorithm.md](./4-Systems/cost-engine-algorithm.md) - Motor costes
- [cost-calculation-rules.md](./4-Systems/cost-calculation-rules.md) - Reglas cálculo
- [knowledge-management.md](./4-Systems/knowledge-management.md) - Gestión conocimiento
- [kpi-calculation-system.md](./4-Systems/kpi-calculation-system.md) - Cálculo KPIs

**Sistemas Operativos:**
- [menu-composition-system.md](./4-Systems/menu-composition-system.md) - Composición menús
- [mise-en-place-management.md](./4-Systems/mise-en-place-management.md) - Gestión mise-en-place
- [multi-lingual-menu-system.md](./4-Systems/multi-lingual-menu-system.md) - Menús multilingües
- [multi-unit-system.md](./4-Systems/multi-unit-system.md) - Sistema multi-unidad
- [procedure-organization.md](./4-Systems/procedure-organization.md) - Organización procedimientos

**Sistemas Técnicos:**
- [recursive-recipe-system.md](./4-Systems/recursive-recipe-system.md) - Recetas recursivas
- [sanitary-control-procedures.md](./4-Systems/sanitary-control-procedures.md) - Control sanitario
- [supplier-classification.md](./4-Systems/supplier-classification.md) - Clasificación proveedores
- [technical-sheet-generation.md](./4-Systems/technical-sheet-generation.md) - Fichas técnicas
- [tiptap-integration.md](./4-Systems/tiptap-integration.md) - Integración Tiptap
- [ue-1169-2011-compliance.md](./4-Systems/ue-1169-2011-compliance.md) - Normativa UE

**Sistemas OCR & Específicos:**
- [ocr-implementation-guide.md](./4-Systems/ocr-implementation-guide.md) - Guía implementación OCR ⭐
- [ocr-engine-architecture.md](./4-Systems/ocr-engine-architecture.md) - Arquitectura motor OCR

**Sistemas de Coordinación:**
- [sprint-tracker-architecture.md](./4-Systems/sprint-tracker-architecture.md) - Seguimiento sprints
- [task-management-system.md](./4-Systems/task-management-system.md) - Gestión tareas
- [team-coordination.md](./4-Systems/team-coordination.md) - Coordinación equipos
- [telegram-bot-architecture.md](./4-Systems/telegram-bot-architecture.md) - Bot Telegram
- [warehouse-management-system.md](./4-Systems/warehouse-management-system.md) - Gestión almacén
- [webhook-security-system.md](./4-Systems/webhook-security-system.md) - Seguridad webhooks
- [work-batch-architecture.md](./4-Systems/work-batch-architecture.md) - Arquitectura batches
- [wiki-system-architecture.md](./4-Systems/wiki-system-architecture.md) - Sistema wiki
- [template-system-architecture.md](./4-Systems/template-system-architecture.md) - Sistema plantillas
- [qr-generation-architecture.md](./4-Systems/qr-generation-architecture.md) - Generación QR

### 📖 **5-Guides/** 
Guías de usuario y técnicos.

- [user-guides.md](./5-Guides/user-guides.md) - Guías de usuario

### 💻 **6-Development/** 
Documentación para desarrolladores.

- [code-standards.md](./6-Development/code-standards.md) - Estándares de código
- [codebase-summary.md](./6-Development/codebase-summary.md) - Resumen del código
- [database-schema.md](./6-Development/database-schema.md) - Esquema de base de datos
- [tech-stack.md](./6-Development/tech-stack.md) - Stack tecnológico
- [product-data-model.md](./6-Development/product-data-model.md) - Modelo de datos productos
- [recipe-data-model.md](./6-Development/recipe-data-model.md) - Modelo de datos recetas

### 🚀 **7-Deployment/** 
Documentación de despliegue y configuración.

- [deployment-guide.md](./7-Deployment/deployment-guide.md) - Guía de despliegue
- [deployment-checklist.md](./7-Deployment/deployment-checklist.md) - Checklist despliegue
- [DEPLOYMENTSTRATEGY.md](./7-Deployment/DEPLOYMENTSTRATEGY.md) - Estrategia despliegue
- [configuration-guide.md](./7-Deployment/configuration-guide.md) - Guía de configuración

### 📋 **8-Projects/** 
Documentación de proyectos específicos y PDRs.

- [plan-maestro.md](./8-Projects/plan-maestro.md) - Plan maestro del proyecto
- [pdr-articulos-cards-dashboard.md](./8-Projects/pdr-articulos-cards-dashboard.md) - PDR dashboard artículos
- [pdr-articulos-mindchef-redesign.md](./8-Projects/pdr-articulos-mindchef-redesign.md) - PDR rediseño MindChef
- [pdr-ocr-accuracy-testing.md](./8-Projects/pdr-ocr-accuracy-testing.md) - PDR testing precisión OCR
- [project-changelog.md](./8-Projects/project-changelog.md) - Changelog del proyecto
- [design.md](./8-Projects/design.md) - Documentación de diseño

---

## 🎯 **Documentación Reciente/Actualizada**

### **OCR Implementation** ⭐
- [ocr-implementation-guide.md](./4-Systems/ocr-implementation-guide.md) - Guía completa implementación OCR Python
- **Estado:** 100% completo (desarrollo)
- **Última actualización:** 16 Jun 2026

### **Dashboard Artículos**
- [pdr-articulos-cards-dashboard.md](./8-Projects/pdr-articulos-cards-dashboard.md) - Dashboard de artículos
- **Última actualización:** 11 Jun 2026

### **Testing OCR**
- [pdr-ocr-accuracy-testing.md](./8-Projects/pdr-ocr-accuracy-testing.md) - Testing precisión OCR
- **Última actualización:** 15 Jun 2026

---

## 🔍 **Cómo Usar esta Documentación**

### **Para Desarrolladores**
1. Empezar en **[1-Getting-Started/**](./1-Getting-Started/)
2. Revisar **[2-Architecture/**](./2-Architecture/) para entender el sistema
3. Consultar **[3-API/**](./3-API/) para integraciones
4. Usar **[6-Development/**](./6-Development/) para estándares

### **Para Usuarios Finales**
1. Leer **[1-Getting-Started/**](./1-Getting-Started/) - QuickStart y UserGuide
2. Consultar **[5-Guides/**](./5-Guides/) para guías detalladas

### **Para DevOps/SysAdmin**
1. Revisar **[7-Deployment/**](./7-Deployment/) - Guías de despliegue
2. Consultar **[4-Systems/**](./4-Systems/) - Sistemas específicos

### **Para Project Managers**
1. Revisar **[8-Projects/**](./8-Projects/) - PDRs y planes
2. Consultar **[2-Architecture/**](./2-Architecture/) para decisiones técnicas

---

## 📊 **Estadísticas de Documentación**

- **Total de documentos:** 71 archivos
- **Categorías:** 8 principales
- **Estado:** Organizado y actualizado
- **Última actualización:** Junio 2026

---

## 🔄 **Mantenimiento de Documentación**

Esta documentación se mantiene actualizada con:
- Nuevas características y funcionalidades
- Cambios arquitectónicos
- Actualizaciones de API
- Guías de usuario mejoradas
- Proyectos específicos (PDRs)

---

## 📞 **Soporte**

Para preguntas sobre documentación específica:
1. Revisar el archivo correspondiente
2. Consultar el **[project-changelog.md](./8-Projects/project-changelog.md)** para cambios recientes
3. Contactar al equipo de desarrollo ChefChek

---

**Última actualización:** 16 Jun 2026  
**Versión:** 2.0  
**Estado:** ✅ Documentación completa y organizada