# Template System Architecture - ChefChek

## Arquitectura del Sistema de Plantillas

ChefChek implementa un sistema de plantillas parametrizadas que permite a los usuarios crear diseños personalizados de fichas técnicas, recetas y documentos con flexibilidad total y sin necesidad de conocimientos técnicos.

## Arquitectura del Sistema

### Jerarquía de Plantillas

```
Plantilla Base (Template)
├── Configuración de Layout
│   ├── Secciones visibles
│   ├── Orden de secciones
│   └── Estructura de columnas
├── Campos Personalizados
│   ├── Campos de texto
│   ├── Campos de imagen
│   ├── Campos de lista
│   ├── Campos de tabla
│   └── Campos calculados
├── Estilos y Branding
│   ├── Colores y tipografías
│   ├── Tamaños y márgenes
│   └── Logos y marcas de agua
└── Reglas de Negocio
    ├── Validaciones
    ├── Valores por defecto
    └── Condiciones de visibilidad
```

### Tipos de Plantillas

**1. Plantillas Predefinidas**

```typescript
enum TemplateType {
  STANDARD = 'STANDARD',      // Estructura completa estándar
  MINIMAL = 'MINIMAL',        // Solo información esencial
  DETAILED = 'DETAILED',      // Información exhaustiva
  CUSTOM = 'CUSTOM',          // Totalmente personalizable
}
```

**2. Herencia de Plantillas**

```typescript
interface TemplateInheritance {
  parentTemplateId?: string;
  extendsFields?: boolean;
  overridesStyles?: boolean;
  customSections?: TemplateLayout;
}

class TemplateSystem {
  async createFromBase(
    baseTemplateId: string,
    tenantId: string,
    userId: string,
    customizations: Partial<Template>
  ): Promise<Template> {
    const baseTemplate = await this.prisma.technicalSheetTemplate.findUnique({
      where: { id: baseTemplateId },
    });

    const inheritedTemplate = await this.prisma.technicalSheetTemplate.create({
      data: {
        tenantId,
        name: `${baseTemplate.name} (Copia)`,
        type: 'CUSTOM',
        layout: baseTemplate.layout,
        fields: baseTemplate.fields,
        styles: baseTemplate.styles,
        createdBy: userId,
        ...customizations,
      },
    });

    return inheritedTemplate;
  }
}
```

## Motor de Diseño

### 1. Sistema de Campos Dinámicos

```typescript
interface DynamicField {
  id: string;
  name: string;
  type: FieldType;
  config: FieldConfig;
  validation: ValidationRules;
  dataSource?: DataSource;
  computedValue?: ComputedValue;
}

interface FieldConfig {
  label?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: FieldOption[];
  multiple?: boolean;
  rows?: number;
  cols?: number;
}

interface ValidationRules {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: any[];
}

interface DataSource {
  type: 'RECIPE' | 'PRODUCT' | 'CALCULATED' | 'CUSTOM';
  field?: string;
  formula?: string;
  apiEndpoint?: string;
}

interface ComputedValue {
  type: 'AGGREGATE' | 'CALCULATION' | 'TRANSFORMATION';
  formula: string;
  dependencies: string[];
}
```

### 2. Campos Calculados

```typescript
class ComputedFieldsEngine {
  calculateIngredientTotal(recipe: Recipe): number {
    return recipe.ingredients.reduce((total, ingredient) => {
      return total + (ingredient.quantity * ingredient.product.cost) / 1000;
    }, 0);
  }

  calculateNutrition(recipe: Recipe): NutritionInfo {
    let calories = 0;
    let proteins = 0;
    let carbs = 0;
    let fats = 0;

    recipe.ingredients.forEach((ingredient) => {
      const factor = ingredient.quantity / 100;
      calories += (ingredient.product.calories || 0) * factor;
      proteins += (ingredient.product.proteins || 0) * factor;
      carbs += (ingredient.product.carbs || 0) * factor;
      fats += (ingredient.product.fats || 0) * factor;
    });

    return {
      calories: Math.round(calories),
      proteins: Math.round(proteins * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
    };
  }

  calculateAllergens(recipe: Recipe): string[] {
    const allergens = new Set<number>();

    recipe.ingredients.forEach((ingredient) => {
      if (ingredient.product.allergens) {
        ingredient.product.allergens.forEach((allergenId) => {
          allergens.add(allergenId);
        });
      }
    });

    return Array.from(allergens).map((id) => this.getAllergenName(id));
  }
}
```

