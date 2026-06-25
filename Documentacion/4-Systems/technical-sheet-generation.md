# Technical Sheet Generation System - ChefChek

## Sistema de Generación de Fichas Técnicas

ChefChek implementa un motor completo de generación de fichas técnicas parametrizadas que permite crear documentos profesionales PDF para recetas, optimizando la comunicación en cocinas profesionales y garantizando el cumplimiento normativo.

## Arquitectura del Sistema

### Flujo de Generación

```
Receta + Plantilla → Motor de Generación → PDF
  ├── Datos de receta
  │   ├── Ingredientes y cantidades
  │   ├── Costos parciales
  │   ├── Alérgenos
  │   ├── Pasos de elaboración
  │   └── Valores nutricionales
  ├── Configuración de plantilla
  │   ├── Layout y secciones
  │   ├── Campos personalizados
  │   ├── Estilos y branding
  │   └── Opciones de salida
  └── Ficha técnica PDF
      ├── Cabecera con branding
      ├── Información general
      ├── Lista de ingredientes
      ├── Pasos de elaboración
      ├── Información nutricional
      └── Pie de página legal
```

### Componentes del Motor

**1. Template Engine**
- Sistema de plantillas parametrizadas
- Tipos predefinidos (Estándar, Minimal, Detallado, Custom)
- Diseñador visual de plantillas
- Herencia y composición de plantillas

**2. Data Collector**
- Extracción de datos de recetas
- Cálculo automático de costos
- Cálculo de información nutricional
- Propagación de alérgenos

**3. PDF Generator**
- Rendering nativo con PDFKit
- Soporte de tipografías y estilos
- Watermarks y branding personalizado
- Optimización de tamaño

**4. Document Hub**
- Gestión centralizada de documentos
- Versionado automático
- Organización por categorías
- Sistema de búsqueda y filtros

## Implementación Backend

### 1. Modelo de Datos

