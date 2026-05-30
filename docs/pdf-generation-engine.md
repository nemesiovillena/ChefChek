# PDF Generation Engine - ChefChek

## Motor de Generación de PDF

ChefChek implementa un motor robusto de generación de documentos PDF utilizando PDFKit para crear fichas técnicas profesionales, optimizadas y listas para impresión o distribución digital.

## Arquitectura del Motor

### Flujo de Generación

```
Receta + Plantilla → Data Collector → Layout Engine → PDF Generator → Output
     │                │               │              │             │
     ├─ Datos receta  ├─ Extraer       ├─ Aplicar      ├─ Rendering  ├─ Buffer PDF
     ├─ Config plant  ├─ Calcular      ├─ Posicionar   ├─ Estilos    ├─ Validar
     └─ Opciones      ├─ Transformar  ├─ Paginar      └─ Optimizar └─ Comprimir
```

### Componentes del Motor

**1. Data Collector**
- Extracción de datos de recetas
- Cálculo de valores derivados
- Normalización de formatos
- Validación de datos

**2. Layout Engine**
- Aplicación de plantillas
- Posicionamiento de elementos
- Gestión de espacios
- Paginación automática

**3. PDF Generator**
- Rendering nativo PDFKit
- Generación de texto, tablas, gráficos
- Aplicación de estilos y branding
- Optimización de tamaño

**4. Output Manager**
- Validación de PDF
- Compresión optimizada
- Metadata y propiedades
- Exportación y almacenamiento

## Implementación del Motor

### 1. Clase Principal del Motor

```typescript
import PDFDocument from 'pdfkit';
import blobStream from 'blob-stream';

interface PDFGenerationOptions {
  format: 'A4' | 'LETTER';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  quality: 'STANDARD' | 'HIGH';
  margins?: { top: number; bottom: number; left: number; right: number };
  watermark?: string;
  branding?: BrandingConfig;
  metadata?: PDFMetadata;
}

interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
}

class PDFGenerationEngine {
  private doc: PDFDocument;
  private chunks: Buffer[];
  private options: PDFGenerationOptions;

  constructor(options: PDFGenerationOptions) {
    this.options = options;
    this.chunks = [];
  }

  async generate(content: any, template: any): Promise<Buffer> {
    // Crear documento PDF
    this.doc = new PDFDocument({
      size: this.getPageSize(),
      margins: this.options.margins || { top: 50, bottom: 50, left: 50, right: 50 },
      info: this.options.metadata,
    });

    // Configurar captura de datos
    this.doc.on('data', (chunk) => this.chunks.push(chunk));

    // Aplicar branding si está configurado
    if (this.options.branding) {
      this.applyBranding();
    }

    // Generar contenido según plantilla
    await this.renderContent(content, template);

    // Aplicar watermark si está configurado
    if (this.options.watermark) {
      this.applyWatermark();
    }

    // Finalizar documento
    this.doc.end();

    // Esperar generación completa
    await new Promise((resolve) => this.doc.on('end', resolve));

    // Retornar buffer PDF
    const pdfBuffer = Buffer.concat(this.chunks);

    // Optimizar si es calidad alta
    if (this.options.quality === 'HIGH') {
      return await this.optimizePDF(pdfBuffer);
    }

    return pdfBuffer;
  }

  private getPageSize(): [number, number] {
    const formats = {
      A4: [595.28, 841.89],
      LETTER: [612, 792],
    };

    const size = formats[this.options.format] || formats.A4;

    if (this.options.orientation === 'LANDSCAPE') {
      return [size[1], size[0]];
    }

    return size;
  }
}
```

### 2. Sistema de Rendering

