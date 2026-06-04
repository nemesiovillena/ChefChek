# Sprint 5: Alérgenos y Seguridad Alimentaria - Checking Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-30
- **Estado:** Iniciando Sprint 5
- **Git:** Rama develop actualizada (commit 93398f7)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 4 COMPLETADO (Menús y Cartas Digitales)
- **Sprint Actual:** 🚀 Sprint 5 INICIANDO (Alérgenos y Seguridad)

## Objetivos Sprint 5
**Meta:** Sistema de trazabilidad automática de alérgenos con cumplimiento UE 1169/2011

### Backend (NestJS) - PENDIENTE
- [ ] Modelo de alérgenos base (UE 1169/2011)
- [ ] Sistema de declaración en productos
- [ ] Propagación cascada automática
- [ ] Cálculo de alérgenos en recetas
- [ ] Cálculo de alérgenos en menús/cartas
- [ ] Sistema de alertas y conflictos
- [ ] Reporte de cumplimiento legal

### Frontend - PENDIENTE
- [ ] Gestión de alérgenos en productos
- [ ] Visualización de cascada de alérgenos
- [ ] Alertas de conflictos
- [ ] Filtros de alérgenos en recetas
- [ ] Reporte de cumplimiento
- [ ] Exportación legal

### Documentación - PENDIENTE
- [ ] `docs/allergen-propagation-system.md`
- [ ] `docs/ue-1169-2011-compliance.md`
- [ ] `docs/allergen-conflict-detection.md`

## Normativa UE 1169/2011

### 14 Alérgenos Obligatorios

```typescript
enum AllergenEU {
  CEREALS_WITH_GLUTEN = 1,    // Cereales que contienen gluten
  CRUSTACEANS = 2,                // Crustáceos y productos derivados
  EGGS = 3,                     // Huevos y productos derivados
  FISH = 4,                      // Pescado y productos derivados
  PEANUTS = 5,                   // Cacahuetes y productos derivados
  SOY = 6,                       // Soja y productos derivados
  MILK = 7,                      // Leche y productos lácteos
  CELERY = 8,                    // Apio y productos derivados
  MUSTARD = 9,                   // Mostaza y productos derivados
  SESAME_SEEDS = 10,             // Semillas de sésamo
  SULFITES = 11,                  // Sulfitos y dióxido de azufre
  LUPIN = 12,                    // Altramuces y productos derivados
  MOLLUSCS = 13,                  // Moluscos y productos derivados
  MUSTARD_POWDER = 14,           // Mostaza en polvo
}
```

### Requisitos Legales

**Declaración Obligatoria:**
- Declaración en productos que contienen alérgenos
- Información clara y destacada en etiquetado
- Lista de ingredientes con alérgenos incluidos
- Instrucciones de uso seguro

**Información Obligatoria:**
- Nombre del alérgeno en idioma del consumidor
- Indicación clara de la presencia del alérgeno
- Referencia cruzada en menús y cartas
- Consecuencias de consumo para personas alérgicas

## Sistema de Propagación en Cascada

### Algoritmo de Propagación

```
Producto: Tomates (alérgenos: [])
└── Contiene: Cereal (alérgeno 1)

Receta: Salsa de Tomate
├── Tomates: [] → [1] (directo)
└── Cereal: [1] → [1] (en cascada)

Menú: Menú Ejecutivo
├── Salsa de Tomate: [1] → [1] (de receta)
└── Ensalada: [9] → [1,9] (mostaza)

Resultado Menú: [1,9] (tomates y mostaza)
```

### Niveles de Propagación

1. **Producto → Receta:** Directo desde declaración en producto
2. **Receta → Menú:** En cascada desde recetas incluidas
3. **Menú → Carta Digital:** Heredado de composición de menú

## Sistema de Alertas y Conflictos

### Tipos de Alertas

**1. Alertas de Conflicto:**
- Detección de incompatibilidad con alérgenos filtrados
- Alertas para personal de cocina sobre conflictos
- Alertas visuales en UI para consumidores

**2. Alertas de Cumplimiento:**
- Alérgenos sin declaración en productos usados
- Información incompleta en menús/cartas
- Falta de traducción de alérgenos

**3. Alertas de Riesgo:**
- Alérgenos de alta gravedad sin información clara
- Patrones de uso que sugieren riesgo

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 5