```typescript
interface TechnicalSheetTemplate {
  id: string;
  tenantId: string;
  name: string;
  type: 'STANDARD' | 'MINIMAL' | 'DETAILED' | 'CUSTOM';
  description?: string;
  layout: TemplateLayout;
  fields: TemplateField[];
  styles: TemplateStyles;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
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

interface Document {
  id: string;
  tenantId: string;
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

### 2. Motor de Generación

```typescript
@Injectable()
export class TechnicalSheetsService {
  async generateTechnicalSheet(
    tenantId: string,
    userId: string,
    dto: GenerateSheetDto
  ): Promise<Buffer> {
    // 1. Obtener receta con todos los datos necesarios
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: dto.recipeId, tenantId },
      include: {
        ingredients: { include: { product: true } },
        subRecipes: { include: { subRecipe: true } },
        translations: true,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // 2. Obtener plantilla seleccionada
    const template = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // 3. Generar PDF con datos de receta y plantilla
    const pdfBuffer = await this.generatePDF(recipe, template, dto);

    // 4. Guardar documento en hub central
    const document = await this.prisma.document.create({
      data: {
        tenantId,
        name: `Ficha Técnica - ${recipe.name}`,
        type: 'TECHNICAL_SHEET',
        category: 'RECIPES',
        recipeId: recipe.id,
        templateId: template.id,
        version: 1,
        createdBy: userId,
        fileSize: pdfBuffer.length,
        fileFormat: 'PDF',
        url: `/documents/${this.generateDocumentId()}`,
      },
    });

    return pdfBuffer;
  }
}
```

### 3. Generación de PDF

```typescript
private async generatePDF(
  recipe: any,
  template: any,
  options: GenerateSheetDto
): Promise<Buffer> {
  // Crear documento PDF
  const doc = new PDFDocument({
    size: options.format === 'LETTER' ? [612, 792] : [595.28, 841.89],
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const styles = template.styles || this.getDefaultStyles();

  // Generar secciones según layout de plantilla
  if (template.layout.header.visible) {
    this.generateHeader(doc, recipe, template, styles);
  }

  if (template.layout.generalInfo.visible) {
    this.generateGeneralInfo(doc, recipe, template, styles);
  }

  if (template.layout.ingredients.visible) {
    this.generateIngredients(doc, recipe, template, styles, options);
  }

  if (template.layout.preparation.visible) {
    this.generatePreparation(doc, recipe, template, styles);
  }

  if (template.layout.nutrition.visible) {
    this.generateNutrition(doc, recipe, template, styles);
  }

  if (template.layout.footer.visible) {
    this.generateFooter(doc, template, styles, options);
  }

  doc.end();

  await new Promise((resolve) => doc.on('end', resolve));

  return Buffer.concat(chunks);
}
```

### 4. Generación de Secciones

```typescript
private generateIngredients(
  doc: any,
  recipe: any,
  template: any,
  styles: any,
  options: GenerateSheetDto
): void {
  doc.fontSize(16).font('Helvetica-Bold');
  doc.text('INGREDIENTES');
  doc.moveDown();

  doc.fontSize(styles.fontSize || 12).font('Helvetica');

  let totalCost = 0;

  recipe.ingredients.forEach((ingredient, index) => {
    const cost = (ingredient.quantity * ingredient.product.cost) / 1000;
    totalCost += cost;

    doc.text(
      `${index + 1}. ${ingredient.product.name} - ${ingredient.quantity} ${ingredient.unit || 'g'}`,
      { continued: options.includeCosts }
    );

    if (options.includeCosts) {
      doc.text(` (Costo: €${cost.toFixed(2)})`, { align: 'right' });
    }

    doc.moveDown();

    // Incluir alérgenos si está activado
    if (options.includeAllergens && ingredient.product.allergens) {
      const allergenNames = ingredient.product.allergens.map(
        (id) => this.getAllergenName(id)
      );
      if (allergenNames.length > 0) {
        doc.text(`   Alérgenos: ${allergenNames.join(', ')}`);
        doc.moveDown();
      }
    }
  });

  if (options.includeCosts) {
    doc.moveDown();
    doc.font('Helvetica-Bold');
    doc.text(`Costo Total Ingredientes: €${totalCost.toFixed(2)}`);
    doc.font('Helvetica');
  }

  doc.moveDown();
}
```

### 5. Generación Batch

```typescript
async generateBatch(
  tenantId: string,
  userId: string,
  dto: GenerateBatchDto
): Promise<Buffer> {
  const recipes = await this.prisma.recipe.findMany({
    where: {
      id: { in: dto.recipeIds },
      tenantId,
    },
    include: {
      ingredients: { include: { product: true } },
      translations: true,
    },
  });

  const template = await this.prisma.technicalSheetTemplate.findFirst({
    where: { id: dto.templateId, tenantId },
  });

  if (dto.mergeIntoOne) {
    return await this.generateMergedPDF(recipes, template, dto);
  } else {
    const zipBuffers = [];
    for (const recipe of recipes) {
      const sheet = await this.generatePDF(recipe, template, dto);
      zipBuffers.push(sheet);
    }
    return zipBuffers[0];
  }
}

private async generateMergedPDF(
  recipes: any[],
  template: any,
  options: GenerateBatchDto
): Promise<Buffer> {
  const mergedDoc = new PDFDocument();

  for (const recipe of recipes) {
    const recipePdf = await this.generatePDF(recipe, template, options);
    const subDoc = await PDFDocument.load(recipePdf);
    const copiedPages = await mergedDoc.copyPages(subDoc, subDoc.getPageIndices());
    copiedPages.forEach((page) => mergedDoc.addPage(page));
  }

  const mergedPdfBuffer = await mergedDoc.save();
  return Buffer.from(mergedPdfBuffer);
}
```

## Plantillas Predefinidas

### 1. Plantilla Estándar

```typescript
const standardTemplate: Template = {
  type: 'STANDARD',
  layout: {
    header: { visible: true, order: 1 },
    generalInfo: { visible: true, order: 2 },
    ingredients: { visible: true, order: 3 },
    preparation: { visible: true, order: 4 },
    nutrition: { visible: true, order: 5 },
    footer: { visible: true, order: 6 },
  },
  fields: [
    { id: 'name', name: 'Nombre', type: 'TEXT', required: true },
    { id: 'code', name: 'Código', type: 'TEXT', required: false },
    { id: 'yield', name: 'Porciones', type: 'TEXT', required: false },
    { id: 'ingredients', name: 'Ingredientes', type: 'LIST', required: true },
    { id: 'preparation', name: 'Elaboración', type: 'LIST', required: true },
  ],
  styles: {
    primaryColor: '#1f2937',
    secondaryColor: '#6b7280',
    fontFamily: 'Helvetica',
    fontSize: 12,
    headerFontSize: 18,
    lineWidth: 1,
  },
};
```

### 2. Plantilla Minimal

```typescript
const minimalTemplate: Template = {
  type: 'MINIMAL',
  layout: {
    header: { visible: true, order: 1 },
    generalInfo: { visible: true, order: 2 },
    ingredients: { visible: true, order: 3 },
    preparation: { visible: true, order: 4 },
    nutrition: { visible: false, order: 5 },
    footer: { visible: false, order: 6 },
  },
  fields: [
    { id: 'name', name: 'Nombre', type: 'TEXT', required: true },
    { id: 'ingredients', name: 'Ingredientes', type: 'LIST', required: true },
    { id: 'preparation', name: 'Elaboración', type: 'LIST', required: true },
  ],
  styles: {
    primaryColor: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 10,
    headerFontSize: 14,
    lineWidth: 0.5,
  },
};
```

### 3. Plantilla Detallada

```typescript
const detailedTemplate: Template = {
  type: 'DETAILED',
  layout: {
    header: { visible: true, order: 1 },
    generalInfo: { visible: true, order: 2 },
    ingredients: { visible: true, order: 3 },
    preparation: { visible: true, order: 4 },
    nutrition: { visible: true, order: 5 },
    footer: { visible: true, order: 6 },
  },
  fields: [
    { id: 'name', name: 'Nombre', type: 'TEXT', required: true },
    { id: 'image', name: 'Foto del Plato', type: 'IMAGE', required: false },
    { id: 'code', name: 'Código', type: 'TEXT', required: false },
    { id: 'category', name: 'Categoría', type: 'TEXT', required: false },
    { id: 'yield', name: 'Porciones', type: 'TEXT', required: false },
    { id: 'portionWeight', name: 'Peso por Porción', type: 'TEXT', required: false },
    { id: 'preparationTime', name: 'Tiempo Prep.', type: 'TEXT', required: false },
    { id: 'cookingTime', name: 'Tiempo Cocción', type: 'TEXT', required: false },
    { id: 'cookingMethod', name: 'Método Cocción', type: 'TEXT', required: false },
    { id: 'ingredients', name: 'Ingredientes', type: 'TABLE', required: true },
    { id: 'preparation', name: 'Elaboración', type: 'LIST', required: true },
    { id: 'nutrition', name: 'Nutrición', type: 'CALCULATED', required: false },
    { id: 'allergens', name: 'Alérgenos', type: 'CALCULATED', required: false },
    { id: 'costs', name: 'Costos', type: 'CALCULATED', required: false },
  ],
  styles: {
    primaryColor: '#1e3a8a',
    secondaryColor: '#3b82f6',
    fontFamily: 'Helvetica',
    fontSize: 11,
    headerFontSize: 20,
    lineWidth: 1.5,
  },
};
```

## Sistema de Diseño Visual

### 1. Diseñador de Plantillas

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
    toggleSection: (section: keyof TemplateLayout) => void;
    saveTemplate: () => Promise<Template>;
  };
}
```

### 2. Componentes Visuales

```typescript
function TemplateDesigner({ template, onSave }: TemplateDesignerProps) {
  const [layout, setLayout] = useState(template.layout);
  const [styles, setStyles] = useState(template.styles);
  const [previewMode, setPreviewMode] = useState(false);

  const handleStyleChange = (key: string, value: any) => {
    setStyles({ ...styles, [key]: value });
  };

  const handleToggleSection = (section: keyof TemplateLayout) => {
    setLayout({
      ...layout,
      [section]: {
        ...layout[section],
        visible: !layout[section].visible,
      },
    });
  };

  return (
    <div className="template-designer">
      <div className="designer-controls">
        <SectionToggles layout={layout} onToggle={handleToggleSection} />
        <StyleEditor styles={styles} onChange={handleStyleChange} />
      </div>

      <div className="designer-preview">
        {previewMode ? (
          <SheetPreview template={{ ...template, layout, styles }} />
        ) : (
          <TemplateStructure template={template} layout={layout} />
        )}
      </div>

      <div className="designer-actions">
        <button onClick={() => setPreviewMode(!previewMode)}>
          {previewMode ? 'Editar' : 'Vista Previa'}
        </button>
        <button onClick={onSave}>Guardar Plantilla</button>
      </div>
    </div>
  );
}
```

### 3. Drag & Drop de Campos

```typescript
function DraggableFieldList({ fields, onReorder }: DraggableFieldListProps) {
  const [draggedField, setDraggedField] = useState<string | null>(null);

  const handleDragStart = (fieldId: string) => {
    setDraggedField(fieldId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetFieldId: string) => {
    if (!draggedField) return;

    const newOrder = [...fields];
    const draggedIndex = newOrder.findIndex((f) => f.id === draggedField);
    const targetIndex = newOrder.findIndex((f) => f.id === targetFieldId);

    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    onReorder(newOrder);
    setDraggedField(null);
  };

  return (
    <div className="draggable-field-list">
      {fields.map((field) => (
        <div
          key={field.id}
          draggable
          onDragStart={() => handleDragStart(field.id)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(field.id)}
          className={`field-item ${draggedField === field.id ? 'dragging' : ''}`}
        >
          <span className="drag-handle">⋮⋮</span>
          <span className="field-name">{field.name}</span>
          <span className="field-type">{field.type}</span>
        </div>
      ))}
    </div>
  );
}
```

## Sistema de Documentos

### 1. Hub Central de Documentos

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
    searchBy: (query: string) => Promise<Document[]>;
    filterBy: (filters: DocumentFilter) => Promise<Document[]>;
  };
}
```

### 2. Organización de Documentos

```typescript
interface DocumentCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  color?: string;
}

