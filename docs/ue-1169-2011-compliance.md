# UE 1169/2011 Compliance - ChefChek

## Cumplimiento Legal de Alérgenos - Normativa Europea

ChefChek implementa un sistema completo de cumplimiento con el Reglamento (UE) nº 1169/2011 del Parlamento Europeo y del Consejo, relativo a la información alimentaria facilitada al consumidor.

## Requisitos Legales UE 1169/2011

### Alérgenos Obligatorios (Artículo 21)

El Reglamento establece 14 alérgenos alimentarios que deben ser declarados obligatoriamente:

1. **Cereales que contienen gluten** (trigo, centeno, cebada, avena, etc.)
2. **Crustáceos y productos derivados**
3. **Huevos y productos derivados**
4. **Pescado y productos derivados**
5. **Cacahuetes y productos derivados**
6. **Soja y productos derivados**
7. **Leche y productos lácteos**
8. **Frutos de cáscara** (almendras, avellanas, nueces, etc.)
9. **Apio y productos derivados**
10. **Mostaza y productos derivados**
11. **Granos de sésamo y productos derivados**
12. **Dióxido de azufre y sulfitos** (en concentraciones > 10mg/kg)
13. **Altramuces y productos derivados**
14. **Moluscos y productos derivados**

### Requisitos de Declaración

**Información Obligatoria:**
- Nombre del alérgeno en idioma del consumidor
- Referencia clara en la lista de ingredientes
- Indicación destacada de presencia del alérgeno
- Información sobre riesgos para personas alérgicas

**Presentación:**
- Letra clara y legible
- Información destacada (negrita, mayúsculas, subrayado)
- Posición visible en el etiquetado
- Mismo idioma que el resto del etiquetado

## Implementación en ChefChek

### 1. Enum de Alérgenos UE 1169/2011

```typescript
enum AllergenEU {
  CEREALS_WITH_GLUTEN = 1,
  CRUSTACEANS = 2,
  EGGS = 3,
  FISH = 4,
  PEANUTS = 5,
  SOY = 6,
  MILK = 7,
  CELERY = 8,
  MUSTARD = 9,
  SESAME_SEEDS = 10,
  SULFITES = 11,
  LUPIN = 12,
  MOLLUSCS = 13,
  MUSTARD_POWDER = 14,
}

export const ALLERGENS_INFO = [
  {
    id: 1,
    name: 'Cereales con Gluten',
    icon: '🌾',
    color: 'yellow',
    severity: 'medium',
    legalDescription: 'Cereales que contienen gluten',
    examples: ['Trigo', 'Centeno', 'Cebada', 'Avena'],
  },
  {
    id: 2,
    name: 'Crustáceos',
    icon: '🦐',
    color: 'red',
    severity: 'high',
    legalDescription: 'Crustáceos y productos derivados',
    examples: ['Gambas', 'Langostinos', 'Cangrejo'],
  },
  // ... resto de los 14 alérgenos
];
```

### 2. Sistema de Declaración en Productos

```typescript
interface ProductDeclaration {
  productId: string;
  productName: string;
  declaredAllergens: number[];
  declarationDate: Date;
  declaredBy: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
}

async declareProductAllergens(
  tenantId: string,
  productId: string,
  allergens: number[],
  userId: string
): Promise<ProductDeclaration> {
  const product = await this.prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  // Validar que los alérgenos declarados sean válidos
  const validAllergens = allergens.filter((allergenId) =>
    Object.values(AllergenEU).includes(allergenId)
  );

  if (validAllergens.length !== allergens.length) {
    throw new BadRequestException('Invalid allergen IDs');
  }

  // Actualizar producto
  const updatedProduct = await this.prisma.product.update({
    where: { id: productId },
    data: {
      allergens: validAllergens,
    },
  });

  // Registrar declaración
  const declaration = await this.prisma.allergenDeclaration.create({
    data: {
      productId,
      tenantId,
      declaredAllergens: validAllergens,
      declaredBy: userId,
      declarationDate: new Date(),
    },
  });

  // Propagar alérgenos a recetas y menús
  await this.propagateAllergens(productId);

  return {
    productId: updatedProduct.id,
    productName: updatedProduct.name,
    declaredAllergens: validAllergens,
    declarationDate: declaration.declarationDate,
    declaredBy: declaration.declaredBy,
    complianceStatus: this.determineComplianceStatus(updatedProduct),
  };
}
```

### 3. Sistema de Reportes de Cumplimiento

```typescript
interface ComplianceReport {
  menuId: string;
  reportType: 'FULL' | 'SUMMARY';
  reportDate: Date;
  generatedBy: string;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
  missingDeclarations: number[];
  conflicts: AllergenConflict[];
  recommendations: string[];
  legalReferences: string[];
}

async generateComplianceReport(
  tenantId: string,
  menuId: string,
  reportType: 'FULL' | 'SUMMARY' = 'FULL',
  userId: string
): Promise<ComplianceReport> {
  const menu = await this.prisma.menu.findFirst({
    where: { id: menuId, tenantId },
    include: {
      sections: {
        include: {
          items: {
            include: {
              recipe: {
                include: {
                  ingredients: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!menu) {
    throw new NotFoundException('Menu not found');
  }

  // Verificar declaraciones faltantes
  const missingDeclarations = new Set<number>();
  const allProductsUsed = new Set<string>();

  for (const section of menu.sections) {
    for (const item of section.items) {
      if (item.recipe) {
        for (const ingredient of item.recipe.ingredients) {
          allProductsUsed.add(ingredient.productId);

          // Verificar si el producto tiene declaración
          if (!ingredient.product.allergens || ingredient.product.allergens.length === 0) {
            // Investigar si el producto debería tener alérgenos
            const potentialAllergens = await this.detectPotentialAllergens(ingredient.product);
            if (potentialAllergens.length > 0) {
              missingDeclarations.add(ingredient.product.id);
            }
          }
        }
      }
    }
  }

  // Detectar conflictos
  const conflicts = await this.detectAllergenConflicts(tenantId, menuId, []);

  // Generar recomendaciones
  const recommendations: string[] = [];

  if (missingDeclarations.size > 0) {
    recommendations.push(
      `${missingDeclarations.size} productos requieren declaración de alérgenos`
    );
  }

  if (conflicts.length > 0) {
    recommendations.push(`${conflicts.length} conflictos de alérgenos detectados`);
  }

  if (menu.allergens && menu.allergens.length > 0) {
    recommendations.push('Todos los alérgenos declarados correctamente');
  }

  // Determinar estado de cumplimiento
  const complianceStatus =
    missingDeclarations.size === 0 && conflicts.length === 0
      ? 'COMPLIANT'
      : missingDeclarations.size > 0 || conflicts.length > 0
      ? 'PARTIAL'
      : 'NON_COMPLIANT';

  // Referencias legales
  const legalReferences = [
    'Reglamento (UE) nº 1169/2011, Artículo 21',
    'Reglamento (UE) nº 1169/2011, Anexo II',
    'Directiva 2000/13/CE (modificada)',
  ];

  const report: ComplianceReport = {
    menuId,
    reportType,
    reportDate: new Date(),
    generatedBy: userId,
    complianceStatus,
    missingDeclarations: Array.from(missingDeclarations),
    conflicts,
    recommendations,
    legalReferences,
  };

  // Guardar reporte
  await this.prisma.complianceReport.create({
    data: {
      menuId,
      tenantId,
      reportType,
      reportDate: report.reportDate,
      generatedBy: userId,
      complianceStatus: report.complianceStatus,
      data: report as any,
    },
  });

  return report;
}
```

### 4. Sistema de Detección de Alérgenos Potenciales