```typescript
class PDFRenderer {
  private doc: PDFDocument;
  private template: any;
  private styles: any;
  private currentY: number;

  constructor(doc: PDFDocument, template: any) {
    this.doc = doc;
    this.template = template;
    this.styles = template.styles || this.getDefaultStyles();
    this.currentY = 50;
  }

  async renderContent(content: any, template: any): Promise<void> {
    const layout = template.layout;

    // Renderizar secciones en orden
    for (const [sectionName, section] of Object.entries(layout)) {
      if (section.visible) {
        await this.renderSection(sectionName, content, section);
      }
    }
  }

  private async renderSection(
    sectionName: string,
    content: any,
    section: any
  ): Promise<void> {
    switch (sectionName) {
      case 'header':
        await this.renderHeader(content);
        break;
      case 'generalInfo':
        await this.renderGeneralInfo(content);
        break;
      case 'ingredients':
        await this.renderIngredients(content);
        break;
      case 'preparation':
        await this.renderPreparation(content);
        break;
      case 'nutrition':
        await this.renderNutrition(content);
        break;
      case 'footer':
        await this.renderFooter(content);
        break;
    }
  }

  private renderHeader(content: any): void {
    this.doc.fontSize(this.styles.headerFontSize || 18).font('Helvetica-Bold');

    // Título principal
    this.doc.text('FICHA TÉCNICA', { align: 'center' });
    this.currentY = this.doc.y;

    this.doc.fontSize(24).font('Helvetica-Bold');
    this.doc.text(content.name, { align: 'center' });
    this.currentY = this.doc.y;

    // Código si existe
    if (content.code) {
      this.doc.fontSize(12).font('Helvetica');
      this.doc.text(`Código: ${content.code}`, { align: 'center' });
      this.currentY = this.doc.y;
    }

    // Espacio después de cabecera
    this.addSpacing(20);
  }

  private renderGeneralInfo(content: any): void {
    this.addSectionTitle('INFORMACIÓN GENERAL');

    const info = [
      { label: 'Porciones:', value: content.yield || 1 },
      { label: 'Rendimiento:', value: `${content.portionWeight || 100}g` },
      { label: 'Tiempo preparación:', value: `${content.preparationTime || 30} min` },
      { label: 'Tiempo cocción:', value: `${content.cookingTime || 60} min` },
      { label: 'Método cocción:', value: content.cookingMethod || 'No especificado' },
    ];

    info.forEach(({ label, value }) => {
      this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');
      this.doc.text(`${label} ${value}`);
      this.currentY = this.doc.y;
    });

    this.addSpacing(10);
  }

  private renderIngredients(content: any): void {
    this.addSectionTitle('INGREDIENTES');

    this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');

    let totalCost = 0;

    content.ingredients.forEach((ingredient, index) => {
      const cost = this.calculateIngredientCost(ingredient);
      totalCost += cost;

      // Número y nombre de ingrediente
      this.doc.text(
        `${index + 1}. ${ingredient.product.name} - ${ingredient.quantity} ${ingredient.unit || 'g'}`
      );
      this.currentY = this.doc.y;

      // Costo si está configurado
      if (this.options.includeCosts) {
        this.doc.fontSize(10).font('Helvetica');
        this.doc.text(`   Costo: €${cost.toFixed(2)}`, { continued: false });
        this.currentY = this.doc.y;
        this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');
      }

      // Alérgenos si está configurado
      if (this.options.includeAllergens && ingredient.product.allergens) {
        const allergenNames = ingredient.product.allergens.map((id) =>
          this.getAllergenName(id)
        );
        if (allergenNames.length > 0) {
          this.doc.text(`   Alérgenos: ${allergenNames.join(', ')}`);
          this.currentY = this.doc.y;
        }
      }

      this.addSpacing(5);
    });

    // Total de costos
    if (this.options.includeCosts) {
      this.addSpacing(10);
      this.doc.fontSize(14).font('Helvetica-Bold');
      this.doc.text(`Costo Total Ingredientes: €${totalCost.toFixed(2)}`);
      this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');
    }

    this.addSpacing(10);
  }

  private renderPreparation(content: any): void {
    this.addSectionTitle('ELABORACIÓN');

    const steps = this.parsePreparationSteps(content.elaboration);

    steps.forEach((step, index) => {
      this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');
      this.doc.text(`${index + 1}. ${step.text}`);
      this.currentY = this.doc.y;

      if (step.time) {
        this.doc.text(`   Tiempo: ${step.time}`);
        this.currentY = this.doc.y;
      }

      if (step.temperature) {
        this.doc.text(`   Temperatura: ${step.temperature}`);
        this.currentY = this.doc.y;
      }

      this.addSpacing(5);
    });

    this.addSpacing(10);
  }

  private renderNutrition(content: any): void {
    this.addSectionTitle('INFORMACIÓN NUTRICIONAL (Estimada)');

    const nutrition = this.calculateNutrition(content);

    const info = [
      { label: 'Energía:', value: `${nutrition.calories} kcal` },
      { label: 'Proteínas:', value: `${nutrition.proteins}g` },
      { label: 'Carbohidratos:', value: `${nutrition.carbs}g` },
      { label: 'Grasas:', value: `${nutrition.fats}g` },
      { label: 'Fibra:', value: `${nutrition.fiber}g` },
    ];

    info.forEach(({ label, value }) => {
      this.doc.fontSize(this.styles.fontSize || 12).font('Helvetica');
      this.doc.text(`${label} ${value}`);
      this.currentY = this.doc.y;
    });

    this.addSpacing(10);
  }

  private renderFooter(content: any): void {
    this.doc.fontSize(10).font('Helvetica');

    // Información de empresa
    if (this.options.branding?.companyName) {
      this.doc.text(this.options.branding.companyName, { align: 'center' });
      this.currentY = this.doc.y;
    }

    if (this.options.branding?.address) {
      this.doc.text(this.options.branding.address, { align: 'center' });
      this.currentY = this.doc.y;
    }

    if (this.options.branding?.contact) {
      this.doc.text(this.options.branding.contact, { align: 'center' });
      this.currentY = this.doc.y;
    }

    // Fecha de generación
    this.addSpacing(10);
    this.doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, {
      align: 'center',
    });
  }

  private addSectionTitle(title: string): void {
    this.addSpacing(10);
    this.doc.fontSize(16).font('Helvetica-Bold');
    this.doc.text(title);
    this.currentY = this.doc.y;
  }

  private addSpacing(amount: number): void {
    this.doc.moveDown(amount / 10);
    this.currentY = this.doc.y;
  }

  private calculateIngredientCost(ingredient: any): number {
    const costPerKg = ingredient.product.cost || 0;
    const quantityInKg = (ingredient.quantity || 0) / 1000;
    return costPerKg * quantityInKg;
  }

  private calculateNutrition(recipe: any): any {
    let calories = 0;
    let proteins = 0;
    let carbs = 0;
    let fats = 0;
    let fiber = 0;

    recipe.ingredients.forEach((ingredient) => {
      const quantityInGrams = ingredient.quantity || 0;
      const factor = quantityInGrams / 100;

      calories += (ingredient.product.calories || 0) * factor;
      proteins += (ingredient.product.proteins || 0) * factor;
      carbs += (ingredient.product.carbs || 0) * factor;
      fats += (ingredient.product.fats || 0) * factor;
      fiber += (ingredient.product.fiber || 0) * factor;
    });

    return {
      calories: Math.round(calories),
      proteins: Math.round(proteins * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
      fiber: Math.round(fiber * 10) / 10,
    };
  }

  private parsePreparationSteps(elaboration: string): Array<{ text: string; time?: string; temperature?: string }> {
    if (!elaboration) return [{ text: 'No hay pasos de elaboración especificados' }];

    const steps = elaboration.split('\n').filter((step) => step.trim());
    return steps.map((step) => ({
      text: step,
    }));
  }

  private getAllergenName(allergenId: number): string {
    const allergens: Record<number, string> = {
      1: 'Cereales con Gluten',
      2: 'Crustáceos',
      3: 'Huevos',
      4: 'Pescado',
      5: 'Cacahuetes',
      6: 'Soya',
      7: 'Leche',
      8: 'Apio',
      9: 'Mostaza',
      10: 'Semillas de Sésamo',
      11: 'Sulfitos',
      12: 'Altramuces',
      13: 'Moluscos',
      14: 'Mostaza en Polvo',
    };

    return allergens[allergenId] || `Alérgeno ${allergenId}`;
  }

  private getDefaultStyles(): any {
    return {
      primaryColor: '#1f2937',
      secondaryColor: '#6b7280',
      fontFamily: 'Helvetica',
      fontSize: 12,
      headerFontSize: 18,
      lineWidth: 1,
    };
  }
}
```