### 3. Sistema de Layout Dinámico

```typescript
interface LayoutSystem {
  sections: LayoutSection[];
  gridConfig: GridConfig;
  responsiveBreakpoints: ResponsiveBreakpoint[];
}

interface GridConfig {
  columns: number;
  gap: number;
  containerWidth: number;
}

interface ResponsiveBreakpoint {
  name: string;
  maxWidth: number;
  columns: number;
  fontSize: number;
}

class DynamicLayoutEngine {
  renderSection(section: LayoutSection, data: any): string {
    let html = `<section class="layout-section" data-section="${section.name}">`;

    if (section.columns && section.columns > 1) {
      html += `<div class="grid grid-cols-${section.columns}">`;
    }

    section.fields.forEach((field) => {
      html += this.renderField(field, data);
    });

    if (section.columns && section.columns > 1) {
      html += '</div>';
    }

    html += '</section>';
    return html;
  }

  renderField(field: TemplateField, data: any): string {
    const value = this.getFieldValue(field, data);

    switch (field.type) {
      case 'TEXT':
        return `<div class="field field-text">
          <label class="field-label">${field.name}</label>
          <div class="field-value">${value || '-'}</div>
        </div>`;

      case 'IMAGE':
        return `<div class="field field-image">
          <label class="field-label">${field.name}</label>
          <img src="${value}" alt="${field.name}" class="field-image" />
        </div>`;

      case 'LIST':
        return `<div class="field field-list">
          <label class="field-label">${field.name}</label>
          <ul class="field-list-items">
            {Array.isArray(value) ? value.map(item => `<li>${item}</li>`).join('') : `<li>${value}</li>`}
          </ul>
        </div>`;

      case 'TABLE':
        return `<div class="field field-table">
          <label class="field-label">${field.name}</label>
          <table class="field-table-content">
            <thead>
              <tr>
                {Object.keys(value[0] || {}).map(key => `<th>${key}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(value) ? value.map(row =>
                `<tr>
                  {Object.values(row).map(cell => `<td>${cell}</td>`).join('')}
                </tr>`
              ).join('') : ''}
            </tbody>
          </table>
        </div>`;

      case 'CALCULATED':
        return `<div class="field field-calculated">
          <label class="field-label">${field.name}</label>
          <div class="field-value calculated">${value}</div>
        </div>`;

      default:
        return `<div class="field field-unknown">
          <label class="field-label">${field.name}</label>
          <div class="field-value">${value || '-'}</div>
        </div>`;
    }
  }

  getFieldValue(field: TemplateField, data: any): any {
    // Si es un campo calculado, ejecutar fórmula
    if (field.type === 'CALCULATED' && field.computedValue) {
      return this.executeComputedField(field.computedValue, data);
    }

    // Si es un campo de datos, obtener del objeto
    const pathParts = (field.dataPath || field.id).split('.');
    let value = data;

    for (const part of pathParts) {
      value = value?.[part];
    }

    return value;
  }

  executeComputedField(computed: ComputedValue, data: any): any {
    const engine = new ComputedFieldsEngine();

    switch (computed.type) {
      case 'AGGREGATE':
        return this.executeAggregate(computed.formula, data);

      case 'CALCULATION':
        return this.executeCalculation(computed.formula, data);

      case 'TRANSFORMATION':
        return this.executeTransformation(computed.formula, data);

      default:
        return null;
    }
  }
}
```

## Sistema de Validación

### 1. Validación de Plantillas

```typescript
interface TemplateValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