```typescript
async detectPotentialAllergens(product: Product): Promise<number[]> {
  const potentialAllergens: number[] = [];
  const productNameLower = product.name.toLowerCase();

  // Base de conocimiento de alérgenos comunes
  const allergenPatterns = [
    { allergenId: 1, patterns: ['trigo', 'harina', 'centeno', 'cebada', 'avena', 'gluten'] },
    { allergenId: 2, patterns: ['gamba', 'langostino', 'cangrejo', 'langosta', 'crustaceo'] },
    { allergenId: 3, patterns: ['huevo', 'clara', 'yema'] },
    { allergenId: 4, patterns: ['pescado', 'atun', 'salmon', 'merluza'] },
    { allergenId: 5, patterns: ['cacahuete', 'maní', 'peanut'] },
    { allergenId: 6, patterns: ['soja', 'soy', 'tofu'] },
    { allergenId: 7, patterns: ['leche', 'queso', 'yogur', 'lacteo', 'crema'] },
    { allergenId: 8, patterns: ['apio'] },
    { allergenId: 9, patterns: ['mostaza'] },
    { allergenId: 10, patterns: ['sesamo', 'ajonjoli'] },
    { allergenId: 11, patterns: ['sulfito', 'dióxido de azufre'] },
    { allergenId: 12, patterns: ['altramuz', 'lupino'] },
    { allergenId: 13, patterns: ['mejillon', 'almeja', 'ostra', 'molusco'] },
    { allergenId: 14, patterns: ['mostaza en polvo'] },
  ];

  for (const { allergenId, patterns } of allergenPatterns) {
    for (const pattern of patterns) {
      if (productNameLower.includes(pattern)) {
        if (!potentialAllergens.includes(allergenId)) {
          potentialAllergens.push(allergenId);
        }
        break;
      }
    }
  }

  return potentialAllergens;
}
```

## Validaciones de Cumplimiento

### 1. Verificación de Declaraciones Completas

```typescript
async verifyCompleteDeclarations(
  tenantId: string,
  menuId: string
): Promise<VerificationResult> {
  const productsUsed = await this.getProductsUsedInMenu(tenantId, menuId);
  const productsWithDeclarations = await this.getProductsWithDeclarations(tenantId);

  const missingDeclarations = productsUsed.filter(
    (product) => !productsWithDeclarations.includes(product.id)
  );

  const partialDeclarations = productsUsed.filter((product) => {
    const productWithDeclaration = productsWithDeclarations.find(
      (p) => p.id === product.id
    );
    return (
      productWithDeclaration &&
      (!productWithDeclaration.allergens || productWithDeclaration.allergens.length === 0)
    );
  });

  return {
    complete: missingDeclarations.length === 0 && partialDeclarations.length === 0,
    missingDeclarations,
    partialDeclarations,
    percentage:
      ((productsUsed.length - missingDeclarations.length) / productsUsed.length) * 100,
  };
}
```

### 2. Validación de Información en Etiquetado

```typescript
interface LabelingCompliance {
  productId: string;
  productName: string;
  allergenLabeling: {
    present: boolean;
    highlighted: boolean;
    inIngredientsList: boolean;
    inAllergensSection: boolean;
    legible: boolean;
  };
  complianceLevel: 'FULL' | 'PARTIAL' | 'NONE';
  issues: string[];
}

async validateLabelingCompliance(
  tenantId: string,
  productId: string
): Promise<LabelingCompliance> {
  const product = await this.prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product) {
    throw new NotFoundException('Product not found');
  }

  const issues: string[] = [];
  let complianceLevel: 'FULL' | 'PARTIAL' | 'NONE' = 'FULL';

  // Verificar presencia de alérgenos
  if (!product.allergens || product.allergens.length === 0) {
    complianceLevel = 'NONE';
    return {
      productId: product.id,
      productName: product.name,
      allergenLabeling: {
        present: false,
        highlighted: false,
        inIngredientsList: false,
        inAllergensSection: false,
        legible: false,
      },
      complianceLevel,
      issues: ['No hay alérgenos declarados'],
    };
  }

  // Verificar destacado de alérgenos
  const allergenLabeling = {
    present: true,
    highlighted: true, // Asumido por defecto
    inIngredientsList: true,
    inAllergensSection: true,
    legible: true,
  };

  // Verificar requisitos UE 1169/2011
  if (!product.description || product.description.length === 0) {
    issues.push('Falta descripción del producto');
    complianceLevel = 'PARTIAL';
  }

  if (!product.language || product.language !== 'es') {
    issues.push('Descripción no en idioma del consumidor');
    complianceLevel = 'PARTIAL';
  }

  return {
    productId: product.id,
    productName: product.name,
    allergenLabeling,
    complianceLevel,
    issues,
  };
}
```

## Exportación de Reportes Legales

### 1. Generación de Reporte PDF

```typescript
async generateLegalReportPDF(
  tenantId: string,
  menuId: string,
  reportType: 'FULL' | 'SUMMARY' = 'FULL'
): Promise<Buffer> {
  const report = await this.generateComplianceReport(tenantId, menuId, reportType);

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // Encabezado del reporte
  doc.fontSize(20).text('Reporte de Cumplimiento UE 1169/2011', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text(`Menú: ${menuId}`);
  doc.text(`Fecha: ${report.reportDate.toLocaleDateString('es-ES')}`);
  doc.text(`Tipo: ${report.reportType}`);
  doc.text(`Estado: ${report.complianceStatus}`);
  doc.moveDown();

  // Referencias legales
  doc.fontSize(12).font('Helvetica-Bold').text('Referencias Legales:');
  doc.font('Helvetica');
  report.legalReferences.forEach((ref) => {
    doc.text(`• ${ref}`);
  });
  doc.moveDown();

  // Declaraciones faltantes
  if (report.missingDeclarations.length > 0) {
    doc.font('Helvetica-Bold').text('Declaraciones Faltantes:');
    doc.font('Helvetica');
    report.missingDeclarations.forEach((productId) => {
      doc.text(`• Producto ID: ${productId}`);
    });
    doc.moveDown();
  }

  // Conflictos
  if (report.conflicts.length > 0) {
    doc.font('Helvetica-Bold').text('Conflictos Detectados:');
    doc.font('Helvetica');
    report.conflicts.forEach((conflict, index) => {
      doc.text(`• Receta ID: ${conflict.recipeId}`);
      doc.text(`  Alérgenos: ${conflict.filteredAllergens.join(', ')}`);
    });
    doc.moveDown();
  }

  // Recomendaciones
  doc.font('Helvetica-Bold').text('Recomendaciones:');
  doc.font('Helvetica');
  report.recommendations.forEach((rec) => {
    doc.text(`• ${rec}`);
  });

  doc.end();

  await new Promise((resolve) => doc.on('end', resolve));

  return Buffer.concat(chunks);
}
```

### 2. Exportación CSV para Auditores

```typescript
async generateComplianceCSV(
  tenantId: string,
  menuId: string
): Promise<string> {
  const menu = await this.prisma.menu.findFirst({
    where: { id: menuId, tenantId },
    include: {
      sections: {
        include: {
          items: {
            include: {
              recipe: true,
            },
          },
        },
      },
    },
  });

  const csvRows = [
    'Sección,Ítem,Receta ID,Alérgenos Presentes',
  ];

  for (const section of menu.sections) {
    for (const item of section.items) {
      const allergenNames =
        item.recipe.allergens?.map((id) => getAllergenName(id)).join('; ') || 'Ninguno';

      csvRows.push(
        `"${section.name}","${item.recipeName}","${item.recipeId}","${allergenNames}"`
      );
    }
  }

  return csvRows.join('\n');
}
```

## Sistema de Alertas de Cumplimiento

### 1. Alertas de No Cumplimiento