### 3. Sistema de Branding

```typescript
class PDFBranding {
  applyBranding(doc: PDFDocument, config: BrandingConfig): void {
    // Aplicar colores personalizados
    if (config.primaryColor) {
      doc.fillColor(config.primaryColor);
    }

    // Aplicar logo si existe
    if (config.logoUrl) {
      this.embedLogo(doc, config.logoUrl);
    }
  }

  private async embedLogo(doc: PDFDocument, logoUrl: string): Promise<void> {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
      doc.image(logoBuffer, { fit: [100, 100], align: 'left', valign: 'top' });
    } catch (error) {
      console.error('Error embedding logo:', error);
    }
  }
}
```

### 4. Sistema de Watermarks

```typescript
class PDFWatermarks {
  applyWatermark(doc: PDFDocument, text: string): void {
    doc.save();
    doc.opacity(0.1);
    doc.fontSize(60);
    doc.rotate(-45, { origin: [150, 300] });
    doc.text(text, 100, 300);
    doc.restore();
  }
}
```

### 5. Sistema de Optimización

```typescript
class PDFOptimizer {
  async optimizePDF(pdfBuffer: Buffer): Promise<Buffer> {
    // Opciones de optimización
    const optimizationLevel = 3;

    // Simular optimización (en producción usar librería como pdf-lib)
    let optimized = pdfBuffer;

    if (optimizationLevel >= 1) {
      optimized = await this.compressImages(optimized);
    }

    if (optimizationLevel >= 2) {
      optimized = await this.optimizeFonts(optimized);
    }

    if (optimizationLevel >= 3) {
      optimized = await this.removeUnusedObjects(optimized);
    }

    return optimized;
  }

  private async compressImages(pdfBuffer: Buffer): Promise<Buffer> {
    // En producción usar librerías de compresión de imágenes
    return pdfBuffer;
  }

  private async optimizeFonts(pdfBuffer: Buffer): Promise<Buffer> {
    // En producción usar subsetting de fuentes
    return pdfBuffer;
  }

  private async removeUnusedObjects(pdfBuffer: Buffer): Promise<Buffer> {
    // En producción usar librerías de limpieza de PDF
    return pdfBuffer;
  }
}
```

## Generación Avanzada

### 1. Tablas Dinámicas

```typescript
class PDFTableGenerator {
  generateTable(doc: PDFDocument, data: any[], columns: ColumnConfig[]): void {
    const { x, y } = this.calculateTablePosition(doc);
    const { columnWidths, tableWidth } = this.calculateColumnWidths(columns);

    // Dibujar cabecera de tabla
    this.drawTableHeader(doc, x, y, columns, columnWidths);

    // Dibujar filas de datos
    let currentY = y + 20;
    data.forEach((row, rowIndex) => {
      currentY = this.drawTableRow(doc, x, currentY, row, columns, columnWidths);
      currentY += 5;
    });

    // Dibujar bordes de tabla
    this.drawTableBorders(doc, x, y, tableWidth, currentY - y);
  }

  private calculateColumnWidths(columns: ColumnConfig[]): {
    columnWidths: number[];
    tableWidth: number;
  } {
    const availableWidth = 495;
    const columnWidths = columns.map((col) => {
      return availableWidth * (col.width || 1 / columns.length);
    });

    return { columnWidths, tableWidth: availableWidth };
  }

  private drawTableHeader(
    doc: PDFDocument,
    x: number,
    y: number,
    columns: ColumnConfig[],
    columnWidths: number[]
  ): void {
    let currentX = x;

    columns.forEach((column, index) => {
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(column.label, currentX + 5, y);
      currentX += columnWidths[index];
    });
  }

  private drawTableRow(
    doc: PDFDocument,
    x: number,
    y: number,
    row: any,
    columns: ColumnConfig[],
    columnWidths: number[]
  ): number {
    let currentX = x;
    let maxHeight = 20;

    columns.forEach((column, index) => {
      const value = row[column.field] || '';
      doc.fontSize(9).font('Helvetica');
      doc.text(value.toString(), currentX + 5, y);
      currentX += columnWidths[index];
    });

    return y + maxHeight;
  }

  private drawTableBorders(
    doc: PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    doc.lineWidth(1);

    // Borde exterior
    doc.rect(x, y, width, height);

    // Líneas horizontales
    doc.moveTo(x, y + 20);
    doc.lineTo(x + width, y + 20);
    doc.stroke();
  }
}
```

### 2. Gráficos y Visualizaciones

```typescript
class PDFChartGenerator {
  generateBarChart(
    doc: PDFDocument,
    data: ChartData,
    position: { x: number; y: number }
  ): void {
    const { x, y } = position;
    const chartWidth = 400;
    const chartHeight = 200;
    const barWidth = chartWidth / data.labels.length - 10;

    // Dibujar ejes
    this.drawAxes(doc, x, y, chartWidth, chartHeight);

    // Dibujar barras
    data.values.forEach((value, index) => {
      const barHeight = (value / Math.max(...data.values)) * chartHeight;
      const barX = x + 10 + index * (barWidth + 10);
      const barY = y + chartHeight - barHeight;

      doc.rect(barX, barY, barWidth, barHeight);

      // Etiquetas
      doc.fontSize(8).font('Helvetica');
      doc.text(data.labels[index], barX, y + chartHeight + 10);
      doc.text(value.toString(), barX, barY - 10);
    });
  }

  generatePieChart(
    doc: PDFDocument,
    data: ChartData,
    position: { x: number; y: number }
  ): void {
    const { x, y } = position;
    const radius = 100;
    const centerX = x + radius;
    const centerY = y + radius;

    let currentAngle = 0;
    const total = data.values.reduce((sum, val) => sum + val, 0);

    data.values.forEach((value, index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      const color = this.getColor(index);

      doc.fillColor(color);
      doc.moveTo(centerX, centerY);
      doc.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      doc.fill();

      // Etiqueta del segmento
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 30);

      doc.fontSize(8).font('Helvetica');
      doc.fillColor('black');
      doc.text(data.labels[index], labelX, labelY);

      currentAngle += sliceAngle;
    });
  }

  private drawAxes(
    doc: PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    doc.lineWidth(1);
    doc.strokeColor('black');

    // Eje Y
    doc.moveTo(x, y);
    doc.lineTo(x, y + height);
    doc.stroke();

    // Eje X
    doc.moveTo(x, y + height);
    doc.lineTo(x + width, y + height);
    doc.stroke();
  }

  private getColor(index: number): string {
    const colors = [
      '#1f2937',
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
    ];
    return colors[index % colors.length];
  }
}
```

### 3. Multi-pagina con Headers Repetibles

```typescript
class PDFMultiPage {
  generateMultiPageDocument(
    content: any[],
    template: any
  ): Buffer {
    const doc = new PDFDocument({ margins: { top: 100, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Header para todas las páginas
    doc.registerFont('header', customFont);
    doc.on('pageAdded', () => {
      this.addHeader(doc, template);
    });

    content.forEach((item, index) => {
      if (index > 0) {
        doc.addPage();
      }

      this.renderContentPage(doc, item, template);
    });

    doc.end();

    await new Promise((resolve) => doc.on('end', resolve));

    return Buffer.concat(chunks);
  }

  private addHeader(doc: PDFDocument, template: any): void {
    const { width, height } = doc.page;

    doc.y = 20;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('FICHA TÉCNICA', { align: 'center' });

    doc.moveTo(50, 50);
    doc.lineTo(width - 50, 50);
    doc.stroke();
  }

  private renderContentPage(doc: PDFDocument, content: any, template: any): void {
    const renderer = new PDFRenderer(doc, template);
    renderer.renderContent(content, template);
  }
}
```

## Validación y Calidad

### 1. Validación de PDF

```typescript
class PDFValidator {
  validatePDF(pdfBuffer: Buffer): PDFValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Intentar cargar el PDF
      PDFDocument.load(pdfBuffer);

      // Verificar tamaño mínimo
      if (pdfBuffer.length < 1000) {
        warnings.push({
          type: 'SIZE',
          message: 'El PDF es muy pequeño, puede estar corrupto',
        });
      }

      // Verificar tamaño máximo
      if (pdfBuffer.length > 10 * 1024 * 1024) {
        warnings.push({
          type: 'SIZE',
          message: 'El PDF es muy grande, podría afectar rendimiento',
        });
      }

      return {
        isValid: true,
        issues,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [
          {
            type: 'CORRUPT',
            message: 'El PDF está corrupto o inválido',
          },
        ],
        warnings,
      };
    }
  }

  checkCompliance(pdfBuffer: Buffer): ComplianceReport {
    const checks: ComplianceCheck[] = [];

    checks.push({
      name: 'Validar estructura PDF',
      status: this.validateStructure(pdfBuffer) ? 'PASS' : 'FAIL',
    });

    checks.push({
      name: 'Verificar tamaño optimizado',
      status: pdfBuffer.length < 5 * 1024 * 1024 ? 'PASS' : 'WARN',
    });

    checks.push({
      name: 'Validar metadata',
      status: this.validateMetadata(pdfBuffer) ? 'PASS' : 'WARN',
    });

    const failedChecks = checks.filter((c) => c.status === 'FAIL');

    return {
      isCompliant: failedChecks.length === 0,
      checks,
      score: Math.round((1 - failedChecks.length / checks.length) * 100),
    };
  }

  private validateStructure(pdfBuffer: Buffer): boolean {
    try {
      PDFDocument.load(pdfBuffer);
      return true;
    } catch {
      return false;
    }
  }

  private validateMetadata(pdfBuffer: Buffer): boolean {
    // En producción verificar metadatos del PDF
    return true;
  }
}
```

### 2. Métricas de Calidad

```typescript
interface PDFQualityMetrics {
  fileSize: number;
  pageCount: number;
  renderingTime: number;
  textDensity: number;
  imageCount: number;
  fontEmbedding: boolean;
  compressionRatio: number;
}

class PDFQualityAnalyzer {
  analyzePDF(pdfBuffer: Buffer, renderingTime: number): PDFQualityMetrics {
    return {
      fileSize: pdfBuffer.length,
      pageCount: this.countPages(pdfBuffer),
      renderingTime,
      textDensity: this.calculateTextDensity(pdfBuffer),
      imageCount: this.countImages(pdfBuffer),
      fontEmbedding: this.checkFontEmbedding(pdfBuffer),
      compressionRatio: this.calculateCompressionRatio(pdfBuffer),
    };
  }

  private countPages(pdfBuffer: Buffer): number {
    // En producción analizar estructura PDF para contar páginas
    return 1;
  }

  private calculateTextDensity(pdfBuffer: Buffer): number {
    // En producción analizar contenido de texto
    return 0.5;
  }

  private countImages(pdfBuffer: Buffer): number {
    // En producción buscar objetos de imagen en PDF
    return 0;
  }

  private checkFontEmbedding(pdfBuffer: Buffer): boolean {
    // En producción verificar fuentes embebidas
    return true;
  }

  private calculateCompressionRatio(pdfBuffer: Buffer): number {
    // Estimar ratio de compresión
    return 0.8;
  }
}
```

## Testing del Motor

### Tests de Generación

```typescript
describe('PDF Generation Engine', () => {
  it('should generate valid PDF document', async () => {
    const recipe = createTestRecipe();
    const template = createStandardTemplate();

    const engine = new PDFGenerationEngine({
      format: 'A4',
      orientation: 'PORTRAIT',
      quality: 'STANDARD',
    });

    const pdfBuffer = await engine.generate(recipe, template);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });

  it('should apply custom branding', async () => {
    const recipe = createTestRecipe();
    const template = createStandardTemplate();

    const branding: BrandingConfig = {
      companyName: 'Test Company',
      address: 'Test Address',
      contact: 'test@test.com',
    };

    const engine = new PDFGenerationEngine({
      format: 'A4',
      orientation: 'PORTRAIT',
      quality: 'STANDARD',
      branding,
    });

    const pdfBuffer = await engine.generate(recipe, template);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });

  it('should generate multi-page document', async () => {
    const recipes = createTestRecipes(5);
    const template = createStandardTemplate();

    const engine = new PDFMultiPage();

    const pdfBuffer = engine.generateMultiPageDocument(recipes, template);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(10000);
  });
});
```

## Documentación Relacionada

- [Technical Sheet Generation](./technical-sheet-generation.md) - Generación de fichas técnicas
- [Template System Architecture](./template-system-architecture.md) - Sistema de plantillas
- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas