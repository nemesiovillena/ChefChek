# Sprint 3: Escandallos - Parte 2: Recetas - Checking Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-30
- **Estado:** Iniciando Sprint 3
- **Git:** Rama develop actualizada (commit 3ba1206)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 2 COMPLETADO (Productos Multi-unidad)
- **Sprint Actual:** 🚀 Sprint 3 INICIANDO (Recetas con TipTap)

## Objetivos Sprint 3
**Meta:** Motor de recetas con recursividad, TipTap editor y cálculo automático de costeos

### Backend (NestJS) - PENDIENTE
- [ ] Modelo de Receta con sub-recetas recursivas
- [ ] Sistema de elaboración en TipTap JSON
- [ ] Cálculo automático de costeos
- [ ] Gestión de rendimientos escalados
- [ ] Sistema de versionado de recetas
- [ ] Copia/duplicación de recetas
- [ ] Filtros y búsqueda avanzada

### Frontend - PENDIENTE
- [ ] Editor de recetas con TipTap
- [ ] Selector de productos multi-unidad
- [ ] Gestión de sub-recetas anidadas
- [ ] Vista previa de ficha técnica
- [ ] Cálculo de costeo en vivo
- [ ] Historial de versiones
- [ ] Comparación entre versiones

### Documentación - PENDIENTE
- [ ] `docs/recipe-data-model.md`
- [ ] `docs/recursive-recipe-system.md`
- [ ] `docs/tiptap-integration.md`
- [ ] `docs/cost-engine-algorithm.md`

## Arquitectura de Recetas

### Modelo Recursivo
```
Recipe (Receta base)
├── name: string
├── description: TipTap JSON (instrucciones)
├── servings: number (porciones)
├── preparationTime: number (minutos)
├── yieldPercentage: number (rendimiento escalado)
├── ingredients: RecipeIngredient[]
│   ├── productId: string (referencia a Product)
│   ├── quantity: number
│   ├── unit: string (UR del producto)
│   └── recipeId: string (null = ingrediente base, valor = sub-receta)
└── versions: RecipeVersion[]
```

### Sistema de Recetas Recursivas
- Ingredientes pueden ser productos base O sub-recetas
- Costos calculados recursivamente
- Rendimientos escalados en cascada
- Alérgenos propagados automáticamente

### TipTap Editor Integration
- Rich text editor para instrucciones de elaboración
- JSON estructurado almacenado en DB
- Soporte para imágenes, listas, tablas
- Versionado de contenido

## Cálculo de Costeos en Recetas

### Fórmula de Cálculo
```
Costo Total Receta = Σ (Costo de cada ingrediente)

Donde:
- Ingrediente producto: Cantidad UR × Costo/UR
- Ingrediente sub-receta: (Cantidad × Costo Total Sub-Receta) / Porciones Sub-Receta
```

### Ejemplo de Recursión
```
Receta: Salsa de Tomate (10 porciones)
- Tomates: 2kg × €0.0025/g = €5.00
- Cebolla: 300g × €0.0015/g = €0.45
- Sub-receta: Sofrito (200g)
  - Sub-receta Sofrito: €2.50 (costo total, 5 porciones)
  - Costo en receta: (200g/500g) × €2.50 = €1.00

Costo Total: €5.00 + €0.45 + €1.00 = €6.45
Costo/Porción: €6.45 / 10 = €0.645
```

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 3