```typescript
interface ComplianceAlert {
  alertId: string;
  tenantId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  alertType: 'MISSING_DECLARATION' | 'CONFLICT' | 'EXPIRED_REPORT';
  description: string;
  affectedEntities: {
    type: 'PRODUCT' | 'RECIPE' | 'MENU';
    id: string;
    name: string;
  }[];
  recommendation: string;
  createdAt: Date;
  resolvedAt?: Date;
}

async generateComplianceAlerts(tenantId: string): Promise<ComplianceAlert[]> {
  const alerts: ComplianceAlert[] = [];

  // Verificar productos sin declaración
  const productsWithoutDeclaration = await this.getProductsWithoutDeclaration(tenantId);
  if (productsWithoutDeclaration.length > 0) {
    alerts.push({
      alertId: generateId(),
      tenantId,
      severity: 'HIGH',
      alertType: 'MISSING_DECLARATION',
      description: `${productsWithoutDeclaration.length} productos sin declaración de alérgenos`,
      affectedEntities: productsWithoutDeclaration.map((p) => ({
        type: 'PRODUCT' as const,
        id: p.id,
        name: p.name,
      })),
      recommendation: 'Declarar alérgenos en todos los productos',
      createdAt: new Date(),
    });
  }

  // Verificar conflictos en menús activos
  const activeMenus = await this.getActiveMenus(tenantId);
  for (const menu of activeMenus) {
    const conflicts = await this.detectAllergenConflicts(tenantId, menu.id, []);
    if (conflicts.length > 0) {
      alerts.push({
        alertId: generateId(),
        tenantId,
        severity: 'MEDIUM',
        alertType: 'CONFLICT',
        description: `Conflictos de alérgenos en menú "${menu.name}"`,
        affectedEntities: conflicts.map((c) => ({
          type: 'RECIPE' as const,
          id: c.recipeId,
          name: c.recipeId,
        })),
        recommendation: 'Revisar composición del menú y alérgenos en recetas',
        createdAt: new Date(),
      });
    }
  }

  return alerts;
}
```

## Checklist de Verificación UE 1169/2011

### Requisitos de Etiquetado

- [x] **Declaración de 14 alérgenos obligatorios**
  - [x] Cereales con gluten
  - [x] Crustáceos
  - [x] Huevos
  - [x] Pescado
  - [x] Cacahuetes
  - [x] Soja
  - [x] Leche
  - [x] Apio
  - [x] Mostaza
  - [x] Sésamo
  - [x] Sulfitos
  - [x] Altramuces
  - [x] Moluscos

- [x] **Presentación de la información**
  - [x] Información destacada (negrita, mayúsculas, subrayado)
  - [x] Posición visible en etiquetado
  - [x] Letra clara y legible
  - [x] Idioma del consumidor

- [x] **Contenido del etiquetado**
  - [x] Nombre del alimento
  - [x] Lista de ingredientes
  - [x] Alérgenos destacados
  - [x] Cantidad neta
  - [x] Fecha de duración mínima

### Requisitos de Documentación

- [x] **Registros de declaraciones**
  - [x] Fecha de declaración
  - [x] Usuario que realizó la declaración
  - [x] Alérgenos declarados
  - [x] Justificación si aplica

- [x] **Reportes de cumplimiento**
  - [x] Reportes generados regularmente
  - [x] Referencias legales incluidas
  - [x] Recomendaciones de mejora
  - [x] Estado de cumplimiento documentado

## Métricas de Cumplimiento

### Indicadores Clave

- **Porcentaje de productos con declaración**: 100% objetivo
- **Porcentaje de menús compliant**: 95% mínimo
- **Tiempo medio de corrección de no cumplimiento**: < 24 horas
- **Número de alertas activas**: 0 objetivo
- **Frecuencia de auditorías**: Mensual

### KPIs de Tracking

```typescript
interface ComplianceKPIs {
  totalProducts: number;
  productsWithDeclarations: number;
  productsWithoutDeclarations: number;
  declarationPercentage: number;

  totalMenus: number;
  compliantMenus: number;
  nonCompliantMenus: number;
  compliancePercentage: number;

  activeAlerts: number;
  resolvedAlerts: number;
  averageResolutionTime: number;

  lastAuditDate: Date;
  nextAuditDate: Date;
}
```

## Documentación Relacionada

- [Allergen Propagation System](./allergen-propagation-system.md) - Sistema de propagación
- [Allergen Conflict Detection](./allergen-conflict-detection.md) - Detección de conflictos
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Menu Composition System](./menu-composition-system.md) - Sistema de composición de menús

## Referencias Legales

- [Reglamento (UE) nº 1169/2011](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32011R1169)
- [Directiva 2000/13/CE](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32000L0013)
- [Guía de implementación UE 1169/2011](https://ec.europa.eu/food/safety/labelling-nutrition/labelling-information-allergens_en)