# Sprint 6: Fichas Técnicas y Documentos - Checking Inicial

## Estado del Proyecto
- **Fecha:** 2026-05-30
- **Estado:** Iniciando Sprint 6
- **Git:** Rama develop actualizada (commit 7bf2e17)
- **GitHub:** https://github.com/nemesiovillena/ChefChek
- **Sprint Anterior:** ✅ Sprint 5 COMPLETADO (Alérgenos y Seguridad)
- **Sprint Actual:** 🚀 Sprint 6 INICIANDO (Fichas Técnicas)

## Objetivos Sprint 6
**Meta:** Sistema de generación de fichas técnicas parametrizadas con exportación PDF

### Backend (NestJS) - PENDIENTE
- [ ] Motor de generación de fichas técnicas
- [ ] Plantillas parametrizadas
- [ ] Sistema de diseño de fichas
- [ ] Generación de PDF dinámicos
- [ ] Descarga masiva de documentos
- [ ] Hub central de documentos

### Frontend - PENDIENTE
- [ ] Selector de plantillas de ficha
- [ ] Vista previa de ficha técnica
- [ ] Diseñador de plantillas
- [ ] Exportación PDF
- [ ] Gestión de documentos
- [ ] Filtros de descarga masiva

### Documentación - PENDIENTE
- [ ] `docs/technical-sheet-generation.md`
- [ ] `docs/template-system-architecture.md`
- [ ] `docs/pdf-generation-engine.md`

## Sistema de Fichas Técnicas

### Motor de Generación

```
Receta + Plantilla → Ficha Técnica
├── Datos de receta (ingredientes, costos, alérgenos)
├── Datos de plantilla (layout, campos, estilos)
└── Ficha técnica generada → PDF
```

### Componentes de Ficha Técnica

**Cabecera:**
- Nombre del plato
- Foto del plato
- Código interno
- Fecha de elaboración

**Información General:**
- Descripción del plato
- Porciones y rendimiento
- Tiempo de preparación
- Método de cocción

**Ingredientes:**
- Lista de ingredientes
- Cantidades por porción
- Costos parciales
- Alérgenos

**Elaboración:**
- Pasos detallados
- Tiempos por paso
- Temperaturas
- Observaciones

**Información Complementaria:**
- Valores nutricionales
- Alérgenos destacados
- Costo total
- Margen de beneficio

## Sistema de Plantillas

### Tipos de Plantillas

```typescript
interface Template {
  id: string;
  name: string;
  type: 'STANDARD' | 'MINIMAL' | 'DETAILED' | 'CUSTOM';
  layout: TemplateLayout;
  fields: TemplateField[];
  styles: TemplateStyles;
  createdBy: string;
  tenantId: string;
}

interface TemplateLayout {
  header: LayoutSection;
  generalInfo: LayoutSection;
  ingredients: LayoutSection;
  preparation: LayoutSection;
  nutrition: LayoutSection;
  footer: LayoutSection;
}

interface TemplateField {
  id: string;
  name: string;
  type: 'TEXT' | 'IMAGE' | 'LIST' | 'TABLE' | 'CALCULATED';
  required: boolean;
  defaultValue?: any;
  placeholder?: string;
}
```

### Plantillas Predefinidas

1. **Estándar:** Cabecera completa, ingredientes detallados, elaboración paso a paso
2. **Mínima:** Solo información esencial, ingredientes básicos, preparación resumida
3. **Detallada:** Incluye fotos, tiempos detallados, valores nutricionales completos
4. **Personalizada:** Creada por el usuario con campos personalizados

## Sistema de Diseño de Fichas

### Diseñador de Plantillas

```typescript
interface TemplateDesigner {
  selectedTemplate: Template;
  layout: LayoutConfig;
  fields: FieldConfig[];
  styles: StyleConfig;
  preview: SheetPreview;

  operations: {
    addField: (field: TemplateField) => void;
    removeField: (fieldId: string) => void;
    updateField: (fieldId: string, updates: Partial<TemplateField>) => void;
    reorderFields: (fieldIds: string[]) => void;
    customizeStyles: (styles: TemplateStyles) => void;
  };
}
```

### Componentes Visuales

- **Drag & Drop:** Reordenar campos y secciones
- **Editor WYSIWYG:** Editar contenido en tiempo real
- **Vista Previa:** Visualizar ficha mientras se diseña
- **Preview PDF:** Generar PDF de muestra
- **Historial de Versiones:** Guardar cambios con timestamps

## Generación de PDF

### Motor PDF

```typescript
interface PDFGenerator {
  generateTechnicalSheet(
    recipe: Recipe,
    template: Template,
    options: PDFOptions
  ): Promise<Buffer>;

  generateBatch(
    recipes: Recipe[],
    template: Template,
    options: PDFOptions
  ): Promise<Buffer>;

  options: {
    format: 'A4' | 'LETTER';
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    quality: 'STANDARD' | 'HIGH';
    watermark?: string;
    branding?: BrandingConfig;
  };
}
```

### Tecnologías

- **PDFKit:** Generación de PDF nativa en Node.js
- **Puppeteer:** Rendering de HTML a PDF con soporte CSS avanzado
- **PDF-Lib:** Manipulación de PDF existentes (watermarks, marcas de agua)

## Hub Central de Documentos

### Estructura de Documentos

```typescript
interface DocumentHub {
  documents: Document[];
  categories: DocumentCategory[];
  filters: DocumentFilter;
  search: DocumentSearch;

  operations: {
    upload: (file: File) => Promise<Document>;
    download: (docId: string) => Promise<Buffer>;
    preview: (docId: string) => Promise<PreviewData>;
    delete: (docId: string) => Promise<void>;
    organize: (docId: string, categoryId: string) => Promise<void>;
  };
}

interface Document {
  id: string;
  name: string;
  type: 'TECHNICAL_SHEET' | 'RECIPE_CARD' | 'INSTRUCTION' | 'OTHER';
  category: string;
  recipeId?: string;
  templateId?: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  fileFormat: 'PDF' | 'DOCX';
  url: string;
}
```

## Rutas de Checking
`/Users/nemesioj/Documents/Trabajos offline/ChefChek/chefchek/plans/reports/`

---
**Estado:** 🚀 Iniciando implementación Sprint 6