async organizeDocument(
  documentId: string,
  categoryId: string
): Promise<void> {
  await this.prisma.document.update({
    where: { id: documentId },
    data: { category: categoryId },
  });
}

async createCategory(
  tenantId: string,
  name: string,
  parentId?: string
): Promise<DocumentCategory> {
  return await this.prisma.documentCategory.create({
    data: {
      tenantId,
      name,
      parentId,
      color: this.generateCategoryColor(),
    },
  });
}
```

### 3. Sistema de Búsqueda

```typescript
async searchDocuments(
  tenantId: string,
  query: string
): Promise<Document[]> {
  const documents = await this.prisma.document.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { type: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  return documents;
}

async filterDocuments(
  tenantId: string,
  filters: DocumentFilter
): Promise<Document[]> {
  const where: any = { tenantId };

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.recipeId) {
    where.recipeId = filters.recipeId;
  }

  if (filters?.dateFrom) {
    where.createdAt = { gte: filters.dateFrom };
  }

  if (filters?.dateTo) {
    where.createdAt = { ...where.createdAt, lte: filters.dateTo };
  }

  return await this.prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}
```

## Implementación Frontend

### 1. Generador de Fichas

```typescript
function TechnicalSheetGenerator({ recipes, templates }: GeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (preview: boolean = false) => {
    if (!selectedTemplate) {
      alert('Selecciona una plantilla');
      return;
    }

    setGenerating(true);

    try {
      for (const recipeId of selectedRecipes) {
        const endpoint = preview
          ? '/api/v1/technical-sheets/preview'
          : '/api/v1/technical-sheets/generate';

        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipeId,
            templateId: selectedTemplate,
            format: 'A4',
            orientation: 'PORTRAIT',
            quality: 'HIGH',
            includeNutrition: true,
            includeAllergens: true,
            includeCosts: true,
          }),
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="technical-sheet-generator">
      <TemplateSelector
        templates={templates}
        selected={selectedTemplate}
        onChange={setSelectedTemplate}
      />

      <RecipeSelector
        recipes={recipes}
        selected={selectedRecipes}
        onChange={setSelectedRecipes}
      />

      <div className="generator-actions">
        <button onClick={() => handleGenerate(false)} disabled={generating}>
          {generating ? 'Generando...' : 'Generar PDF'}
        </button>
        <button onClick={() => handleGenerate(true)} disabled={generating}>
          Vista Previa
        </button>
      </div>
    </div>
  );
}
```

### 2. Visualización de Documentos

```typescript
function DocumentHub({ documents, onDelete, onDownload }: DocumentHubProps) {
  const [filters, setFilters] = useState<DocumentFilter>({});
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filters.type && doc.type !== filters.type) return false;
      if (filters.category && doc.category !== filters.category) return false;
      if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [documents, filters, searchQuery]);

  return (
    <div className="document-hub">
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="document-list">
        {filteredDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onDelete={onDelete}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  );
}
```

## Testing del Sistema

### Tests Unitarios

```typescript
describe('Technical Sheet Generation', () => {
  it('should generate standard technical sheet', async () => {
    const recipe = await createTestRecipe();
    const template = await createStandardTemplate();

    const pdfBuffer = await technicalSheetsService.generateTechnicalSheet(
      tenantId,
      userId,
      {
        recipeId: recipe.id,
        templateId: template.id,
        format: 'A4',
        orientation: 'PORTRAIT',
        quality: 'HIGH',
      }
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it('should generate batch of technical sheets', async () => {
    const recipes = await createTestRecipes(5);
    const template = await createStandardTemplate();

    const pdfBuffer = await technicalSheetsService.generateBatch(
      tenantId,
      userId,
      {
        recipeIds: recipes.map((r) => r.id),
        templateId: template.id,
        mergeIntoOne: true,
      }
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(10000);
  });

  it('should apply custom styles to template', async () => {
    const customStyles = {
      primaryColor: '#ff0000',
      fontSize: 14,
      headerFontSize: 24,
    };

    const pdfBuffer = await technicalSheetsService.generateTechnicalSheet(
      tenantId,
      userId,
      {
        recipeId: recipe.id,
        templateId: customTemplate.id,
        styles: customStyles,
      }
    );

    expect(pdfBuffer).toBeInstanceOf(Buffer);
  });
});
```

## Métricas de Performance

### Tiempos de Generación

- Ficha técnica simple: ~200ms
- Ficha técnica detallada: ~500ms
- Batch de 10 fichas: ~2s
- Plantilla con branding personalizado: ~300ms

### Optimizaciones Aplicadas

- Caching de plantillas
- Batch generation optimizado
- Streaming de PDF para descargas grandes
- Lazy loading de imágenes
- Compresión de PDF optimizada

## Documentación Relacionada

- [Template System Architecture](./template-system-architecture.md) - Arquitectura de plantillas
- [PDF Generation Engine](./pdf-generation-engine.md) - Motor de generación PDF
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Allergen Propagation System](./allergen-propagation-system.md) - Sistema de alérgenos