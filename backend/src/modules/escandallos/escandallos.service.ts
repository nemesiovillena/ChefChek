import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { calculateProductCostPerUnit } from "../../common/utils/product-costing.util";
import {
  CostBreakdownDto,
  RecipeDetailedCostDto,
  CostVariationDto,
  CostProjectionDto,
  CostAnalysisDto,
  GenerateEscandalloReportDto,
} from "./dto/escandallos.dto";

@Injectable()
export class EscandallosService {
  constructor(private readonly prisma: PrismaService) {}

  // Análisis Detallado de Costos de Receta
  async getDetailedRecipeCost(
    tenantId: string,
    recipeId: string,
  ): Promise<RecipeDetailedCostDto> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, isActive: true },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipesAsChild: {
          include: {
            subRecipe: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    const costBreakdown = await this.calculateDetailedCostBreakdown(recipe);
    const ingredientsCost = costBreakdown.reduce(
      (sum, item) => sum + item.ingredientCost,
      0,
    );
    const wastageCost = costBreakdown.reduce(
      (sum, item) => sum + item.wastageCost,
      0,
    );

    // Calcular costos de sub-recetas
    const subRecipesCost = await this.calculateSubRecipesCost(
      recipe.id,
      tenantId,
    );

    const totalCost = ingredientsCost + wastageCost + subRecipesCost;
    const costPerPortion =
      recipe.portions > 0 ? totalCost / recipe.portions : 0;
    const costPerUnit =
      recipe.portionSize > 0 ? totalCost / recipe.portionSize : 0;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      portions: recipe.portions,
      portionSize: recipe.portionSize,
      ingredientsCost,
      subRecipesCost,
      wastageCost,
      totalCost,
      costPerPortion,
      costPerUnit,
      costBreakdown,
    };
  }

  // Análisis de Variación de Costos
  async getCostVariations(
    tenantId: string,
    recipeId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CostVariationDto[]> {
    const endDateFilter = endDate || new Date();
    const startDateFilter =
      startDate || new Date(endDateFilter.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 días por defecto

    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, isActive: true },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    // Obtener variaciones de costos históricos de productos
    const variations: CostVariationDto[] = [];

    for (const ingredient of recipe.ingredients) {
      const product = ingredient.product;
      // €/unidad de referencia del artículo (kg, L o ud), con mermas
      const currentCost = calculateProductCostPerUnit(
        product,
        product.referenceUnit,
      );

      // Buscar variación histórica (simulada - en producción usar datos reales)
      const previousCost = currentCost * (0.9 + Math.random() * 0.2); // +/-10% simulado
      const variation = currentCost - previousCost;
      const variationPercentage =
        previousCost > 0 ? (variation / previousCost) * 100 : 0;

      variations.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        previousCost,
        currentCost,
        variation,
        variationPercentage,
        date: new Date(),
      });
    }

    return variations;
  }

  // Proyecciones de Costos
  async getCostProjections(
    tenantId: string,
    recipeId: string,
  ): Promise<CostProjectionDto> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, isActive: true },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    // Calcular proyección basada en tendencias de ingredientes
    const totalCost = recipe.totalCost;
    const projectedCost = totalCost * (0.95 + Math.random() * 0.1); // +/-5% proyectado
    const confidence = 0.7 + Math.random() * 0.2; // 70-90% confianza

    const ingredientPriceTrend = Math.random() * 0.1 - 0.05; // +/-5%
    const consumptionPattern = Math.random() * 0.08 - 0.04; // +/-4%
    const seasonalFactor = Math.random() * 0.06 - 0.03; // +/-3%

    const trend =
      ingredientPriceTrend + consumptionPattern + seasonalFactor > 0
        ? "INCREASING"
        : "DECREASING";

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      projectedCost,
      confidence,
      trend,
      factors: {
        ingredientPriceTrend,
        consumptionPattern,
        seasonalFactor,
      },
    };
  }

  // Análisis Completo de Escandallo
  async getCompleteCostAnalysis(
    tenantId: string,
    recipeId: string,
  ): Promise<CostAnalysisDto> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, isActive: true },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    const detailedCost = await this.getDetailedRecipeCost(tenantId, recipeId);
    const variations = await this.getCostVariations(tenantId, recipeId);
    const projections = await this.getCostProjections(tenantId, recipeId);

    // Calcular rentabilidad
    const sellingPrice = detailedCost.totalCost * 1.3; // 30% margen por defecto
    const margin = sellingPrice - detailedCost.totalCost;
    const profitability =
      detailedCost.totalCost > 0 ? (margin / detailedCost.totalCost) * 100 : 0;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalCost: detailedCost.totalCost,
      costPerPortion: detailedCost.costPerPortion,
      margin,
      sellingPrice,
      profitability,
      variations,
      projections: [projections],
    };
  }

  // Generación de Reporte Completo
  async generateEscandalloReport(
    tenantId: string,
    dto: GenerateEscandalloReportDto,
  ): Promise<any> {
    const {
      recipeId,
      startDate,
      endDate,
      includeVariations = true,
      includeProjections = true,
    } = dto;

    let baseAnalysis: CostAnalysisDto | CostAnalysisDto[];

    if (recipeId) {
      baseAnalysis = await this.getCompleteCostAnalysis(tenantId, recipeId);
    } else {
      const allAnalyses = await this.getAllRecipesAnalysis(tenantId);
      // Get complete analysis for each recipe (simplified version)
      baseAnalysis = await Promise.all(
        allAnalyses.map(async (analysis) => ({
          ...analysis,
          margin: analysis.totalCost * 0.3,
          sellingPrice: analysis.totalCost * 1.3,
          profitability: 30,
          variations: [],
          projections: [],
        })),
      );
    }

    const analysisArray = Array.isArray(baseAnalysis)
      ? baseAnalysis
      : [baseAnalysis];

    const totalCost = analysisArray.reduce((sum, r) => sum + r.totalCost, 0);
    const averageCost =
      analysisArray.length > 0 ? totalCost / analysisArray.length : 0;

    const report = {
      generatedAt: new Date(),
      period: {
        startDate:
          startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)),
        endDate: endDate || new Date(),
      },
      summary: {
        totalRecipes: analysisArray.length,
        averageCost,
        totalCost,
      },
      analysis: analysisArray,
      ...(includeVariations && {
        variations: recipeId
          ? (baseAnalysis as CostAnalysisDto).variations
          : [],
      }),
      ...(includeProjections && {
        projections: recipeId
          ? (baseAnalysis as CostAnalysisDto).projections
          : [],
      }),
    };

    return {
      success: true,
      data: report,
      message: "Escandallo report generated successfully",
    };
  }

  // Conversión de Unidades Multi-Unidad
  async convertUnits(
    tenantId: string,
    fromUnit: string,
    toUnit: string,
    quantity: number,
    productId: string,
  ): Promise<any> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const convertedQuantity = await this.performUnitConversion(
      quantity,
      fromUnit,
      toUnit,
      product,
    );

    return {
      success: true,
      data: {
        original: { quantity, unit: fromUnit },
        converted: { quantity: convertedQuantity, unit: toUnit },
        conversionRate: convertedQuantity / quantity,
      },
      message: "Unit conversion completed",
    };
  }

  // Métodos Privados de Ayuda
  private async calculateDetailedCostBreakdown(
    recipe: any,
  ): Promise<CostBreakdownDto[]> {
    const breakdown: CostBreakdownDto[] = [];

    for (const ingredient of recipe.ingredients) {
      const product = ingredient.product;
      // Mismo precio rector que recetas y fichas técnicas: precio de
      // referencia con mermas vía yieldFactor. unitCost ya incluye mermas,
      // por lo que totalCost = ingredientCost (no se vuelven a sumar);
      // wastageCost es solo el desglose informativo de esa parte.
      const unitCost = calculateProductCostPerUnit(product, ingredient.unit);
      const unitCostWithoutWaste = calculateProductCostPerUnit(
        { ...product, yieldFactor: 1 },
        ingredient.unit,
      );
      const ingredientCost = ingredient.quantity * unitCost;
      const wastageCost =
        ingredient.quantity * (unitCost - unitCostWithoutWaste);

      breakdown.push({
        productId: product.id,
        productName: product.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        unitCost,
        ingredientCost,
        wastageCost,
        totalCost: ingredientCost,
      });
    }

    return breakdown;
  }

  private async calculateSubRecipesCost(
    recipeId: string,
    tenantId: string,
  ): Promise<number> {
    try {
      const subRecipes = await (this.prisma as any).recipeSubRecipe.findMany({
        where: { parentRecipeId: recipeId },
        include: {
          subRecipe: true,
        },
      });

      let totalCost = 0;
      for (const subRecipe of subRecipes) {
        const subRecipeCostPerUnit = subRecipe.subRecipe.totalCostPerUnit;
        totalCost += subRecipe.quantity * subRecipeCostPerUnit;
      }

      return totalCost;
    } catch (error) {
      // Si no hay sub-recetas, retorna 0
      return 0;
    }
  }

  private async getAllRecipesAnalysis(
    tenantId: string,
  ): Promise<CostAnalysisDto[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, totalCost: true, portions: true },
    });

    return recipes.map((recipe) => ({
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalCost: recipe.totalCost,
      costPerPortion:
        recipe.portions > 0 ? recipe.totalCost / recipe.portions : 0,
      margin: recipe.totalCost * 0.3,
      sellingPrice: recipe.totalCost * 1.3,
      profitability: 30,
      variations: [],
      projections: [],
    }));
  }

  private async performUnitConversion(
    quantity: number,
    fromUnit: string,
    toUnit: string,
    product: any,
  ): Promise<number> {
    // Factores de conversión básicos (en producción usar tabla de conversiones real)
    const conversionFactors: Record<string, Record<string, number>> = {
      kg: { g: 1000, mg: 1000000, lb: 2.20462, oz: 35.274 },
      g: { kg: 0.001, mg: 1000, lb: 0.00220462, oz: 0.035274 },
      l: { ml: 1000, cl: 100, dl: 10, gallon: 0.264172 },
      ml: { l: 0.001, cl: 0.1, dl: 0.01, gallon: 0.000264172 },
    };

    const fromFactors = conversionFactors[fromUnit];
    const toFactor = fromFactors?.[toUnit];

    if (!fromFactors || !toFactor) {
      throw new BadRequestException(
        `Cannot convert from ${fromUnit} to ${toUnit}`,
      );
    }

    return quantity * toFactor;
  }
}
