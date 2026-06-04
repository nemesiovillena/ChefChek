# Sprint 2: Escandallos - Parte 1: Productos - Checking Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-30
- **Estado:** Iniciando Sprint 2
- **Git:** Rama develop actualizada
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 1 COMPLETADO (Multi-tenancy + Auth)

## Objetivos Sprint 2
**Meta:** Sistema de gestión de productos con multi-unidad (UC/UA/UR)

### Backend (NestJS) ✅ COMPLETADO
- [x] Modelo de Producto/Ingrediente completo
- [x] Sistema Multi-unidad (UC/UA/UR)
- [x] Configuración de proveedores
- [x] Gestión de categorías de productos
- [x] Sistema de precios (bruto vs neto)
- [x] Cálculo de rendimientos y mermas
- [ ] Importación/exportación de productos

### Frontend
- [ ] CRUD de productos completo
- [ ] Formulario multi-unidad complejo
- [ ] Gestión de proveedores
- [ ] Vista detallada de producto
- [ ] Cálculo de costeo en tiempo real
- [ ] Importación masiva (CSV/Excel)

### Documentación
- [ ] `docs/multi-unit-system.md`
- [ ] `docs/cost-calculation-rules.md`
- [ ] `docs/product-data-model.md`

## Criterios de Verificación
- ✅ Alta/baja/modificación de productos
- ✅ Conversión correcta entre UC/UA/UR
- ✅ Cálculo de precios netos precisos
- ✅ Rendimientos y mermas calculados
- ✅ Sistema multi-unidad funcional

## Sistema Multi-unidad (UC/UA/UR)

### Unidades Principales
- **UC (Unidad de Compra):** Cómo se compra al proveedor
  - Ej: "Caja 10kg", "Bote 300uds", "Saco 25kg"
  
- **UA (Unidad de Almacenamiento):** Cómo se controla en almacén
  - Ej: "Kilogramos", "Litros", "Unidades"
  
- **UR (Unidad de Receta):** Cómo se usa en la cocina
  - Ej: "Gramos", "Mililitros", "Unidades"

### Conversión y Factores
- UC → UA: Factor de conversión para control de stock
- UA → UR: Factor de conversión para recetas
- UC → UR: Conversión directa desde compra a uso

## Precios y Costeos
- **Precio Bruto:** Precio de compra (incluye desperdicio)
- **Precio Neto:** Precio del producto limpio/aprovechable
- **Margen de Beneficio:** Porcentaje de beneficio comercial
- **Factor de Rendimiento:** (1 - wastePercentage)

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 2