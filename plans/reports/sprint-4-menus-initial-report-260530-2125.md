# Sprint 4: Escandallos - Parte 3: Menús y Cartas - Checking Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-30
- **Estado:** Iniciando Sprint 4
- **Git:** Rama develop actualizada (commit c51902f)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 3 COMPLETADO (Recetas con TipTap)
- **Sprint Actual:** 🚀 Sprint 4 INICIANDO (Menús y Cartas Digitales)

## Objetivos Sprint 4
**Meta:** Sistema de menús con composición dinámica y multi-idioma

### Backend (NestJS) - PENDIENTE
- [ ] Modelo de Menú
- [ ] Modelo de Carta Digital
- [ ] Sistema de composición de menús
- [ ] Gestión de categorías de carta
- [ ] Ordenación y priorización
- [ ] Disponibilidad por temporada
- [ ] Multi-idioma en menús/cartas

### Frontend - PENDIENTE
- [ ] Constructor de menús drag&drop
- [ ] Gestión de cartas
- [ ] Vista de composición de menú
- [ ] Selector de recetas por categoría
- [ ] Gestión de disponibilidad
- [ ] Traducción de menús/cartas

### Documentación - PENDIENTE
- [ ] `docs/menu-composition-system.md`
- [ ] `docs/digital-menu-architecture.md`
- [ ] `docs/multi-lingual-menu-system.md`

## Arquitectura de Menús

### Modelo Jerárquico
```
Menu (Menú Completo)
├── name: string
├── description: string
├── startDate: Date
├── endDate: Date
├── isActive: boolean
└── sections: MenuSection[]
    ├── name: string (Primeros, Segundos, Postres...)
    ├── order: number
    └── items: MenuItem[]
        ├── recipeId: string
        ├── price: number (opcional, usa precio de receta)
        └── isAvailable: boolean
```

### Modelo de Carta Digital
```
DigitalMenu (Carta para comensales)
├── name: string
├── description: string
├── qrCode: string (URL única)
├── branding: BrandingSettings
├── sections: MenuSection[]
└── translations: MenuTranslation[]
```

### Sistema Multi-idioma
```typescript
interface MenuTranslation {
  id: string;
  menuId: string;
  language: string; // 'es', 'en', 'fr', 'de', etc.
  name: string;
  description: string;
  translations: {
    sections: Record<string, string>;
    items: Record<string, string>;
  };
}
```

## Funcionalidades Clave

### 1. Composición de Menús
- Drag&drop de recetas a secciones
- Ordenación manual o automática
- Cálculo de costos por menú
- Disponibilidad por fechas/season
- Templates reutilizables

### 2. Cartas Digitales QR
- Generación automática de QR codes
- Landing page responsive
- Filtros de alérgenos interactivos
- Branding personalizado
- Multi-idioma en tiempo real

### 3. Gestión Multi-idioma
- Traducciones completas de menús/cartas
- Soporte para idiomas adicionales
- Validación de traducciones completas
- Dashboard de progreso de traducción

## Cálculo de Costos en Menús

### Fórmula
```
Costo Total Menú = Σ (Costo de cada receta en menú)
Costo/Porción = Costo Total Menú / Porciones Menú
Margen = (Precio Venta - Costo) / Precio Venta
```

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 4