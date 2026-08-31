import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { StorageCondition } from "../constants/storage-condition.constant";

export interface ConservationConfig {
  storageCondition: StorageCondition | null;
  storageTempMin: number | null;
  storageTempMax: number | null;
  shelfLifeDays: number | null;
  shelfLifeFrozenDays: number | null;
}

export interface AvailableLot {
  id: string;
  lotNumber: string;
  receivedAt: string;
  expiryDate: string | null;
  supplierName: string | null;
  quantity: number;
}

/**
 * Datos para pre-rellenar el formulario de alta de etiqueta:
 * - receta → ingredientes directos + lotes disponibles por ingrediente + config
 *   de conservación. Las sub-recetas se listan por nombre (sin lotes en v1).
 * - artículo → sus lotes + candidata de caducidad de fabricante + config de
 *   conservación secundaria.
 */
@Injectable()
export class FoodLabelContextService {
  constructor(private readonly prisma: PrismaService) {}

  async forRecipe(tenantId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        allergens: true,
        portions: true,
        shelfLifeDays: true,
        shelfLifeFrozenDays: true,
        storageCondition: true,
        storageTempMin: true,
        storageTempMax: true,
        ingredients: {
          where: { product: { deletedAt: null } },
          select: {
            productId: true,
            quantity: true,
            unit: true,
            product: { select: { name: true, lot: true } },
          },
        },
        subRecipes: {
          select: { subRecipeId: true, subRecipe: { select: { name: true } } },
        },
      },
    });
    if (!recipe) {
      throw new NotFoundException("Receta no encontrada");
    }

    const productIds = recipe.ingredients.map((i) => i.productId);
    const lotsByProduct = await this.lotsByProduct(tenantId, productIds);

    return {
      recipeId: recipe.id,
      name: recipe.name,
      allergens: recipe.allergens ?? [],
      portions: recipe.portions,
      conservation: this.recipeConservation(recipe),
      ingredients: recipe.ingredients.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        quantity: i.quantity,
        unit: i.unit,
        lastKnownLot: i.product.lot ?? null,
        availableLots: lotsByProduct.get(i.productId) ?? [],
      })),
      subRecipes: recipe.subRecipes.map((s) => ({
        subRecipeId: s.subRecipeId,
        name: s.subRecipe.name,
      })),
    };
  }

  async forProduct(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        allergens: true,
        secondaryShelfLifeDays: true,
        shelfLifeFrozenDays: true,
        storageCondition: true,
        storageTempMin: true,
        storageTempMax: true,
      },
    });
    if (!product) {
      throw new NotFoundException("Artículo no encontrado");
    }

    const lots =
      (await this.lotsByProduct(tenantId, [productId])).get(productId) ?? [];

    return {
      productId: product.id,
      name: product.name,
      allergens: product.allergens ?? [],
      conservation: {
        storageCondition: product.storageCondition as StorageCondition | null,
        storageTempMin: product.storageTempMin,
        storageTempMax: product.storageTempMax,
        shelfLifeDays: product.secondaryShelfLifeDays,
        shelfLifeFrozenDays: product.shelfLifeFrozenDays,
      } satisfies ConservationConfig,
      lots,
      manufacturerExpiryCandidate: lots[0]?.expiryDate ?? null,
    };
  }

  private recipeConservation(recipe: {
    storageCondition: string | null;
    storageTempMin: number | null;
    storageTempMax: number | null;
    shelfLifeDays: number | null;
    shelfLifeFrozenDays: number | null;
  }): ConservationConfig {
    return {
      storageCondition: recipe.storageCondition as StorageCondition | null,
      storageTempMin: recipe.storageTempMin,
      storageTempMax: recipe.storageTempMax,
      shelfLifeDays: recipe.shelfLifeDays,
      shelfLifeFrozenDays: recipe.shelfLifeFrozenDays,
    };
  }

  private async lotsByProduct(
    tenantId: string,
    productIds: string[],
  ): Promise<Map<string, AvailableLot[]>> {
    const map = new Map<string, AvailableLot[]>();
    if (!productIds.length) {
      return map;
    }
    const lots = await this.prisma.lot.findMany({
      where: { tenantId, productId: { in: productIds } },
      select: {
        id: true,
        productId: true,
        lotNumber: true,
        receivedAt: true,
        expiryDate: true,
        quantity: true,
        supplier: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
    });
    for (const lot of lots) {
      const row: AvailableLot = {
        id: lot.id,
        lotNumber: lot.lotNumber,
        receivedAt: lot.receivedAt.toISOString(),
        expiryDate: lot.expiryDate?.toISOString() ?? null,
        supplierName: lot.supplier?.name ?? null,
        quantity: lot.quantity,
      };
      const list = map.get(lot.productId) ?? [];
      list.push(row);
      map.set(lot.productId, list);
    }
    return map;
  }
}
