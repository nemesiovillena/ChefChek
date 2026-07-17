import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { calculateProductCostPerUnit } from "../../common/utils/product-costing.util";
import { CostingConfigService } from "../costing-config/costing-config.service";
import { CreateRecipeDto } from "./dto/create-recipe.dto";
import { RecipesQueryDto } from "./dto/recipes-query.dto";
import {
  RecipeResponse,
  IngredientResponse,
  SubRecipeResponse,
  RecipeCostBreakdown,
  RecipeCostResponse,
  RecipePricing,
} from "./dto/recipe-response.dto";

// IVA hostelería (ES) fijo al 10%: PVP sin IVA = PVP con IVA / 1.10
const RECIPE_VAT_RATE = 0.1;

function deriveSellingPriceFromVat(
  sellingPriceWithVat: number | null | undefined,
): number | null | undefined {
  if (sellingPriceWithVat === null) {
    return null;
  }
  if (sellingPriceWithVat === undefined) {
    return undefined;
  }
  return Math.round((sellingPriceWithVat / (1 + RECIPE_VAT_RATE)) * 100) / 100;
}

@Injectable()
export class RecipesService {
  constructor(
    private prisma: PrismaService,
    private costingConfigService: CostingConfigService,
  ) {}

  // ─── Detección advisory de duplicados por nombre ────────────────
  // Normaliza acentos (español) para comparar Paella = Paëlla = PAELLA.
  // Advisory-only: NO bloquea create/update/duplicate; solo alimenta el
  // aviso de la UI. Ambos lados se pasan por lower() antes de mapear acentos,
  // por eso solo hace falta el set de acentos en minúscula (16 = 16).
  private static readonly ACCENTS_FROM = "áàäéèëíïóòöúùüñç";
  private static readonly ACCENTS_TO = "aaaeeeiiooouuunc";

  async findNameMatches(
    tenantId: string,
    name: string,
    excludeId?: string,
  ): Promise<{ id: string; name: string; isActive: boolean }[]> {
    const trimmed = (name ?? "").trim();
    if (trimmed.length < 2) {
      return [];
    }

    // Matching "exacto + contiene" (accent-insensitive): avisa no solo si el
    // nombre es idéntico, sino si lo escrito está contenido en uno existente o
    // viceversa. NO detecta typos. Se normaliza una sola vez (CTE + subquery).
    const matches = await this.prisma.$queryRaw<
      { id: string; name: string; isActive: boolean }[]
    >(Prisma.sql`
      WITH norm AS (
        SELECT translate(lower(trim(${trimmed})), ${RecipesService.ACCENTS_FROM}, ${RecipesService.ACCENTS_TO}) AS input
      )
      SELECT q.id, q.name, q."isActive"
      FROM (
        SELECT r.id, r.name, r."isActive",
               translate(lower(trim(r.name)), ${RecipesService.ACCENTS_FROM}, ${RecipesService.ACCENTS_TO}) AS pn
        FROM recipes r
        WHERE r."tenantId" = ${tenantId}
          AND r."deletedAt" IS NULL
          ${excludeId ? Prisma.sql`AND r.id <> ${excludeId}` : Prisma.empty}
      ) q
      CROSS JOIN norm
      WHERE strpos(q.pn, norm.input) > 0
         OR strpos(norm.input, q.pn) > 0
      ORDER BY (q.pn = norm.input) DESC, LENGTH(q.name), q.name
      LIMIT 5
    `);
    return matches;
  }

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
      allergens = [],
      sellingPriceWithVat,
    } = createRecipeDto;
    const sellingPrice = deriveSellingPriceFromVat(sellingPriceWithVat);

    // Validar que elaboration, si viene, sea JSON válido (pasos estructurados)
    let parsedElaboration;
    if (elaboration !== undefined && elaboration !== null) {
      try {
        parsedElaboration = JSON.parse(elaboration);
      } catch (error) {
        throw new BadRequestException("Elaboration must be valid JSON");
      }
    }

    // Calcular costos iniciales
    const costBreakdown = await this.calculateCost(
      tenantId,
      ingredients,
      subRecipes,
      portions,
      portionSize,
    );

    // Crear receta
    const recipe = await this.prisma.recipe.create({
      data: {
        tenantId,
        name,
        description,
        elaboration:
          parsedElaboration !== undefined
            ? JSON.stringify(parsedElaboration)
            : null,
        portions,
        portionSize,
        totalCost: costBreakdown.totalCost,
        totalCostPerUnit: costBreakdown.costPerUnit,
        sellingPriceWithVat,
        sellingPrice,
        version: 1,
        isPublic,
        allergens,
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
      include: this.recipeInclude,
    });

    return this.formatRecipeResponse(recipe);
  }

  async findAll(
    tenantId: string,
    query?: RecipesQueryDto,
  ): Promise<{
    data: RecipeResponse[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      search,
      category,
      sortBy = "name",
      sortOrder = "asc",
      page = 1,
      limit = 20,
    } = query ?? {};

    const where: any = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          {
            description: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }),
    };

    if (category) {
      where.categories = {
        some: {
          categoryId: category,
        },
      };
    }

    const skip = (page - 1) * limit;

    // Nota: "category" (nombre de la primera categoría alfabéticamente) y
    // "costPerUnit" son calculados en cliente/formatRecipeResponse, no
    // columnas — no se ofrecen como sortBy aquí (allowlist = name/createdAt).
    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        include: this.recipeInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.recipe.count({ where }),
    ]);

    const data = await Promise.all(
      recipes.map((recipe) => this.formatRecipeResponse(recipe)),
    );

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Listado ligero (id+nombre) sin paginar, para pickers (combobox de
   * sub-recetas) — separado de findAll() porque ese ahora pagina y un
   * picker necesita poder elegir entre TODAS las recetas activas, no solo
   * la página visible del listado principal.
   */
  async findAllOptions(
    tenantId: string,
  ): Promise<{ id: string; name: string }[]> {
    return this.prisma.recipe.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
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
      include: {
        ingredients: true,
        subRecipes: true,
      },
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
      allergens = recipe.allergens,
      isActive = recipe.isActive,
      sellingPriceWithVat = recipe.sellingPriceWithVat,
    } = updateRecipeDto;
    const sellingPrice = deriveSellingPriceFromVat(sellingPriceWithVat);

    // Validar y parsear elaboration si se actualiza
    if (
      elaboration !== undefined &&
      elaboration !== null &&
      elaboration !== recipe.elaboration
    ) {
      try {
        JSON.parse(elaboration);
      } catch (error) {
        throw new BadRequestException("Elaboration must be valid JSON");
      }
    }

    // Recalcular costos si hay cambios en ingredientes
    let totalCost = recipe.totalCost;

    if (ingredients || subRecipes) {
      const costBreakdown = await this.calculateCost(
        tenantId,
        ingredients || recipe.ingredients,
        subRecipes || recipe.subRecipes,
        portions,
        portionSize,
      );
      totalCost = costBreakdown.totalCost;
    }

    // El costo por unidad de rendimiento depende de porciones y tamaño,
    // así que se recalcula siempre a partir del costo total vigente
    const totalCostPerUnit = this.computeCostPerYieldUnit(
      totalCost,
      portions,
      portionSize,
    );

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
        allergens,
        isActive,
        sellingPriceWithVat,
        sellingPrice,
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
      include: this.recipeInclude,
    });

    return this.formatRecipeResponse(finalRecipe);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    // La existencia se comprueba solo por id+tenant; el ext de soft-delete ya
    // añade deletedAt: null. NO filtrar por isActive: las recetas desactivadas
    // (toggle propio de la UI) también deben poder eliminarse definitivamente.
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, tenantId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    // Soft-delete real (deletedAt) vía la extensión de Prisma: elimina la
    // receta de todos los listados, igual que productos/albaranes/categorías.
    // No basta con isActive:false (es un toggle aparte y no la oculta).
    await this.prisma.recipe.delete({
      where: { id },
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
  ): Promise<RecipeCostResponse> {
    const recipe = await this.findOne(tenantId, id);
    return {
      ...recipe.costBreakdown!,
      ingredients: recipe.ingredients || [],
      subRecipes: recipe.subRecipes || [],
      pricing: recipe.pricing!,
    };
  }

  private async calculateCost(
    tenantId: string,
    ingredients: any[],
    subRecipes: any[],
    portions: number,
    portionSize: number,
  ): Promise<RecipeCostBreakdown> {
    let ingredientsCost = 0;
    let subRecipesCost = 0;

    // SQL crudo a propósito: el middleware global de soft-delete de
    // PrismaService inyecta `deletedAt: null` en todo findMany/findFirst,
    // lo que excluiría a los artículos dados de baja que la receta aún
    // referencia y haría el guardado fallar con "Product not found". Un
    // artículo borrado conserva precio/alérgenos válidos, así que el costeo
    // debe poder usarlos. $queryRaw no pasa por el middleware.
    // Seleccionamos solo los campos que necesita calculateProductCostPerUnit
    // y se mantiene el alcance por tenant: un id inexistente o de otro
    // tenant sigue ausente del mapa y lanza NotFoundException abajo.
    const productIds = ingredients.map((ing) => ing.productId);
    const products = (await this.prisma.$queryRaw`
      SELECT id,
             "purchasePrice"::float8 AS "purchasePrice",
             "unitSize"::float8       AS "unitSize",
             "referenceUnit"
      FROM products
      WHERE id = ANY(${productIds}::text[])
        AND "tenantId" = ${tenantId}
    `) as Array<{
      id: string;
      purchasePrice: number;
      unitSize: number;
      referenceUnit: string;
    }>;
    const productMap = new Map<string, any>(
      products.map((p: any) => [p.id, p]),
    );

    // Calcular costos de ingredientes base
    for (const ingredient of ingredients) {
      const product = productMap.get(ingredient.productId);

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${ingredient.productId} not found`,
        );
      }

      const costPerUnit = calculateProductCostPerUnit(product, ingredient.unit);
      ingredientsCost += ingredient.quantity * costPerUnit;
    }

    // Mismo motivo que el fetch de productos: $queryRaw para saltar el
    // middleware de soft-delete. Una sub-receta dada de baja sigue teniendo
    // totalCost/totalCostPerUnit válidos, así que debe poder costearse.
    // Se mantiene el alcance por tenant; un id inexistente o de otro tenant
    // sigue ausente del mapa y lanza NotFoundException abajo.
    const subRecipeIds = subRecipes.map((sub) => sub.subRecipeId);
    const subRecipeDataList =
      subRecipeIds.length > 0
        ? ((await this.prisma.$queryRaw`
            SELECT id,
                   "totalCost"::float8        AS "totalCost",
                   "totalCostPerUnit"::float8 AS "totalCostPerUnit",
                   "portions"::float8         AS "portions"
            FROM recipes
            WHERE id = ANY(${subRecipeIds}::text[])
              AND "tenantId" = ${tenantId}
          `) as Array<{
            id: string;
            totalCost: number;
            totalCostPerUnit: number;
            portions: number;
          }>)
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

      subRecipesCost += this.calculateSubRecipeCost(
        subRecipe.quantity,
        subRecipe.unit,
        subRecipeData,
      );
    }

    const totalCost = ingredientsCost + subRecipesCost;

    return {
      ingredientsCost,
      subRecipesCost,
      totalCost,
      costPerPortion: portions > 0 ? totalCost / portions : totalCost,
      costPerUnit: this.computeCostPerYieldUnit(
        totalCost,
        portions,
        portionSize,
      ),
    };
  }

  /**
   * Costo de usar una sub-receta según la unidad de la cantidad:
   * - raciones/porciones → cantidad × costo por ración de la sub-receta
   * - kg/L → convertidos a unidad de rendimiento (g/ml) antes de multiplicar
   * - g/ml/ud (u otra unidad) → cantidad × costo por unidad de rendimiento
   */
  private calculateSubRecipeCost(
    quantity: number,
    unit: string,
    subRecipeData: {
      totalCost: number;
      totalCostPerUnit: number;
      portions: number;
    },
  ): number {
    const normalized = (unit || "").trim().toLowerCase();

    if (
      [
        "ración",
        "raciones",
        "racion",
        "porción",
        "porciones",
        "porcion",
      ].includes(normalized)
    ) {
      const costPerPortion =
        subRecipeData.portions > 0
          ? subRecipeData.totalCost / subRecipeData.portions
          : subRecipeData.totalCost;
      return quantity * costPerPortion;
    }

    const toYieldUnitFactor: { [key: string]: number } = {
      kg: 1000,
      l: 1000,
      cl: 10,
    };
    const factor = toYieldUnitFactor[normalized] ?? 1;
    return quantity * factor * subRecipeData.totalCostPerUnit;
  }

  /**
   * Costo por unidad de rendimiento de la receta (€/g, €/ml o €/ud producido).
   * Es el valor que usan las recetas padre para costear esta receta como
   * sub-receta: cantidad usada × costo por unidad de rendimiento.
   */
  private computeCostPerYieldUnit(
    totalCost: number,
    portions: number,
    portionSize: number,
  ): number {
    const totalYield = (portions || 1) * (portionSize || 0);
    if (totalYield > 0) {
      return totalCost / totalYield;
    }
    return portions > 0 ? totalCost / portions : totalCost;
  }

  private async createVersionSnapshot(recipeId: string): Promise<void> {
    // Implementar sistema de versionado completo
    // Esto podría crear una tabla RecipeVersion o similar
    // Por ahora, simplemente marcamos la versión en parentVersion
  }

  /**
   * Include común de lectura: ingredientes+producto, sub-recetas con SUS propios
   * ingredientes+producto, y categorías. Necesario para que formatRecipeResponse
   * pueda derivar los alérgenos tanto de ingredientes como de sub-recetas; sin el
   * nivel nested de subRecipe.ingredients, el listado pierde los alérgenos de
   * sub-recetas (ej. Spaghetti → Salsa Boloñesa).
   */
  private get recipeInclude() {
    return {
      ingredients: { include: { product: true } },
      subRecipes: {
        include: {
          subRecipe: {
            include: { ingredients: { include: { product: true } } },
          },
        },
      },
      categories: { include: { category: true } },
    };
  }

  private async formatRecipeResponse(recipe: any): Promise<RecipeResponse> {
    const ingredients: IngredientResponse[] =
      recipe.ingredients?.map((ing: any) => {
        const product = ing.product;
        const yieldFactor =
          product?.yieldFactor && product.yieldFactor > 0
            ? product.yieldFactor
            : 1;
        const unitSize = product?.unitSize > 0 ? product.unitSize : 1;
        const referencePurchasePrice = product
          ? product.purchasePrice / unitSize
          : 0;
        const yieldPercentage = yieldFactor * 100;

        return {
          id: ing.id,
          productId: ing.productId,
          productName: product?.name,
          quantity: ing.quantity,
          unit: ing.unit,
          cost: product
            ? ing.quantity * calculateProductCostPerUnit(product, ing.unit)
            : 0,
          grossWeight: ing.quantity,
          netWeight: ing.quantity * yieldFactor,
          yieldPercentage,
          wastePercentage: 100 - yieldPercentage,
          referencePurchasePrice,
          realPrice: referencePurchasePrice / yieldFactor,
          referenceUnit: product?.referenceUnit || "kg",
        };
      }) || [];

    const subRecipes: SubRecipeResponse[] =
      recipe.subRecipes?.map((sub: any) => ({
        id: sub.id,
        subRecipeId: sub.subRecipeId,
        subRecipeName: sub.subRecipe.name,
        quantity: sub.quantity,
        unit: sub.unit,
        totalCost: sub.subRecipe.totalCost,
        costPerUnit: sub.subRecipe.totalCostPerUnit,
        cost: this.calculateSubRecipeCost(
          sub.quantity,
          sub.unit,
          sub.subRecipe,
        ),
      })) || [];

    const categories =
      recipe.categories?.map((cat: any) => ({
        id: cat.id,
        categoryId: cat.categoryId,
        categoryName: cat.category.name,
        categorySlug: cat.category.slug,
      })) || [];

    // Desglose calculado en vivo desde precios de artículos actuales,
    // sin depender del totalCost persistido (puede estar desactualizado)
    const ingredientsCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
    const subRecipesCost = subRecipes.reduce((sum, sub) => sum + sub.cost, 0);
    const totalCost = ingredientsCost + subRecipesCost;

    const costBreakdown: RecipeCostBreakdown = {
      ingredientsCost,
      subRecipesCost,
      totalCost,
      costPerPortion:
        recipe.portions > 0 ? totalCost / recipe.portions : totalCost,
      costPerUnit: this.computeCostPerYieldUnit(
        totalCost,
        recipe.portions,
        recipe.portionSize,
      ),
    };

    // Alérgenos = seleccionados manualmente + unión derivada de ingredientes/sub-recetas.
    // Nunca se ocultan los derivados de ingredientes: solo se pueden añadir extra (ej. contaminación cruzada).
    const allergens = new Set<number>(recipe.allergens || []);
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

    const pricing = await this.buildPricing(
      recipe,
      costBreakdown.costPerPortion,
    );

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      elaboration: recipe.elaboration,
      portions: recipe.portions,
      portionSize: recipe.portionSize,
      totalCost: costBreakdown.totalCost,
      totalCostPerUnit: costBreakdown.costPerUnit,
      sellingPriceWithVat: recipe.sellingPriceWithVat ?? null,
      sellingPrice: recipe.sellingPrice ?? null,
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
      pricing,
      allergens: Array.from(allergens),
    };
  }

  /**
   * Pricing derivado del escandallo: coste objetivo (global de Configuración,
   * informativo), margen bruto a partir del PVP sin IVA (derivado del PVP con
   * IVA a 1,10), y PVP teórico (coste × multiplicador global de Configuración).
   */
  private async buildPricing(
    recipe: any,
    costPerPortion: number,
  ): Promise<RecipePricing> {
    const config = await this.costingConfigService.getConfig(recipe.tenantId);
    const targetCostPercentage = config.targetCostPercentage;
    const theoreticalPriceMultiplier = config.theoreticalPriceMultiplier;

    const sellingPriceWithVat: number | null =
      recipe.sellingPriceWithVat ?? null;
    const sellingPrice: number | null = recipe.sellingPrice ?? null;
    const hasSellingPrice = sellingPrice !== null && sellingPrice > 0;

    return {
      targetCostPercentage,
      targetGrossMarginPercentage: 100 - targetCostPercentage,
      theoreticalPriceMultiplier,
      theoreticalSellingPrice: costPerPortion * theoreticalPriceMultiplier,
      sellingPriceWithVat,
      sellingPrice,
      grossMargin: hasSellingPrice ? sellingPrice! - costPerPortion : null,
      grossMarginPercentage: hasSellingPrice
        ? ((sellingPrice! - costPerPortion) / sellingPrice!) * 100
        : null,
      costPercentage: hasSellingPrice
        ? (costPerPortion / sellingPrice!) * 100
        : null,
    };
  }
}