class TemplateValidator {
  validateTemplate(template: Template): TemplateValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validar estructura básica
    if (!template.name || template.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'El nombre de la plantilla es obligatorio',
        severity: 'CRITICAL',
      });
    }

    if (!template.type) {
      errors.push({
        field: 'type',
        message: 'El tipo de plantilla es obligatorio',
        severity: 'CRITICAL',
      });
    }

    // Validar layout
    if (!template.layout) {
      errors.push({
        field: 'layout',
        message: 'La configuración de layout es obligatoria',
        severity: 'CRITICAL',
      });
    } else {
      this.validateLayout(template.layout, errors, warnings);
    }

    // Validar campos
    if (!template.fields || template.fields.length === 0) {
      warnings.push({
        field: 'fields',
        message: 'La plantilla no tiene campos definidos',
        suggestion: 'Añade campos para generar documentos útiles',
      });
    } else {
      this.validateFields(template.fields, errors, warnings);
    }

    // Validar estilos
    if (!template.styles) {
      warnings.push({
        field: 'styles',
        message: 'No se han definido estilos personalizados',
        suggestion: 'Define estilos para personalizar la apariencia',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateLayout(
    layout: TemplateLayout,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const sections = ['header', 'generalInfo', 'ingredients', 'preparation', 'nutrition', 'footer'];

    sections.forEach((section) => {
      if (!layout[section]) {
        errors.push({
          field: `layout.${section}`,
          message: `La sección "${section}" no está definida en el layout`,
          severity: 'HIGH',
        });
      } else if (typeof layout[section] !== 'object') {
        errors.push({
          field: `layout.${section}`,
          message: `La sección "${section}" debe ser un objeto`,
          severity: 'HIGH',
        });
      }
    });

    // Verificar al menos una sección visible
    const visibleSections = sections.filter((s) => layout[s]?.visible);
    if (visibleSections.length === 0) {
      warnings.push({
        field: 'layout',
        message: 'Ninguna sección está configurada como visible',
        suggestion: 'Marca al menos una sección como visible',
      });
    }
  }

  private validateFields(
    fields: TemplateField[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const fieldIds = new Set<string>();

    fields.forEach((field, index) => {
      // Validar ID único
      if (!field.id || field.id.trim() === '') {
        errors.push({
          field: `fields[${index}].id`,
          message: 'El campo debe tener un ID único',
          severity: 'CRITICAL',
        });
      } else if (fieldIds.has(field.id)) {
        errors.push({
          field: `fields[${index}].id`,
          message: `El ID "${field.id}" está duplicado`,
          severity: 'HIGH',
        });
      } else {
        fieldIds.add(field.id);
      }

      // Validar nombre
      if (!field.name || field.name.trim() === '') {
        errors.push({
          field: `fields[${index}].name`,
          message: 'El campo debe tener un nombre',
          severity: 'CRITICAL',
        });
      }

      // Validar tipo
      if (!field.type) {
        errors.push({
          field: `fields[${index}].type`,
          message: 'El campo debe tener un tipo',
          severity: 'CRITICAL',
        });
      }

      // Validar campos calculados
      if (field.type === 'CALCULATED' && !field.computedValue) {
        errors.push({
          field: `fields[${index}].computedValue`,
          message: 'Los campos calculados deben definir una fórmula',
          severity: 'HIGH',
        });
      }

      // Validar campos de imagen
      if (field.type === 'IMAGE' && !field.dataSource) {
        warnings.push({
          field: `fields[${index}].dataSource`,
          message: 'Los campos de imagen deberían especificar un origen de datos',
          suggestion: 'Define un origen de datos para la imagen',
        });
      }
    });
  }
}
```

### 2. Validación de Campos

```typescript
class FieldValidator {
  validateField(field: TemplateField, value: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar campos requeridos
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push(`El campo "${field.name}" es obligatorio`);
    }

    // Validar tipo de datos
    if (value !== null && value !== undefined) {
      switch (field.type) {
        case 'TEXT':
          this.validateTextField(field, value, errors, warnings);
          break;

        case 'NUMBER':
          this.validateNumberField(field, value, errors, warnings);
          break;

        case 'DATE':
          this.validateDateField(field, value, errors, warnings);
          break;

        case 'IMAGE':
          this.validateImageField(field, value, errors, warnings);
          break;

        case 'LIST':
          this.validateListField(field, value, errors, warnings);
          break;

        case 'TABLE':
          this.validateTableField(field, value, errors, warnings);
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateTextField(
    field: TemplateField,
    value: string,
    errors: string[],
    warnings: string[]
  ): void {
    if (typeof value !== 'string') {
      errors.push(`El campo "${field.name}" debe ser texto`);
      return;
    }

    if (field.validation?.minLength && value.length < field.validation.minLength) {
      errors.push(
        `El campo "${field.name}" debe tener al menos ${field.validation.minLength} caracteres`
      );
    }

    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
      errors.push(
        `El campo "${field.name}" no puede exceder ${field.validation.maxLength} caracteres`
      );
    }

    if (field.validation?.pattern && !field.validation.pattern.test(value)) {
      errors.push(`El campo "${field.name}" no cumple el formato requerido`);
    }

    if (value.length > 500) {
      warnings.push(
        `El campo "${field.name}" tiene más de 500 caracteres, podría afectar el layout`
      );
    }
  }

  private validateNumberField(
    field: TemplateField,
    value: number,
    errors: string[],
    warnings: string[]
  ): void {
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`El campo "${field.name}" debe ser un número`);
      return;
    }

    if (field.validation?.min !== undefined && value < field.validation.min) {
      errors.push(
        `El campo "${field.name}" debe ser mayor o igual a ${field.validation.min}`
      );
    }

    if (field.validation?.max !== undefined && value > field.validation.max) {
      errors.push(`El campo "${field.name}" debe ser menor o igual a ${field.validation.max}`);
    }
  }

  private validateImageField(
    field: TemplateField,
    value: string,
    errors: string[],
    warnings: string[]
  ): void {
    if (!value.startsWith('http') && !value.startsWith('/')) {
      errors.push(`El campo "${field.name}" debe ser una URL válida`);
      return;
    }

    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(value)) {
      warnings.push(
        `El campo "${field.name}" debería apuntar a una imagen (jpg, png, gif, webp)`
      );
    }
  }
}
```

## Sistema de Composición

### 1. Composición de Plantillas

```typescript
class TemplateComposer {
  async composeTemplate(
    tenantId: string,
    components: TemplateComponent[]
  ): Promise<Template> {
    const composedLayout: any = {};
    const composedFields: TemplateField[] = [];
    const composedStyles: any = {};

    for (const component of components) {
      // Fusionar layouts
      Object.keys(component.layout || {}).forEach((section) => {
        if (!composedLayout[section]) {
          composedLayout[section] = { ...component.layout[section] };
        } else {
          composedLayout[section] = {
            ...composedLayout[section],
            ...component.layout[section],
          };
        }
      });

      // Agregar campos con IDs únicos
      component.fields?.forEach((field) => {
        composedFields.push({
          ...field,
          id: this.generateUniqueId(field.id, component.id),
        });
      });

      // Fusionar estilos
      if (component.styles) {
        Object.assign(composedStyles, component.styles);
      }
    }

    return await this.prisma.technicalSheetTemplate.create({
      data: {
        tenantId,
        name: 'Plantilla Compuesta',
        type: 'CUSTOM',
        layout: composedLayout,
        fields: composedFields,
        styles: composedStyles,
        createdBy: 'SYSTEM',
      },
    });
  }

  private generateUniqueId(fieldId: string, componentId: string): string {
    return `${componentId}_${fieldId}`;
  }
}
```

### 2. Sistema de Componentes Reutilizables

```typescript
interface TemplateComponent {
  id: string;
  name: string;
  description?: string;
  layout: Partial<TemplateLayout>;
  fields: TemplateField[];
  styles?: TemplateStyles;
  category: 'HEADER' | 'SECTION' | 'FOOTER' | 'FULL';
}

class ComponentLibrary {
  async getStandardComponents(): Promise<TemplateComponent[]> {
    return [
      {
        id: 'standard-header',
        name: 'Cabecera Estándar',
        category: 'HEADER',
        description: 'Cabecera con título y código interno',
        layout: {
          header: { visible: true, order: 1 },
        },
        fields: [
          { id: 'title', name: 'Título', type: 'TEXT', required: true },
          { id: 'code', name: 'Código', type: 'TEXT', required: false },
          { id: 'image', name: 'Foto', type: 'IMAGE', required: false },
        ],
      },
      {
        id: 'ingredients-table',
        name: 'Tabla de Ingredientes',
        category: 'SECTION',
        description: 'Tabla detallada de ingredientes con costos',
        layout: {
          ingredients: { visible: true, order: 3, columns: 2 },
        },
        fields: [
          { id: 'ingredients', name: 'Ingredientes', type: 'TABLE', required: true },
          { id: 'total-cost', name: 'Costo Total', type: 'CALCULATED', required: false },
        ],
      },
      {
        id: 'nutrition-section',
        name: 'Información Nutricional',
        category: 'SECTION',
        description: 'Sección completa de información nutricional',
        layout: {
          nutrition: { visible: true, order: 5 },
        },
        fields: [
          { id: 'calories', name: 'Calorías', type: 'CALCULATED', required: false },
          { id: 'proteins', name: 'Proteínas', type: 'CALCULATED', required: false },
          { id: 'carbs', name: 'Carbohidratos', type: 'CALCULATED', required: false },
          { id: 'fats', name: 'Grasas', type: 'CALCULATED', required: false },
        ],
      },
      {
        id: 'standard-footer',
        name: 'Pie de Página Estándar',
        category: 'FOOTER',
        description: 'Pie de página con fecha y branding',
        layout: {
          footer: { visible: true, order: 6 },
        },
        fields: [
          { id: 'generation-date', name: 'Fecha Generación', type: 'CALCULATED', required: true },
          { id: 'company-name', name: 'Empresa', type: 'TEXT', required: false },
        ],
      },
    ];
  }

  async createCustomComponent(
    tenantId: string,
    component: Omit<TemplateComponent, 'id'>
  ): Promise<TemplateComponent> {
    return await this.prisma.templateComponent.create({
      data: {
        tenantId,
        ...component,
        id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  }
}
```

## Sistema de Versionado

### 1. Control de Versiones de Plantillas

```typescript
interface TemplateVersion {
  version: number;
  templateId: string;
  changes: TemplateChange[];
  createdBy: string;
  createdAt: Date;
  parentVersion?: number;
}

interface TemplateChange {
  field: string;
  oldValue?: any;
  newValue?: any;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
}

class TemplateVersioning {
  async createVersion(
    templateId: string,
    userId: string,
    changes: TemplateChange[]
  ): Promise<TemplateVersion> {
    const currentVersion = await this.getLatestVersion(templateId);

    const newVersion = await this.prisma.templateVersion.create({
      data: {
        templateId,
        version: currentVersion ? currentVersion.version + 1 : 1,
        changes,
        createdBy: userId,
        createdAt: new Date(),
        parentVersion: currentVersion?.version,
      },
    });

    return newVersion;
  }

  async getLatestVersion(templateId: string): Promise<TemplateVersion | null> {
    return await this.prisma.templateVersion.findFirst({
      where: { templateId },
      orderBy: { version: 'desc' },
    });
  }

  async getVersionHistory(templateId: string): Promise<TemplateVersion[]> {
    return await this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
    });
  }

  async revertToVersion(
    templateId: string,
    version: number,
    userId: string
  ): Promise<Template> {
    const targetVersion = await this.prisma.templateVersion.findFirst({
      where: { templateId, version },
    });

    if (!targetVersion) {
      throw new NotFoundException('Version not found');
    }

    const template = await this.prisma.technicalSheetTemplate.findUnique({
      where: { id: templateId },
    });

    const revertedTemplate = await this.prisma.technicalSheetTemplate.update({
      where: { id: templateId },
      data: {
        ...this.applyChanges(template, targetVersion.changes),
        updatedAt: new Date(),
      },
    });

    return revertedTemplate;
  }

  private applyChanges(template: Template, changes: TemplateChange[]): Partial<Template> {
    const updates: Partial<Template> = {};

    changes.forEach((change) => {
      if (change.type === 'DELETE') {
        updates[change.field] = undefined;
      } else if (change.type === 'UPDATE' || change.type === 'CREATE') {
        updates[change.field] = change.newValue;
      }
    });

    return updates;
  }
}
```

## Documentación Relacionada

- [Technical Sheet Generation](./technical-sheet-generation.md) - Generación de fichas técnicas
- [PDF Generation Engine](./pdf-generation-engine.md) - Motor de generación PDF
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas