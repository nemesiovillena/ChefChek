import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { calculateProductCostPerUnit } from "../../common/utils/product-costing.util";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  GenerateSheetDto,
  GenerateBatchDto,
} from "./dto/technical-sheets.dto";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class TechnicalSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(
    tenantId: string,
    userId: string,
    dto: CreateTemplateDto,
  ): Promise<any> {
    const template = await this.prisma.technicalSheetTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        layout: dto.layout || this.getDefaultLayout(),
        fields: dto.fields || this.getDefaultFields(),
        styles: dto.styles || (this.getDefaultStyles() as any),
        createdBy: userId,
      } as any,
    });

    return {
      success: true,
      data: template,
    };
  }

  async getTemplates(tenantId: string): Promise<any[]> {
    return await this.prisma.technicalSheetTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTemplate(tenantId: string, templateId: string): Promise<any> {
    const template = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    return template;
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    dto: UpdateTemplateDto,
  ): Promise<any> {
    const existing = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Template not found");
    }

    const template = await this.prisma.technicalSheetTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.layout && { layout: dto.layout }),
        ...(dto.fields && { fields: dto.fields }),
        ...(dto.styles && { styles: dto.styles as any }),
      } as any,
    });

    return {
      success: true,
      data: template,
    };
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<any> {
    const existing = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Template not found");
    }

    await this.prisma.technicalSheetTemplate.delete({
      where: { id: templateId },
    });

    return {
      success: true,
      message: "Template deleted successfully",
    };
  }

  async generateTechnicalSheet(
    tenantId: string,
    userId: string,
    dto: GenerateSheetDto,
  ): Promise<Buffer> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: dto.recipeId, tenantId },
      include: {
        ingredients: {
          include: { product: true },
        },
        subRecipes: {
          include: { subRecipe: true },
        },
        translations: true,
      },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    const template = dto.templateId
      ? await this.prisma.technicalSheetTemplate.findFirst({
          where: { id: dto.templateId, tenantId },
        })
      : await this.getOrCreateDefaultTemplate(tenantId, userId);

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    const pdfBuffer = await this.generatePDF(recipe, template, dto);

    const document = await this.prisma.document.create({
      data: {
        tenantId,
        name: `Ficha Técnica - ${recipe.name}`,
        type: "TECHNICAL_SHEET",
        category: "RECIPES",
        recipeId: recipe.id,
        templateId: template.id,
        version: 1,
        createdBy: userId,
        fileSize: pdfBuffer.length,
        fileFormat: "PDF",
        url: `/documents/${this.generateDocumentId()}`,
      },
    });

    return pdfBuffer;
  }

  async generateBatch(
    tenantId: string,
    userId: string,
    dto: GenerateBatchDto,
  ): Promise<Buffer> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        id: { in: dto.recipeIds },
        tenantId,
      },
      include: {
        ingredients: {
          include: { product: true },
        },
        translations: true,
      },
    });

    if (recipes.length === 0) {
      throw new NotFoundException("No recipes found");
    }

    const template = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    if (dto.mergeIntoOne) {
      return await this.generateMergedPDF(recipes, template, dto);
    } else {
      const zipBuffers = [];
      for (const recipe of recipes) {
        const sheet = await this.generatePDF(recipe, template, dto as any);
        zipBuffers.push(sheet);
      }
      return zipBuffers[0];
    }
  }

  async getDocuments(tenantId: string, filters?: any): Promise<any[]> {
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

    return await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getDocument(tenantId: string, documentId: string): Promise<any> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return document;
  }

  async deleteDocument(tenantId: string, documentId: string): Promise<any> {
    const existing = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Document not found");
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return {
      success: true,
      message: "Document deleted successfully",
    };
  }

  private async generatePDF(
    recipe: any,
    template: any,
    options: GenerateSheetDto,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: options.format === "LETTER" ? [612, 792] : [595.28, 841.89],
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const styles = template.styles || this.getDefaultStyles();
    // Los templates seed pueden traer layout vacío ({}); sin este fallback
    // ninguna sección sería visible y el PDF saldría en blanco.
    const layout = template.layout?.header
      ? template.layout
      : this.getDefaultLayout();

    if (layout.header.visible) {
      this.generateHeader(doc, recipe, template, styles);
    }

    if (layout.generalInfo.visible) {
      this.generateGeneralInfo(doc, recipe, template, styles);
    }

    if (layout.ingredients.visible) {
      this.generateIngredients(doc, recipe, template, styles, options);
    }

    if (layout.preparation.visible) {
      this.generatePreparation(doc, recipe, template, styles);
    }

    if (layout.nutrition.visible) {
      this.generateNutrition(doc, recipe, template, styles);
    }

    if (layout.footer.visible) {
      this.generateFooter(doc, template, styles, options);
    }

    doc.end();

    await new Promise((resolve) => doc.on("end", resolve));

    return Buffer.concat(chunks);
  }

  private generateHeader(
    doc: any,
    recipe: any,
    template: any,
    styles: any,
  ): void {
    doc.fontSize(styles.headerFontSize || 18).font("Helvetica-Bold");
    doc.text("FICHA TÉCNICA", { align: "center" });
    doc.moveDown();

    doc.fontSize(24).font("Helvetica-Bold");
    doc.text(recipe.name, { align: "center" });
    doc.moveDown();

    if (recipe.description) {
      doc.fontSize(styles.fontSize || 12).font("Helvetica");
      doc.text(recipe.description, { align: "center" });
      doc.moveDown();
    }
  }

  private generateGeneralInfo(
    doc: any,
    recipe: any,
    template: any,
    styles: any,
  ): void {
    doc.fontSize(16).font("Helvetica-Bold");
    doc.text("INFORMACIÓN GENERAL");
    doc.moveDown();

    doc.fontSize(styles.fontSize || 12).font("Helvetica");

    const info = [
      [`Código:`, recipe.code || "N/A"],
      [`Porciones:`, recipe.yield || 1],
      [`Rendimiento:`, `${recipe.portionWeight || 100}g`],
      [`Tiempo preparación:`, `${recipe.preparationTime || 30} min`],
      [`Tiempo cocción:`, `${recipe.cookingTime || 60} min`],
    ];

    // Lista en dos columnas alineadas: etiqueta en negrita, valor en normal.
    const labelWidth = 150;
    const left = doc.page.margins.left;
    info.forEach(([label, value]) => {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(String(label), left, y, {
        width: labelWidth,
      });
      doc.font("Helvetica").text(String(value), left + labelWidth, y);
      doc.moveDown(0.3);
    });

    doc.x = left;
    doc.moveDown();
  }

  private generateIngredients(
    doc: any,
    recipe: any,
    template: any,
    styles: any,
    options: GenerateSheetDto,
  ): void {
    doc.fontSize(16).font("Helvetica-Bold");
    doc.text("INGREDIENTES");
    doc.moveDown();

    doc.fontSize(styles.fontSize || 12).font("Helvetica");

    let totalCost = 0;

    recipe.ingredients.forEach((ingredient, index) => {
      // Mismo precio rector que el escandallo de recetas: precio de
      // referencia del artículo corregido por mermas, según unidad usada.
      const cost =
        ingredient.quantity *
        calculateProductCostPerUnit(ingredient.product, ingredient.unit);
      totalCost += cost;

      doc.text(
        `${index + 1}. ${ingredient.product.name} - ${ingredient.quantity} ${ingredient.unit || "g"}`,
        { continued: options.includeCosts },
      );

      if (options.includeCosts) {
        doc.text(` (Costo: €${cost.toFixed(2)})`, { align: "right" });
      }

      doc.moveDown();

      if (options.includeAllergens && ingredient.product.allergens) {
        const allergenIds: number[] = ingredient.product.allergens;
        const allergenNames = allergenIds.map((id) => this.getAllergenName(id));
        if (allergenNames.length > 0) {
          doc.text(`   Alérgenos: ${allergenNames.join(", ")}`);
          this.drawAllergenIcons(doc, allergenIds);
          doc.moveDown();
        }
      }
    });

    if (options.includeCosts) {
      doc.moveDown();
      doc.font("Helvetica-Bold");
      doc.text(`Costo Total Ingredientes: €${totalCost.toFixed(2)}`);
      doc.font("Helvetica");
    }

    doc.moveDown();
  }

  private generatePreparation(
    doc: any,
    recipe: any,
    template: any,
    styles: any,
  ): void {
    doc.fontSize(16).font("Helvetica-Bold");
    doc.text("ELABORACIÓN");
    doc.moveDown();

    doc.fontSize(styles.fontSize || 12).font("Helvetica");

    const steps = this.parsePreparationSteps(recipe.elaboration);
    steps.forEach((step, index) => {
      doc.text(`${index + 1}. ${step.text}`);
      doc.moveDown();
      if (step.time) {
        doc.text(`   Tiempo: ${step.time}`);
        doc.moveDown();
      }
      if (step.temperature) {
        doc.text(`   Temperatura: ${step.temperature}`);
        doc.moveDown();
      }
    });

    doc.moveDown();
  }

  private generateNutrition(
    doc: any,
    recipe: any,
    template: any,
    styles: any,
  ): void {
    doc.fontSize(16).font("Helvetica-Bold");
    doc.text("INFORMACIÓN NUTRICIONAL (Estimada)");
    doc.moveDown();

    doc.fontSize(styles.fontSize || 12).font("Helvetica");

    const nutrition =
      recipe.nutrition || this.calculateEstimatedNutrition(recipe);

    const info = [
      [`Energía:`, `${nutrition.calories || 0} kcal`],
      [`Proteínas:`, `${nutrition.proteins || 0}g`],
      [`Carbohidratos:`, `${nutrition.carbs || 0}g`],
      [`Grasas:`, `${nutrition.fats || 0}g`],
      [`Fibra:`, `${nutrition.fiber || 0}g`],
    ];

    // Mismo formato de lista compacta que Información General
    const labelWidth = 150;
    const left = doc.page.margins.left;
    info.forEach(([label, value]) => {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(String(label), left, y, {
        width: labelWidth,
      });
      doc.font("Helvetica").text(String(value), left + labelWidth, y);
      doc.moveDown(0.3);
    });

    doc.x = left;
    doc.moveDown();
  }

  private generateFooter(
    doc: any,
    template: any,
    styles: any,
    options: GenerateSheetDto,
  ): void {
    doc.fontSize(10).font("Helvetica");

    if (options.branding?.companyName) {
      doc.text(options.branding.companyName, { align: "center" });
    }

    if (options.branding?.address) {
      doc.text(options.branding.address, { align: "center" });
    }

    if (options.branding?.contact) {
      doc.text(options.branding.contact, { align: "center" });
    }

    doc.moveDown();
    doc.text(`Generado: ${new Date().toLocaleDateString("es-ES")}`, {
      align: "center",
    });

    if (options.watermark) {
      doc.fontSize(60).opacity(0.1);
      doc.text(options.watermark, 50, 400, { angle: -45 });
    }
  }

  private async generateMergedPDF(
    recipes: any[],
    template: any,
    options: GenerateBatchDto,
  ): Promise<Buffer> {
    // Simplified implementation - return first sheet only
    for (const recipe of recipes) {
      return await this.generatePDF(recipe, template, options as any);
    }
    return Buffer.from([]);
  }

  // Primer template activo del tenant; si no existe ninguno, crea el
  // estándar con las secciones por defecto para no obligar al frontend
  // a gestionar plantillas antes de poder generar una ficha.
  private async getOrCreateDefaultTemplate(
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const existing = await this.prisma.technicalSheetTemplate.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.technicalSheetTemplate.create({
      data: {
        tenantId,
        name: "Ficha técnica estándar",
        type: "STANDARD",
        layout: this.getDefaultLayout(),
        fields: this.getDefaultFields(),
        styles: this.getDefaultStyles() as any,
        createdBy: userId,
      } as any,
    });
  }

  private getDefaultLayout() {
    return {
      header: { visible: true, order: 1 },
      generalInfo: { visible: true, order: 2 },
      ingredients: { visible: true, order: 3 },
      preparation: { visible: true, order: 4 },
      nutrition: { visible: true, order: 5 },
      footer: { visible: true, order: 6 },
    };
  }

  private getDefaultFields() {
    return [
      { id: "name", name: "Nombre", type: "TEXT", required: true },
      { id: "code", name: "Código", type: "TEXT", required: false },
      { id: "yield", name: "Porciones", type: "TEXT", required: false },
      { id: "ingredients", name: "Ingredientes", type: "LIST", required: true },
      { id: "preparation", name: "Elaboración", type: "LIST", required: true },
    ];
  }

  private getDefaultStyles() {
    return {
      primaryColor: "#1f2937",
      secondaryColor: "#6b7280",
      fontFamily: "Helvetica",
      fontSize: 12,
      headerFontSize: 18,
      lineWidth: 1,
    };
  }

  // Recipe.elaboration es JSON {"steps":[{description,equipment,time,temperature}]}
  // (ElaborationStepEditor). Se tolera texto plano legacy separado por saltos de línea.
  private parsePreparationSteps(
    elaboration: string,
  ): Array<{ text: string; time?: string; temperature?: string }> {
    if (!elaboration) {
      return [{ text: "No hay pasos de elaboración especificados" }];
    }

    try {
      const parsed = JSON.parse(elaboration);
      if (Array.isArray(parsed?.steps)) {
        const steps = parsed.steps
          .filter((s: any) => s?.description)
          .map((s: any) => ({
            text: String(s.description),
            time: s.time ? String(s.time) : undefined,
            temperature: s.temperature ? String(s.temperature) : undefined,
          }));
        if (steps.length > 0) {
          return steps;
        }
        return [{ text: "No hay pasos de elaboración especificados" }];
      }
    } catch {
      // No es JSON: texto plano legacy
    }

    const steps = elaboration.split("\n").filter((step) => step.trim());
    if (steps.length === 0) {
      return [{ text: "No hay pasos de elaboración especificados" }];
    }
    return steps.map((step) => ({ text: step }));
  }

  private calculateEstimatedNutrition(recipe: any): any {
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

  // Pictogramas oficiales UE-1169 en PNG (pdfkit no soporta webp). Las claves
  // son los ids del catálogo BD, igual que en getAllergenName: el orden NO es
  // el canónico UE (10=Sésamo, 11=Sulfitos, 14=Frutos de Cáscara).
  private static readonly ALLERGEN_ICON_FILES: Record<number, string> = {
    1: "gluten-derivados.png",
    2: "crustaceos.png",
    3: "huevos.png",
    4: "pescados.png",
    5: "cacahuetes.png",
    6: "soja.png",
    7: "lacteos.png",
    8: "apio.png",
    9: "mostaza.png",
    10: "granos-sesamo.png",
    11: "dioxido-azufre-sulfitos.png",
    12: "altramuces.png",
    13: "moluscos.png",
    14: "cascaras-frutos-secos.png",
  };

  private getAllergenIconPath(allergenId: number): string | null {
    const file = TechnicalSheetsService.ALLERGEN_ICON_FILES[allergenId];
    if (!file) {
      return null;
    }
    // __dirname funciona en dev (src) y en producción porque nest-cli.json
    // copia assets/ a dist con la misma estructura de módulos.
    const iconPath = path.join(__dirname, "assets", "allergens", file);
    return fs.existsSync(iconPath) ? iconPath : null;
  }

  // Fila de pictogramas bajo la línea de texto de alérgenos. Los nombres en
  // texto se mantienen siempre: UE-1169 exige declaración escrita y el
  // pictograma solo es refuerzo visual.
  private drawAllergenIcons(doc: any, allergenIds: number[]): void {
    // ~8 mm impresos, tamaño habitual de pictograma en cartas de alérgenos
    const size = 22;
    const gap = 6;
    const iconPaths = allergenIds
      .map((id) => this.getAllergenIconPath(id))
      .filter((p): p is string => p !== null);
    if (iconPaths.length === 0) {
      return;
    }

    if (doc.y + size > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    const y = doc.y;
    let x = doc.page.margins.left + 15;
    for (const iconPath of iconPaths) {
      doc.image(iconPath, x, y, { width: size, height: size });
      x += size + gap;
    }
    doc.x = doc.page.margins.left;
    doc.y = y + size + 4;
  }

  private getAllergenName(allergenId: number): string {
    const allergens: Record<number, string> = {
      1: "Gluten",
      2: "Crustáceos",
      3: "Huevos",
      4: "Pescado",
      5: "Cacahuetes",
      6: "Soja",
      7: "Leche",
      8: "Apio",
      9: "Mostaza",
      10: "Sésamo",
      11: "Sulfitos",
      12: "Altramuces",
      13: "Moluscos",
      14: "Frutos de Cáscara",
    };

    return allergens[allergenId] || `Alérgeno ${allergenId}`;
  }

  private generateDocumentId(): string {
    return `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
