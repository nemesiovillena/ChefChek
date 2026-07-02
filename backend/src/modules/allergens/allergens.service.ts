import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  UpdateProductAllergensDto,
  AllergenConflictDto,
  AllergenComplianceReportDto,
  CreateAllergenDto,
  UpdateAllergenDto,
} from "./dto/allergens.dto";
import { ALLERGENS_INFO } from "./dto/allergens.dto";

@Injectable()
export class AllergensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista el catálogo global de alérgenos. Si se pasa tenantId, añade
   * `productsCount`: nº de productos del tenant cuyo Int[] contiene el id.
   */
  async findAll(tenantId?: string): Promise<any[]> {
    const allergens = await this.prisma.allergen.findMany({
      orderBy: { id: "asc" },
    });

    if (!tenantId) {
      return allergens;
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: { allergens: true },
    });
    const countById = new Map<number, number>();
    for (const p of products) {
      for (const id of p.allergens) {
        countById.set(id, (countById.get(id) ?? 0) + 1);
      }
    }

    return allergens.map((a) => ({
      ...a,
      productsCount: countById.get(a.id) ?? 0,
    }));
  }

  /**
   * Crea un alérgeno. El id se auto-asigna como max(id)+1 (>=15) para no
   * colisionar con los códigos UE oficiales (1-14) ya sembrados.
   */
  async create(data: CreateAllergenDto): Promise<any> {
    const maxRow = await this.prisma.allergen.aggregate({
      _max: { id: true },
    });
    const nextId = (maxRow._max.id ?? 0) + 1;

    return this.prisma.allergen.create({
      data: {
        id: nextId,
        name: data.name,
        nameEu1169: data.nameEu1169,
        description: data.description,
        icon: data.icon,
        color: data.color,
        severity: data.severity,
        isActive: true,
      },
    });
  }

  /** Actualiza un alérgeno del catálogo por id. */
  async update(id: number, data: UpdateAllergenDto): Promise<any> {
    const existing = await this.prisma.allergen.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Allergen not found");
    }

    return this.prisma.allergen.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameEu1169 !== undefined && {
          nameEu1169: data.nameEu1169,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async updateProductAllergens(
    tenantId: string,
    productId: string,
    dto: UpdateProductAllergensDto,
  ): Promise<any> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        allergens: dto.allergens,
      },
    });

    return {
      success: true,
      data: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        allergens: updatedProduct.allergens,
      },
    };
  }

  async calculateRecipeAllergens(
    tenantId: string,
    recipeId: string,
  ): Promise<number[]> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId },
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

    if (!recipe) {
      throw new NotFoundException("Recipe not found");
    }

    const directAllergens = new Set<number>();
    const cascadeAllergens = new Set<number>();

    recipe.ingredients.forEach((ingredient) => {
      if (ingredient.product.allergens) {
        ingredient.product.allergens.forEach((allergenId) => {
          directAllergens.add(allergenId);
        });
      }
    });

    for (const subRecipeRel of recipe.subRecipes) {
      const subRecipeAllergens = await this.calculateRecipeAllergens(
        tenantId,
        subRecipeRel.subRecipeId,
      );
      subRecipeAllergens.forEach((allergenId) => {
        cascadeAllergens.add(allergenId);
      });
    }

    const allAllergens = [...directAllergens, ...cascadeAllergens];
    const uniqueAllergens = [...new Set(allAllergens)];

    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: {
        allergens: uniqueAllergens,
      },
    });

    return uniqueAllergens;
  }

  async calculateMenuAllergens(
    tenantId: string,
    menuId: string,
  ): Promise<number[]> {
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

    if (!menu) {
      throw new NotFoundException("Menu not found");
    }

    const menuAllergens = new Set<number>();

    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe) {
          if (!item.recipe.allergens) {
            await this.calculateRecipeAllergens(tenantId, item.recipe.id);
            const updatedRecipe = await this.prisma.recipe.findUnique({
              where: { id: item.recipe.id },
            });
            updatedRecipe.allergens.forEach((allergenId) => {
              menuAllergens.add(allergenId);
            });
          } else {
            item.recipe.allergens.forEach((allergenId) => {
              menuAllergens.add(allergenId);
            });
          }
        }
      }
    }

    const uniqueAllergens = [...menuAllergens];

    await this.prisma.menu.update({
      where: { id: menuId },
      data: {
        allergens: uniqueAllergens,
      },
    });

    return uniqueAllergens;
  }

  async detectAllergenConflicts(
    tenantId: string,
    menuId: string,
    filteredAllergens: number[],
  ): Promise<AllergenConflictDto[]> {
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
                    subRecipes: {
                      include: {
                        subRecipe: true,
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
      throw new NotFoundException("Menu not found");
    }

    const conflicts: AllergenConflictDto[] = [];

    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe) {
          const recipeAllergens = await this.calculateRecipeAllergens(
            tenantId,
            item.recipe.id,
          );
          const conflictingAllergens = recipeAllergens.filter((allergenId) =>
            filteredAllergens.includes(allergenId),
          );

          if (conflictingAllergens.length > 0) {
            conflicts.push({
              recipeId: item.recipe.id,
              filteredAllergens: conflictingAllergens,
            });
          }
        }
      }
    }

    return conflicts;
  }

  async generateComplianceReport(
    tenantId: string,
    menuId: string,
    reportType: "FULL" | "SUMMARY" = "FULL",
  ): Promise<AllergenComplianceReportDto> {
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
      throw new NotFoundException("Menu not found");
    }

    const missingDeclarations = new Set<string>();
    const allProductsUsed = new Set<string>();

    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe) {
          for (const ingredient of item.recipe.ingredients) {
            allProductsUsed.add(ingredient.productId);

            if (
              !ingredient.product.allergens ||
              ingredient.product.allergens.length === 0
            ) {
              missingDeclarations.add(ingredient.product.id);
            }
          }
        }
      }
    }

    const conflicts = await this.detectAllergenConflicts(tenantId, menuId, []);

    const report: AllergenComplianceReportDto = {
      menuId,
      reportType,
      missingDeclarations: Array.from(missingDeclarations),
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };

    return report;
  }

  async getAllergensInfo(): Promise<any[]> {
    return ALLERGENS_INFO;
  }

  async getProductsWithAllergens(
    tenantId: string,
    allergenIds: number[],
  ): Promise<any[]> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        allergens: {
          hasSome: allergenIds,
        },
      },
      select: {
        id: true,
        name: true,
        allergens: true,
      },
    });

    return products;
  }

  async getRecipesWithAllergens(
    tenantId: string,
    allergenIds: number[],
  ): Promise<any[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        tenantId,
        allergens: {
          hasSome: allergenIds,
        },
      },
      select: {
        id: true,
        name: true,
        allergens: true,
      },
    });

    return recipes;
  }

  async getMenusWithAllergens(
    tenantId: string,
    allergenIds: number[],
  ): Promise<any[]> {
    const menus = await this.prisma.menu.findMany({
      where: {
        tenantId,
        allergens: {
          hasSome: allergenIds,
        },
      },
      select: {
        id: true,
        name: true,
        allergens: true,
      },
    });

    return menus;
  }

  async recalculateAllAllergensForTenant(tenantId: string): Promise<any> {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const recipes = await this.prisma.recipe.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const menus = await this.prisma.menu.findMany({
      where: { tenantId },
      select: { id: true },
    });

    for (const product of products) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          allergens: product.id
            ? await this.getProductAllergens(product.id)
            : [],
        },
      });
    }

    for (const recipe of recipes) {
      await this.calculateRecipeAllergens(tenantId, recipe.id);
    }

    for (const menu of menus) {
      await this.calculateMenuAllergens(tenantId, menu.id);
    }

    return {
      success: true,
      message: "All allergens recalculated for tenant",
      stats: {
        products: products.length,
        recipes: recipes.length,
        menus: menus.length,
      },
    };
  }

  private async getProductAllergens(productId: string): Promise<number[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { allergens: true },
    });

    return product?.allergens || [];
  }
}
