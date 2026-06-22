import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
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

    const template = await this.prisma.technicalSheetTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
    });

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

    info.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, { continued: true });
      doc.moveDown();
    });

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
      const cost = (ingredient.quantity * ingredient.product.cost) / 1000;
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
        const allergenNames = ingredient.product.allergens.map((id) =>
          this.getAllergenName(id),
        );
        if (allergenNames.length > 0) {
          doc.text(`   Alérgenos: ${allergenNames.join(", ")}`);
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

    info.forEach(([label, value]) => {
      doc.text(`${label} ${value}`);
      doc.moveDown();
    });

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

  private parsePreparationSteps(
    elaboration: string,
  ): Array<{ text: string; time?: string; temperature?: string }> {
    if (!elaboration) {
      return [{ text: "No hay pasos de elaboración especificados" }];
    }

    const steps = elaboration.split("\n").filter((step) => step.trim());
    return steps.map((step) => {
      return {
        text: step,
      };
    });
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

  private getAllergenName(allergenId: number): string {
    const allergens: Record<number, string> = {
      1: "Cereales con Gluten",
      2: "Crustáceos",
      3: "Huevos",
      4: "Pescado",
      5: "Cacahuetes",
      6: "Soya",
      7: "Leche",
      8: "Apio",
      9: "Mostaza",
      10: "Semillas de Sésamo",
      11: "Sulfitos",
      12: "Altramuces",
      13: "Moluscos",
      14: "Mostaza en Polvo",
    };

    return allergens[allergenId] || `Alérgeno ${allergenId}`;
  }

  private generateDocumentId(): string {
    return `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
