import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import {
  RecipeResponse,
  IngredientResponse,
  SubRecipeResponse,
  RecipeCostBreakdown,
} from "./dto/recipe-response.dto";

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    createRecipeDto: CreateRecipeDto,
  ): Promise<RecipeResponse> {
    const {
      name,
      description,
      elaboration,
      portions = 1,
      portionSize = 1,
      ingredients = [],
      subRecipes = [],
      isPublic = false,
      categoryIds = [],
    } = createRecipeDto;

    // Validar que elaboration sea JSON válido (TipTap)
    let parsedElaboration;
    try {
      parsedElaboration = JSON.parse(elaboration);
    } catch (error) {
      throw new BadRequestException("Elaboration must be valid TipTap JSON");
    }

    // Calcular costos iniciales
    const costBreakdown = await this.calculateCost(
      tenantId,
      ingredients,
      subRecipes,
    );

    // Crear receta
    const recipe = await this.prisma.recipe.create({
      data: {
        tenantId,
        name,
        description,
        elaboration: JSON.stringify(parsedElaboration),
        portions,
        portionSize,
        totalCost: costBreakdown.totalCost,
        totalCostPerUnit: costBreakdown.costPerUnit,
        version: 1,
        isPublic,
        ingredients: {
          create: ingredients.map((ing) => ({
            productId: ing.productId,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        },
        subRecipes:
          subRecipes.length > 0
            ? {
                create: subRecipes.map((sub) => ({
                  subRecipeId: sub.subRecipeId,
                  quantity: sub.quantity,
                  unit: sub.unit,
                })),
              }
            : undefined,
        categories:
          categoryIds.length > 0
            ? {
                create: categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              }
            : undefined,
      },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipes: {
          include: {
            subRecipe: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return this.formatRecipeResponse(recipe);
  }

  async findAll(
    tenantId: string,
    query?: { search?: string; category?: string },
  ): Promise<RecipeResponse[]> {
    const where: any = {
      tenantId,
      ...(query?.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          {
            description: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    if (query?.category) {
      where.categories = {
        some: {
          categoryId: query.category,
        },
      };
    }

    const recipes = await this.prisma.recipe.findMany({
      where,
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipes: {
          include: {
            subRecipe: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return recipes.map((recipe) => this.formatRecipeResponse(recipe));
  }

  async findOne(tenantId: string, id: string): Promise<RecipeResponse> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, tenantId },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipes: {
          include: {
            subRecipe: {
              include: {
                ingredients: {
                  include: {
                    product: true,
                  },
                },
                subRecipes: {
                  include: {
                    subRecipe: true,
                  },
                },
                categories: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    return this.formatRecipeResponse(recipe);
  }

  async update(
    tenantId: string,
    id: string,
    updateRecipeDto: Partial<CreateRecipeDto>,
  ): Promise<RecipeResponse> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, tenantId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    // Crear nueva versión si hay cambios significativos
    let version = recipe.version;
    let parentVersion = recipe.parentVersion;

    if (
      updateRecipeDto.name ||
      updateRecipeDto.ingredients ||
      updateRecipeDto.subRecipes
    ) {
      version += 1;
      parentVersion = recipe.id;

      // Crear versión anterior como snapshot
      await this.createVersionSnapshot(recipe.id);
    }

    const {
      name = recipe.name,
      description = recipe.description,
      elaboration = recipe.elaboration,
      portions = recipe.portions,
      portionSize = recipe.portionSize,
      ingredients,
      subRecipes,
      isPublic = recipe.isPublic,
      categoryIds,
      isActive = recipe.isActive,
    } = updateRecipeDto;

    // Validar y parsear elaboration si se actualiza
    if (elaboration !== recipe.elaboration) {
      try {
        JSON.parse(elaboration);
      } catch (error) {
        throw new BadRequestException("Elaboration must be valid TipTap JSON");
      }
    }

    // Recalcular costos si hay cambios en ingredientes
    let totalCost = recipe.totalCost;
    let totalCostPerUnit = recipe.totalCostPerUnit;

    if (ingredients || subRecipes) {
      const costBreakdown = await this.calculateCost(
        tenantId,
        ingredients || (recipe as any).ingredients,
        subRecipes || (recipe as any).subRecipes,
      );
      totalCost = costBreakdown.totalCost;
      totalCostPerUnit = costBreakdown.costPerUnit;
    }

    const updatedRecipe = await this.prisma.recipe.update({
      where: { id },
      data: {
        name,
        description,
        elaboration,
        portions,
        portionSize,
        totalCost,
        totalCostPerUnit,
        version,
        parentVersion,
        isPublic,
        isActive,
      },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipes: {
          include: {
            subRecipe: true,
          },
        },
      },
    });

    // Actualizar ingredientes y sub-recetas si se proporcionan
    if (ingredients) {
      await this.prisma.recipeIngredient.deleteMany({
        where: { recipeId: id },
      });
      await this.prisma.recipeIngredient.createMany({
        data: ingredients.map((ing) => ({
          recipeId: id,
          productId: ing.productId,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
      });
    }

    if (subRecipes) {
      await this.prisma.recipeSubRecipe.deleteMany({
        where: { parentRecipeId: id },
      });
      await this.prisma.recipeSubRecipe.createMany({
        data: subRecipes.map((sub) => ({
          parentRecipeId: id,
          subRecipeId: sub.subRecipeId,
          quantity: sub.quantity,
          unit: sub.unit,
        })),
      });
    }

    if (categoryIds) {
      await this.prisma.recipeCategory.deleteMany({
        where: { recipeId: id },
      });
      if (categoryIds.length > 0) {
        await this.prisma.recipeCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            recipeId: id,
            categoryId,
          })),
        });
      }
    }

    // Recargar con relaciones actualizadas
    const finalRecipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
        subRecipes: {
          include: {
            subRecipe: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return this.formatRecipeResponse(finalRecipe);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, tenantId, isActive: true },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    await this.prisma.recipe.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async duplicate(
    tenantId: string,
    id: string,
    newName?: string,
  ): Promise<RecipeResponse> {
    const originalRecipe = await this.findOne(tenantId, id);

    const duplicatedRecipe = await this.create(tenantId, {
      name: newName || `${originalRecipe.name} (Copia)`,
      description: originalRecipe.description,
      elaboration: originalRecipe.elaboration,
      portions: originalRecipe.portions,
      portionSize: originalRecipe.portionSize,
      ingredients: originalRecipe.ingredients?.map((ing) => ({
        productId: ing.productId,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      subRecipes: originalRecipe.subRecipes?.map((sub) => ({
        subRecipeId: sub.subRecipeId,
        quantity: sub.quantity,
        unit: sub.unit,
      })),
      categoryIds: originalRecipe.categories?.map((cat) => cat.categoryId),
      isPublic: false,
    });

    return duplicatedRecipe;
  }

  async calculateRecipeCost(
    tenantId: string,
    id: string,
  ): Promise<RecipeCostBreakdown> {
    const recipe = await this.findOne(tenantId, id);
    return recipe.costBreakdown!;
  }

  private async calculateCost(
    tenantId: string,
    ingredients: any[],
    subRecipes: any[],
  ): Promise<RecipeCostBreakdown> {
    let ingredientsCost = 0;
    let subRecipesCost = 0;

    // OPTIMIZED: Fetch all products in a single query
    const productIds = ingredients.map((ing) => ing.productId);
    const products = await (this.prisma as any).product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
    });
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Calcular costos de ingredientes base
    for (const ingredient of ingredients) {
      const product = productMap.get(ingredient.productId);

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${ingredient.productId} not found`,
        );
      }

      // Calcular costo: cantidad × costo/UR
      const costPerUnit = await this.calculateProductCostPerUnit(product);
      const ingredientCost = ingredient.quantity * costPerUnit;
      ingredientsCost += ingredientCost;
    }

    // OPTIMIZED: Fetch all sub-recipes in a single query
    const subRecipeIds = subRecipes.map((sub) => sub.subRecipeId);
    const subRecipeDataList =
      subRecipeIds.length > 0
        ? await this.prisma.recipe.findMany({
            where: { id: { in: subRecipeIds }, tenantId, isActive: true },
          })
        : [];
    const subRecipeMap = new Map(subRecipeDataList.map((r: any) => [r.id, r]));

    // Calcular costos de sub-recetas (recursivo)
    for (const subRecipe of subRecipes) {
      const subRecipeData = subRecipeMap.get(subRecipe.subRecipeId);

      if (!subRecipeData) {
        throw new NotFoundException(
          `Sub-recipe with ID ${subRecipe.subRecipeId} not found`,
        );
      }

      // Calcular costo proporcional de sub-receta
      const subRecipeCostPerUnit = subRecipeData.totalCostPerUnit;
      const subRecipeCost = subRecipe.quantity * subRecipeCostPerUnit;
      subRecipesCost += subRecipeCost;
    }

    const totalCost = ingredientsCost + subRecipesCost;
    const costPerPortion = totalCost / 1; // Ajustar según portions
    const costPerUnit = totalCost / 100; // Porcentaje base

    return {
      ingredientsCost,
      subRecipesCost,
      totalCost,
      costPerPortion,
      costPerUnit,
    };
  }

  private async calculateProductCostPerUnit(product: any): Promise<number> {
    // Calcular costo por UR usando el sistema multi-unidad
    // costPerUR = purchasePrice ÷ (factor UC→UA × factor UA→UR)

    const purchasePrice = product.purchasePrice;
    const netPrice = product.netPrice;
    const wastePercentage = product.wastePercentage;

    // Usar precio neto ajustado por mermas
    const effectivePrice = netPrice;

    // Factores de conversión (deberían venir del producto o configuración)
    const ucToUaFactor = this.getUcToUaFactor(
      product.purchaseUnit,
      product.storageUnit,
    );
    const uaToUrFactor = this.getUaToUrFactor(
      product.storageUnit,
      product.recipeUnit,
    );

    // Costo por UR
    return effectivePrice / (ucToUaFactor * uaToUrFactor);
  }

  private getUcToUaFactor(purchaseUnit: string, storageUnit: string): number {
    const conversionMap: { [key: string]: { [key: string]: number } } = {
      "Caja 10kg": { Kilogramos: 10, Gramos: 10000 },
      "Bote 300uds": { Unidades: 300 },
      "Saco 25kg": { Kilogramos: 25, Gramos: 25000 },
      Litro: { Litros: 1, Mililitros: 1000 },
      Kilogramo: { Kilogramos: 1, Gramos: 1000 },
    };

    return conversionMap[purchaseUnit]?.[storageUnit] || 1;
  }

  private getUaToUrFactor(storageUnit: string, recipeUnit: string): number {
    const conversionMap: { [key: string]: { [key: string]: number } } = {
      Kilogramos: { Gramos: 1000 },
      Litros: { Mililitros: 1000 },
      Unidades: { Unidades: 1 },
    };

    return conversionMap[storageUnit]?.[recipeUnit] || 1;
  }

  private async createVersionSnapshot(recipeId: string): Promise<void> {
    // Implementar sistema de versionado completo
    // Esto podría crear una tabla RecipeVersion o similar
    // Por ahora, simplemente marcamos la versión en parentVersion
  }

  private formatRecipeResponse(recipe: any): RecipeResponse {
    const ingredients: IngredientResponse[] =
      recipe.ingredients?.map((ing: any) => ({
        id: ing.id,
        productId: ing.productId,
        productName: ing.product.name,
        quantity: ing.quantity,
        unit: ing.unit,
        cost: ing.quantity * this.estimateIngredientCost(ing),
      })) || [];

    const subRecipes: SubRecipeResponse[] =
      recipe.subRecipes?.map((sub: any) => ({
        id: sub.id,
        subRecipeId: sub.subRecipeId,
        subRecipeName: sub.subRecipe.name,
        quantity: sub.quantity,
        unit: sub.unit,
        totalCost: sub.subRecipe.totalCost,
        costPerUnit: sub.subRecipe.totalCostPerUnit,
      })) || [];

    const categories =
      recipe.categories?.map((cat: any) => ({
        id: cat.id,
        categoryId: cat.categoryId,
        categoryName: cat.category.name,
        categorySlug: cat.category.slug,
      })) || [];

    const costBreakdown: RecipeCostBreakdown = {
      ingredientsCost: ingredients.reduce((sum, ing) => sum + ing.cost, 0),
      subRecipesCost: subRecipes.reduce(
        (sum, sub) => sum + sub.quantity * sub.costPerUnit,
        0,
      ),
      totalCost: recipe.totalCost,
      costPerPortion: recipe.totalCost / recipe.portions,
      costPerUnit: recipe.totalCostPerUnit,
    };

    // Calcular alérgenos (unión de ingredientes + sub-recetas)
    const allergens = new Set<number>();
    ingredients.forEach((ing) => {
      const product = recipe.ingredients.find(
        (i: any) => i.id === ing.id,
      )?.product;
      if (product?.allergens) {
        product.allergens.forEach((a: number) => allergens.add(a));
      }
    });
    subRecipes.forEach((sub) => {
      const subRecipeData = recipe.subRecipes.find(
        (s: any) => s.id === sub.id,
      )?.subRecipe;
      if (subRecipeData?.ingredients) {
        subRecipeData.ingredients.forEach((ing: any) => {
          if (ing.product?.allergens) {
            ing.product.allergens.forEach((a: number) => allergens.add(a));
          }
        });
      }
    });

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      elaboration: recipe.elaboration,
      portions: recipe.portions,
      portionSize: recipe.portionSize,
      totalCost: recipe.totalCost,
      totalCostPerUnit: recipe.totalCostPerUnit,
      version: recipe.version,
      parentVersion: recipe.parentVersion,
      isActive: recipe.isActive,
      isPublic: recipe.isPublic,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredients,
      subRecipes,
      categories,
      costBreakdown,
      allergens: Array.from(allergens),
    };
  }

  private estimateIngredientCost(ingredient: any): number {
    // Estimación simplificada - en producción usar cálculo exacto
    return 0.0025; // Costo promedio por UR
  }
}
