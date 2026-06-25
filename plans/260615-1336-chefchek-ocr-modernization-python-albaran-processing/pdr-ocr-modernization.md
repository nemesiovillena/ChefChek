# PDR: Modernización OCR ChefChek - Procesamiento de Albaranes con Python

**Proyecto:** ChefChek  
**Fecha:** 2026-06-15  
**Versión:** 1.0  
**Estado:** Borrador

## Resumen Ejecutivo

Reemplazar el OCR Tesseract.js poco fiable con una solución basada en Python usando PaddleOCR, OpenCV, pdf2image e integración con LLM. Objetivo: >90% de precisión en albaranes reales con validación inteligente y escalado human-in-the-loop.

**Impacto de Negocio:** Reducir entrada manual de datos en un 60%, mejorar velocidad de procesamiento 3x, eliminar tickets de soporte relacionados con OCR.

## Declaración del Problema

### Problemas Actuales
- Precisión Tesseract.js: 70-80% en albaranes reales
- Manejo deficiente de texto manuscrito, imágenes rotadas, escaneos de baja calidad
- Sin pre-procesamiento o mejora de imágenes
- Validación básica (solo umbral de confianza)
- Sin transformación de datos estructurados
- Alta tasa de revisión manual (80%+ de documentos)

### Impacto en Usuarios
- El personal pierde 2-3 horas/día corrigiendo errores de OCR
- Actualizaciones de stock retrasadas por cuello de botella de revisión manual
- Frustración con mala calidad de OCR afecta adopción
- Incapacidad para procesar altos volúmenes en periodos pico

## Requisitos Técnicos

### Requisitos Funcionales
1. **Pre-procesamiento de Imágenes**
   - Conversión PDF a imagen (300 DPI)
   - Normalización escala de grises
   - Mejora de contraste (CLAHE)
   - Detección y corrección de orientación
   - Reducción de ruido y binarización

2. **Procesamiento OCR**
   - Soporte multiidioma (Español + Inglés)
   - Detección y reconocimiento de texto
   - Puntuación de confianza por línea/palabra
   - Análisis de diseño (tablas, encabezados, pies)

3. **Extracción de Datos Estructurados**
   - Extracción de nombre de proveedor
   - Parseo de fecha (múltiples formatos)
   - Parseo de líneas de producto (nombre, cantidad, unidad, precio)
   - Cálculo y validación de total
   - Normalización de unidades (kg, g, l, ml, ud)

4. **Pipeline de Validación**
   - Validación estructural (sumas, completitud)
   - Validación de confianza (umbrales multinivel)
   - Validación semántica (basada en LLM)
   - Validación de reglas de negocio (cambios de precio, coincidencia de proveedor)

5. **Human-in-the-Loop**
   - Auto-aprobado inteligente para documentos de alta confianza (≥90%)
   - Interfaz de revisión para documentos de confianza media (70-90%)
   - Escalado administrativo para documentos de baja confianza (<70%)
   - Indicadores de confianza en tiempo real

### Requisitos No Funcionales
- **Precisión**: >90% en albaranes reales
- **Rendimiento**: <10 segundos por documento
- **Fiabilidad**: 99.5% uptime, degradación elegante
- **Escalabilidad**: Manejar 10+ trabajos OCR concurrentes
- **Coste**: <$10/mes total (API OpenAI)
- **Seguridad**: Cumplimiento GDPR, procesamiento de datos en UE

## Diseño de Arquitectura

### Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
│  - Cajón de Subida de Albaranes (mejorado)                 │
│  - Revisión de Resultados OCR (auto-aprobado inteligente)   │
│  - Interfaz de Escalado Administrativo                     │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────────────────────────┐
│              ORCHESTRATOR BACKEND (NestJS)                  │
│  - Subida y validación de archivos                          │
│  - Gestión de colas (Redis + RQ)                            │
│  - Lógica de negocio y operaciones de base de datos        │
│  - Integración con productos/proveedores existentes        │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/gRPC
┌──────────────────▼──────────────────────────────────────────┐
│            MICROSERVICIO OCR PYTHON (FastAPI)               │
│  Pre-procesamiento → OCR → LLM → Validación → Datos        │
│  Estructurados                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                  BASE DE DATOS (Prisma)                     │
│  - Estado de procesamiento de documentos                   │
│  - Resultados de validación                                │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Componente | Tecnología | Razón |
|------------|------------|-------|
| Motor OCR | PaddleOCR | Precisión 95%+, multiidioma, gratuito |
| Framework Web | FastAPI | Async, type-safe, auto-docs |
| Procesamiento de Imágenes | OpenCV + Pillow | Estándar industria, potente |
| Conversión PDF | pdf2image | Fiable, mantiene calidad |
| LLM | OpenAI GPT-4o-mini | Rápido, barato, excelente extracción |
| Sistema de Colas | Redis + RQ | Simple, fiable, async |
| Integración | HTTP/REST | Límites limpios, fácil depuración |

## Plan de Implementación

### Fase 1: Fundamentos y Prueba de Concepto (Semana 1-2)

**Objetivos:**
- Validar precisión PaddleOCR en albaranes reales
- Construir microservicio Python básico
- Implementar pipeline de pre-procesamiento

**Tareas:**

1. **Configuración de Entorno**
   - [ ] Crear entorno virtual Python
   - [ ] Instalar FastAPI, OpenCV, PaddleOCR, pdf2image
   - [ ] Configurar estructura del proyecto
   - [ ] Configurar entorno de desarrollo

2. **Pipeline de Pre-procesamiento**
   - [ ] Implementar conversión PDF a imagen
   - [ ] Añadir normalización escala de grises
   - [ ] Implementar mejora de contraste CLAHE
   - [ ] Añadir detección y corrección de orientación
   - [ ] Implementar binarización umbral adaptativo

3. **Integración OCR**
   - [ ] Integrar PaddleOCR para reconocimiento de texto
   - [ ] Configurar modelos Español + Inglés
   - [ ] Implementar puntuación de confianza
   - [ ] Añadir análisis de diseño

4. **Endpoints API Básicos**
   - [ ] `POST /ocr/image` - Procesar imagen individual
   - [ ] `POST /ocr/pdf` - Procesar documento PDF
   - [ ] `GET /health` - Endpoint de health check
   - [ ] Añadir manejo de errores y logging

5. **Pruebas y Validación**
   - [ ] Probar con 10 albaranes reales
   - [ ] Medir mejora de precisión vs Tesseract.js
   - [ ] Benchmark de tiempo de procesamiento
   - [ ] Documentar hallazgos

**Checkpoints:**
- ✅ Precisión PaddleOCR > 90% en conjunto de prueba
- ✅ Pre-procesamiento mejora precisión en 15%+
- ✅ Tiempo de procesamiento end-to-end < 5 segundos por página
- ✅ Todos los endpoints funcionales y documentados

**Entregables:**
- Microservicio OCR Python funcional
- Implementación de pipeline de pre-procesamiento
- Reporte de benchmark de precisión
- Documentación API

---

### Fase 2: Validación y Datos Estructurados (Semana 2-3)

**Objetivos:**
- Construir pipeline de validación multicapa
- Integrar LLM para transformación de datos estructurados
- Implementar puntuación de confianza

**Tareas:**

1. **Validación Estructural**
   - [ ] Implementar validación de conteo de líneas
   - [ ] Añadir verificación de suma total (tolerancia ±5%)
   - [ ] Validar presencia de campos requeridos
   - [ ] Añadir validación de tipos de datos

2. **Validación de Confianza**
   - [ ] Implementar umbral de confianza a nivel de documento (>0.7)
   - [ ] Añadir validación de confianza a nivel de producto (>0.6)
   - [ ] Crear umbrales de confianza por campo
   - [ ] Marcar campos de baja confianza para revisión

3. **Integración LLM**
   - [ ] Configurar integración API OpenAI
   - [ ] Implementar ingeniería de prompts para extracción de campos
   - [ ] Añadir transformación de datos estructurados
   - [ ] Crear lógica de parseo de líneas de producto
   - [ ] Implementar normalización de unidades

4. **Modelos de Datos y DTOs**
   - [ ] Crear modelo ExtractedDocument
   - [ ] Definir modelo ExtractedProduct
   - [ ] Implementar modelo ValidationResult
   - [ ] Añadir estructuras de puntuación de confianza

5. **Manejo de Errores**
   - [ ] Implementar degradación elegante
   - [ ] Añadir lógica de reintentos para OCR fallido
   - [ ] Crear mecanismos de fallback
   - [ ] Añadir logging comprehensivo

**Checkpoints:**
- ✅ Validación reduce falsos positivos en 30%+
- ✅ LLM extrae correctamente 95% de campos estructurados
- ✅ Manejo de errores previene bloqueos del sistema
- ✅ Todas las capas de validación funcionales

**Entregables:**
- Pipeline de validación multicapa
- Integración LLM con extracción de campos
- Modelos de datos estructurados
- Documentación de manejo de errores

---

### Fase 3: Integración NestJS (Semana 3-4)

**Objetivos:**
- Integrar microservicio OCR Python con backend NestJS existente
- Implementar procesamiento asíncrono basado en colas
- Mantener compatibilidad hacia atrás

**Tareas:**

1. **Integración de Cliente HTTP**
   - [ ] Crear cliente de servicio OCR en NestJS
   - [ ] Implementar manejo de errores y reintentos
   - [ ] Añadir configuraciones de timeout
   - [ ] Crear lógica de parseo de respuestas

2. **Migración de Sistema de Colas**
   - [ ] Configurar servidor Redis
   - [ ] Instalar y configurar RQ
   - [ ] Reemplazar cola Bull con RQ
   - [ ] Implementar programación y priorización de trabajos
   - [ ] Añadir seguimiento de estado de trabajos

3. **Actualizaciones de Base de Datos**
   - [ ] Actualizar modelo Document con campos de validación
   - [ ] Añadir columnas de puntuación de confianza
   - [ ] Crear tablas de resultados de validación
   - [ ] Implementar scripts de migración

4. **Integración de Lógica de Negocio**
   - [ ] Actualizar flujo de procesamiento de ingest
   - [ ] Integrar con servicio de reconocimiento de productos
   - [ ] Conectar con gestión de proveedores
   - [ ] Actualizar lógica de gestión de stock

5. **Compatibilidad Hacia Atrás**
   - [ ] Mantener Tesseract.js como fallback
   - [ ] Implementar feature flags
   - [ ] Añadir capacidades de testing A/B
   - [ ] Crear ruta de migración

**Checkpoints:**
- ✅ Integración NestJS → Python funciona end-to-end
- ✅ Procesamiento de colas maneja 10+ trabajos concurrentes
- ✅ Compatibilidad hacia atrás mantenida
- ✅ Todas las características existentes funcionan con nuevo OCR

**Entregables:**
- Backend NestJS integrado
- Sistema de colas Redis + RQ
- Esquema de base de datos actualizado
- Documentación de migración

---

### Fase 4: Human-in-the-Loop Mejorado (Semana 4-5)

**Objetivos:**
- Implementar lógica de auto-aprobado inteligente
- Crear interfaz de escalado para documentos de baja confianza
- Añadir analíticas y bucle de feedback

**Tareas:**

1. **Lógica de Auto-aprobado Inteligente**
   - [ ] Implementar enrutamiento basado en confianza
   - [ ] Crear motor de reglas de auto-aprobado
   - [ ] Añadir seguimiento de precisión histórica
   - [ ] Implementar ajuste dinámico de umbrales

2. **Mejoras de Frontend**
   - [ ] Actualizar albaran-upload-drawer con auto-aprobado
   - [ ] Añadir indicadores de confianza en tiempo real
   - [ ] Crear interfaz de escalado administrativo
   - [ ] Implementar UI de procesamiento por lotes

3. **Analíticas y Monitoreo**
   - [ ] Crear dashboard de seguimiento de precisión
   - [ ] Añadir analíticas de calibración de confianza
   - [ ] Implementar monitoreo de tiempo de procesamiento
   - [ ] Crear seguimiento de tasa de errores

4. **Bucle de Feedback**
   - [ ] Implementar captura de correcciones de usuario
   - [ ] Añadir feedback a prompts de LLM
   - [ ] Crear pipeline de mejora de precisión
   - [ ] Documentar patrones de comportamiento de usuario

5. **Documentación y Entrenamiento**
   - [ ] Crear guía de usuario para nuevo sistema OCR
   - [ ] Escribir documentación de administrador
   - [ ] Crear guía de solución de problemas
   - [ ] Realizar sesiones de entrenamiento de personal

**Checkpoints:**
- ✅ Tasa de revisión manual < 40% de documentos
- ✅ Documentos de alta confianza auto-aprobados 100%
- ✅ Feedback de usuario mejora precisión del sistema
- ✅ Toda la documentación completa

**Entregables:**
- Frontend mejorado con auto-aprobado inteligente
- Dashboard de analíticas
- Interfaz de escalado administrativo
- Suite de documentación completa

---

## Criterios de Éxito

### Métricas Técnicas
- ✅ Precisión OCR > 90% en albaranes reales
- ✅ Pre-procesamiento mejora precisión en 15%+
- ✅ Validación reduce falsos positivos en 30%+
- ✅ Tiempo de procesamiento end-to-end < 10 segundos
- ✅ Uptime del sistema 99.5%+

### Métricas de Negocio
- ✅ Tasa de revisión manual < 40% de documentos
- ✅ Mejora de velocidad de procesamiento 3x
- ✅ Puntuación de satisfacción de usuario > 4.5/5
- ✅ Tickets de soporte relacionados con OCR reducidos en 80%

### Métricas de Coste
- ✅ Coste mensual total <$10 (API OpenAI)
- ✅ Aumento de coste de infraestructura <$20/mes
- ✅ ROI logrado dentro de 3 meses

## Evaluación de Riesgos

| Riesgo | Impacto | Probabilidad | Estrategia de Mitigación |
|--------|---------|-------------|------------------------|
| Precisión PaddleOCR < 85% | Alto | Bajo | Testing POC antes de compromiso, fallback a Tesseract.js |
| Problemas de despliegue Python | Medio | Medio | Contenedorización Docker, testing comprehensivo |
| Costes API LLM exceden presupuesto | Bajo | Bajo | Monitoreo de uso, caching, alertas de coste |
| Integración rompe flujo de trabajo existente | Alto | Bajo | Mantener compatibilidad hacia atrás, feature flags |
| Degradación de rendimiento | Medio | Bajo | Testing de carga, optimización, escalado horizontal |
| Preocupaciones de privacidad de datos | Alto | Bajo | Procesamiento de datos en UE, cumplimiento GDPR, anonimización |

## Estrategia de Pruebas

### Pruebas Unitarias
- Componentes de pipeline de pre-procesamiento
- Mediciones de precisión OCR
- Lógica de validación
- Efectividad de prompts LLM

### Pruebas de Integración
- Comunicación NestJS → Python OCR
- Flujos de trabajo de procesamiento de colas
- Operaciones de base de datos
- Procesamiento end-to-end de documentos

### Pruebas de Rendimiento
- Testing de carga con 100+ documentos concurrentes
- Perfilado de uso de memoria
- Benchmarks de tiempo de procesamiento
- Testing de escalabilidad

### Pruebas de Aceptación de Usuario
- Albaranes reales de operaciones diarias
- Testing multiusuario
- Escenarios edge cases
- Recolección de feedback

## Estrategia de Despliegue

### Entorno de Desarrollo
- Configuración de desarrollo local
- Contenedores Docker para aislamiento
- Datos mock para testing
- Configuración de integración continua

### Entorno de Staging
- Configuración similar a producción
- Albaranes reales para testing
- Monitoreo de rendimiento
- Testing de aceptación de usuario

### Despliegue en Producción
- Despliegue blue-green
- Rollout gradual de tráfico (10% → 50% → 100%)
- Monitoreo en tiempo real
- Plan de rollback

## Monitoreo y Mantenimiento

### Métricas Clave
- Tasa de precisión OCR
- Tiempo de procesamiento
- Tasa de errores
- Tasa de revisión de usuario
- Uptime del sistema

### Alertas
- Precisión OCR cae por debajo de 85%
- Tiempo de procesamiento excede 15 segundos
- Tasa de errores excede 5%
- Tiempo de inactividad del sistema

### Tareas de Mantenimiento
- Revisiones semanales de precisión
- Optimización mensual de rendimiento
- Refinamiento trimestral de prompts LLM
- Evaluación anual de stack tecnológico

## Cronograma

| Fase | Duración | Fecha Inicio | Fecha Fin | Estado |
|-------|----------|--------------|-----------|--------|
| Fase 1: Fundamentos | 2 semanas | 2026-06-15 | 2026-06-29 | No Iniciado |
| Fase 2: Validación | 1 semana | 2026-06-29 | 2026-07-06 | No Iniciado |
| Fase 3: Integración | 1 semana | 2026-07-06 | 2026-07-13 | No Iniciado |
| Fase 4: Mejoras | 1 semana | 2026-07-13 | 2026-07-20 | No Iniciado |
| Testing y Lanzamiento | 1 semana | 2026-07-20 | 2026-07-27 | No Iniciado |

**Duración Total:** 6 semanas

## Recursos

### Equipo de Desarrollo
- Desarrollador Backend (NestJS + Python)
- Desarrollador Frontend (React)
- Ingeniero DevOps (Despliegue + Infraestructura)
- Ingeniero QA (Testing + Validación)

### Infraestructura
- Servidor de desarrollo (8 CPU, 16GB RAM)
- Entorno de staging
- Entorno de producción
- Herramientas de monitoreo (Prometheus, Grafana)

### Presupuesto
- Desarrollo: $0 (equipo interno)
- Infraestructura: $20/mes (servidor adicional)
- API OpenAI: $5-10/mes
- **Total: $25-30/mes recurrentes**

## Próximos Pasos

1. **Acciones Inmediatas (Esta Semana)**
   - Aprobar PDR y asegurar recursos
   - Configurar entorno de desarrollo
   - Comenzar implementación Fase 1

2. **Corto Plazo (Próximas 2 Semanas)**
   - Completar Fase 1 (Fundamentos)
   - Iniciar Fase 2 (Validación)
   - Realizar testing inicial de precisión

3. **Mediano Plazo (Próximas 4 Semanas)**
   - Completar Fase 2-4
   - Testing de integración
   - Testing de aceptación de usuario

4. **Largo Plazo (Post-Lanzamiento)**
   - Monitorear métricas de rendimiento
   - Recolección de feedback de usuario
   - Mejora continua

## Apéndice

### A. Análisis del Sistema Actual
- Implementación OCR existente: Tesseract.js
- Precisión actual: 70-80%
- Tiempo de procesamiento: 15-30 segundos por documento
- Tasa de revisión manual: 80%+

### B. Comparación de Tecnologías
| Motor OCR | Precisión | Velocidad | Coste | Complejidad |
|------------|-----------|-----------|-------|-------------|
| Tesseract.js | 70-80% | Lento | Gratis | Baja |
| PaddleOCR | 90-95% | Rápido | Gratis | Media |
| Rossum | 95%+ | Rápido | $200+/mo | Alta |
| Veryfi | 95%+ | Rápido | $300+/mo | Alta |

### C. Albaranes de Muestra para Testing
- [ ] PDFs escaneados (buena calidad)
- [ ] PDFs escaneados (mala calidad)
- [ ] Fotos tomadas con móvil
- [ ] Notas manuscritas
- [ ] Múltiples diseños/plantillas

---

**Estado del Documento:** Borrador  
**Última Actualización:** 2026-06-15  
**Próxima Revisión:** 2026-06-22 (después de completar Fase 1)