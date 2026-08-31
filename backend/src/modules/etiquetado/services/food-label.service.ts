import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { LotNumberService } from "./lot-number.service";
import { computeUseByDate, resolveConservation } from "../util/shelf-life.util";
import { StorageCondition } from "../constants/storage-condition.constant";
import { CreateFoodLabelDto } from "../dto/create-food-label.dto";
import { ListFoodLabelsDto } from "../dto/list-food-labels.dto";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface SessionUser {
  id: string;
  name?: string | null;
}

const FOOD_LABEL_INCLUDE = {
  ingredientLots: true,
  recipe: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  sourceLot: {
    select: {
      id: true,
      lotNumber: true,
      receivedAt: true,
      expiryDate: true,
      supplier: { select: { name: true } },
    },
  },
} satisfies Prisma.FoodLabelInclude;

@Injectable()
export class FoodLabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lotNumberService: LotNumberService,
  ) {}

  async create(tenantId: string, user: SessionUser, dto: CreateFoodLabelDto) {
    const preparedAt = dto.preparedAt ? new Date(dto.preparedAt) : new Date();

    const base =
      dto.labelType === "ELABORATED"
        ? await this.loadRecipeContext(tenantId, dto.recipeId)
        : await this.loadProductContext(tenantId, dto.productId);

    const conservation = resolveConservation(base.conservation, {
      storageCondition: dto.storageCondition ?? null,
      storageTempMin: dto.storageTempMin ?? null,
      storageTempMax: dto.storageTempMax ?? null,
      shelfLifeDays: dto.shelfLifeDays ?? null,
      shelfLifeFrozenDays: dto.shelfLifeFrozenDays ?? null,
    });

    if (!conservation.storageCondition) {
      throw new BadRequestException(
        "Falta la condición de conservación: configúrala en la receta/artículo o indícala en la etiqueta.",
      );
    }

    const useByDate = this.resolveUseByDate(
      dto.useByDate,
      preparedAt,
      conservation.shelfLifeDays,
    );

    const freeze = Boolean(dto.freeze);
    const frozenAt = freeze
      ? dto.frozenAt
        ? new Date(dto.frozenAt)
        : new Date()
      : null;
    const frozenUseByDate =
      frozenAt && conservation.shelfLifeFrozenDays !== null
        ? computeUseByDate(frozenAt, conservation.shelfLifeFrozenDays)
        : null;

    const sourceLot = await this.resolveSourceLot(
      tenantId,
      dto.labelType,
      dto.sourceLotId,
      base.productId,
    );

    const manufacturerExpiryDate = dto.manufacturerExpiryDate
      ? new Date(dto.manufacturerExpiryDate)
      : (sourceLot?.expiryDate ?? null);

    const ingredientLotRows =
      dto.labelType === "ELABORATED"
        ? await this.buildIngredientLotRows(tenantId, dto)
        : [];

    const commonData: Omit<Prisma.FoodLabelUncheckedCreateInput, "lotNumber"> =
      {
        tenantId,
        labelType: dto.labelType,
        recipeId: dto.labelType === "ELABORATED" ? base.entityId : null,
        productId: dto.labelType === "HANDLED" ? base.entityId : null,
        itemName: base.name,
        sourceLotId: sourceLot?.id ?? null,
        productionOrderId: dto.productionOrderId ?? null,
        preparedAt,
        manufacturerExpiryDate,
        useByDate,
        frozenAt,
        frozenUseByDate,
        storageCondition: conservation.storageCondition as StorageCondition,
        storageTempMin: conservation.storageTempMin,
        storageTempMax: conservation.storageTempMax,
        shelfLifeDaysApplied: conservation.shelfLifeDays,
        quantity: dto.quantity ?? null,
        quantityUnit: dto.quantityUnit ?? null,
        portions: dto.portions ?? null,
        allergens: base.allergens,
        notes: dto.notes ?? null,
        createdByUserId: user.id,
        createdByName: user.name?.trim() || "—",
        ingredientLots: ingredientLotRows.length
          ? { create: ingredientLotRows }
          : undefined,
      };

    if (dto.labelType === "HANDLED") {
      const lotNumber = (sourceLot?.lotNumber ?? dto.lotNumber ?? "").trim();
      if (!lotNumber) {
        throw new BadRequestException(
          "Falta el nº de lote: elige un lote de proveedor o escríbelo.",
        );
      }
      return this.prisma.foodLabel.create({
        data: { ...commonData, lotNumber },
        include: FOOD_LABEL_INCLUDE,
      });
    }

    // ELABORATED: nº de lote autogenerado con reintento ante colisión.
    for (
      let attempt = 0;
      attempt <= this.lotNumberService.maxRetries;
      attempt++
    ) {
      const lotNumber = await this.lotNumberService.generateElaboratedLot(
        tenantId,
        base.name,
        preparedAt,
        attempt,
      );
      try {
        return await this.prisma.foodLabel.create({
          data: { ...commonData, lotNumber },
          include: FOOD_LABEL_INCLUDE,
        });
      } catch (err) {
        const isDupLot =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isDupLot && attempt < this.lotNumberService.maxRetries) {
          continue;
        }
        if (isDupLot) {
          break; // agotados los reintentos → ConflictException abajo
        }
        throw err;
      }
    }
    throw new ConflictException(
      "No se pudo asignar un nº de lote libre; reinténtalo.",
    );
  }

  async list(tenantId: string, query: ListFoodLabelsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const where: Prisma.FoodLabelWhereInput = {
      tenantId,
      ...(query.labelType ? { labelType: query.labelType } : {}),
      ...(query.recipeId ? { recipeId: query.recipeId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.lotNumber
        ? { lotNumber: { contains: query.lotNumber, mode: "insensitive" } }
        : {}),
      ...(query.from || query.to
        ? {
            preparedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.includeVoided ? {} : { voidedAt: null }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.foodLabel.findMany({
        where,
        include: FOOD_LABEL_INCLUDE,
        orderBy: { preparedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.foodLabel.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getById(tenantId: string, id: string) {
    const label = await this.prisma.foodLabel.findFirst({
      where: { id, tenantId },
      include: FOOD_LABEL_INCLUDE,
    });
    if (!label) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    return label;
  }

  /** Sin tenant: el `qrToken` es la credencial. Usado por la ficha pública. */
  async getByQrToken(qrToken: string) {
    const label = await this.prisma.foodLabel.findUnique({
      where: { qrToken },
      include: FOOD_LABEL_INCLUDE,
    });
    if (!label) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    return label;
  }

  async void(tenantId: string, id: string, reason: string | undefined) {
    const label = await this.prisma.foodLabel.findFirst({
      where: { id, tenantId },
      select: { id: true, voidedAt: true },
    });
    if (!label) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    if (label.voidedAt) {
      throw new ConflictException("La etiqueta ya está anulada");
    }
    return this.prisma.foodLabel.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: reason?.trim() || null },
      include: FOOD_LABEL_INCLUDE,
    });
  }

  async markReprinted(tenantId: string, id: string) {
    const label = await this.prisma.foodLabel.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!label) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    return this.prisma.foodLabel.update({
      where: { id },
      data: { reprintCount: { increment: 1 } },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private resolveUseByDate(
    explicit: string | undefined,
    preparedAt: Date,
    shelfLifeDays: number | null,
  ): Date {
    if (explicit) {
      return new Date(explicit);
    }
    if (shelfLifeDays !== null) {
      return computeUseByDate(preparedAt, shelfLifeDays);
    }
    throw new BadRequestException(
      "Falta el consumo preferente: configura los días de vida útil en la receta/artículo o indica la fecha en la etiqueta.",
    );
  }

  private async loadRecipeContext(tenantId: string, recipeId?: string) {
    if (!recipeId) {
      throw new BadRequestException(
        "Falta recipeId para una etiqueta de plato elaborado",
      );
    }
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        allergens: true,
        shelfLifeDays: true,
        shelfLifeFrozenDays: true,
        storageCondition: true,
        storageTempMin: true,
        storageTempMax: true,
      },
    });
    if (!recipe) {
      throw new NotFoundException("Receta no encontrada");
    }
    return {
      entityId: recipe.id,
      productId: null as string | null,
      name: recipe.name,
      allergens: recipe.allergens ?? [],
      conservation: {
        storageCondition: recipe.storageCondition as StorageCondition | null,
        storageTempMin: recipe.storageTempMin,
        storageTempMax: recipe.storageTempMax,
        shelfLifeDays: recipe.shelfLifeDays,
        shelfLifeFrozenDays: recipe.shelfLifeFrozenDays,
      },
    };
  }

  private async loadProductContext(tenantId: string, productId?: string) {
    if (!productId) {
      throw new BadRequestException(
        "Falta productId para una etiqueta de artículo manipulado",
      );
    }
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
    return {
      entityId: product.id,
      productId: product.id as string | null,
      name: product.name,
      allergens: product.allergens ?? [],
      conservation: {
        storageCondition: product.storageCondition as StorageCondition | null,
        storageTempMin: product.storageTempMin,
        storageTempMax: product.storageTempMax,
        shelfLifeDays: product.secondaryShelfLifeDays,
        shelfLifeFrozenDays: product.shelfLifeFrozenDays,
      },
    };
  }

  private async resolveSourceLot(
    tenantId: string,
    labelType: string,
    sourceLotId: string | undefined,
    productId: string | null,
  ) {
    if (labelType !== "HANDLED" || !sourceLotId) {
      return null;
    }
    const lot = await this.prisma.lot.findFirst({
      where: { id: sourceLotId, tenantId },
      select: { id: true, lotNumber: true, expiryDate: true, productId: true },
    });
    if (!lot) {
      throw new NotFoundException("Lote de proveedor no encontrado");
    }
    if (productId && lot.productId !== productId) {
      throw new BadRequestException(
        "El lote seleccionado no pertenece a ese artículo",
      );
    }
    return lot;
  }

  private async buildIngredientLotRows(
    tenantId: string,
    dto: CreateFoodLabelDto,
  ): Promise<
    Prisma.FoodLabelIngredientLotUncheckedCreateWithoutFoodLabelInput[]
  > {
    const rows = dto.ingredientLots ?? [];
    if (!rows.length) {
      return [];
    }

    const lotIds = rows
      .map((r) => r.lotId)
      .filter((v): v is string => Boolean(v));
    const validLots = lotIds.length
      ? await this.prisma.lot.findMany({
          where: { id: { in: lotIds }, tenantId },
          select: { id: true, productId: true },
        })
      : [];
    const lotById = new Map(validLots.map((l) => [l.id, l]));

    return rows.map((r) => {
      if (r.lotId && !lotById.has(r.lotId)) {
        throw new BadRequestException(
          `Lote de ingrediente no encontrado: ${r.lotId}`,
        );
      }
      if (r.lotId && r.productId) {
        const lot = lotById.get(r.lotId);
        if (lot && lot.productId !== r.productId) {
          throw new BadRequestException(
            `El lote ${r.lotId} no pertenece al ingrediente indicado`,
          );
        }
      }
      return {
        productName: r.productName,
        lotNumber: r.lotNumber ?? "",
        quantityUsed: r.quantityUsed ?? null,
        unit: r.unit ?? null,
        productId: r.productId ?? null,
        lotId: r.lotId ?? null,
      };
    });
  }
}
