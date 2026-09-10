import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { LotNumberService } from "./lot-number.service";
import {
  ConservationInput,
  ResolvedConservation,
  computeUseByDate,
  isSameMadridDay,
  resolveConservation,
} from "../util/shelf-life.util";
import { StorageCondition } from "../constants/storage-condition.constant";
import { deriveLotPrefix } from "../util/lot-prefix.util";
import { CreateFoodLabelDto } from "../dto/create-food-label.dto";
import { UpdateFoodLabelDto } from "../dto/update-food-label.dto";
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

    const freeze = Boolean(dto.freeze);
    const frozenAt = freeze
      ? dto.frozenAt
        ? new Date(dto.frozenAt)
        : new Date()
      : null;

    const { conservation, frozenUseByDate, useByDate } = this.resolveLabelDates(
      {
        base: base.conservation,
        override: {
          storageCondition: dto.storageCondition ?? null,
          storageTempMin: dto.storageTempMin ?? null,
          storageTempMax: dto.storageTempMax ?? null,
          shelfLifeDays: dto.shelfLifeDays ?? null,
          shelfLifeFrozenDays: dto.shelfLifeFrozenDays ?? null,
        },
        preparedAt,
        freeze,
        frozenAt,
        explicitUseByDate: dto.useByDate,
      },
    );

    const sourceLot = await this.resolveSourceLot(
      tenantId,
      dto.labelType,
      dto.sourceLotId,
      base.productId,
    );
    const purchase = await this.resolvePurchaseLine(
      tenantId,
      dto.labelType,
      dto.sourcePurchaseLineId,
      base.productId,
    );

    const manufacturerExpiryDate = dto.manufacturerExpiryDate
      ? new Date(dto.manufacturerExpiryDate)
      : (sourceLot?.expiryDate ?? null);

    // HANDLED: nº de lote del proveedor (del Lot, o escrito a mano). Si no hay
    // (típico de Makro), la etiqueta se ancla en la fecha de compra.
    const supplierLotNumber =
      dto.labelType === "HANDLED"
        ? (sourceLot?.lotNumber ?? dto.lotNumber ?? "").trim()
        : "";
    const purchaseDate = supplierLotNumber
      ? null
      : (purchase?.date ?? sourceLot?.receivedAt ?? null);
    const supplierName =
      dto.labelType === "HANDLED"
        ? (sourceLot?.supplier?.name ??
          purchase?.supplierName ??
          base.supplierName ??
          null)
        : null;

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
        supplierName,
        purchaseDate,
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
      if (supplierLotNumber) {
        return this.prisma.foodLabel.create({
          data: { ...commonData, lotNumber: supplierLotNumber },
          include: FOOD_LABEL_INCLUDE,
        });
      }
      if (!purchaseDate) {
        throw new BadRequestException(
          "Falta el lote: elige un lote de proveedor, la compra de la que sale el artículo, o escribe el nº de lote.",
        );
      }
      return this.createHandledWithoutLot(commonData, base.name, purchaseDate);
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

  /**
   * HANDLED sin lote: identificador interno único `PREFIJO-C<DDMMAA>[-N]` (no
   * se imprime; la etiqueta muestra "compra <fecha>"). Reintenta ante colisión
   * con la restricción `@@unique([tenantId, lotNumber])`.
   */
  private async createHandledWithoutLot(
    commonData: Omit<Prisma.FoodLabelUncheckedCreateInput, "lotNumber">,
    productName: string,
    purchaseDate: Date,
  ) {
    const stem = `${deriveLotPrefix(productName)}-C${this.lotNumberService.formatDatePart(
      purchaseDate,
    )}`;
    const maxRetries = this.lotNumberService.maxRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const lotNumber = attempt === 0 ? stem : `${stem}-${attempt + 1}`;
      try {
        return await this.prisma.foodLabel.create({
          data: { ...commonData, lotNumber },
          include: FOOD_LABEL_INCLUDE,
        });
      } catch (err) {
        const isDupLot =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (isDupLot && attempt < maxRetries) {
          continue;
        }
        if (isDupLot) {
          break;
        }
        throw err;
      }
    }
    throw new ConflictException(
      "No se pudo asignar un identificador de etiqueta; reinténtalo.",
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

  /**
   * Corrige una etiqueta el mismo día, antes de reimprimirla (errores de
   * conservación, fecha, cantidad…). Recalcula el consumo preferente y deja
   * traza en `editLog`. Rechaza si está anulada, ya reimpresa o no es de hoy.
   */
  async update(
    tenantId: string,
    user: SessionUser,
    id: string,
    dto: UpdateFoodLabelDto,
  ) {
    const label = await this.prisma.foodLabel.findFirst({
      where: { id, tenantId },
      include: FOOD_LABEL_INCLUDE,
    });
    if (!label) {
      throw new NotFoundException("Etiqueta no encontrada");
    }
    this.assertEditable(label);

    const base = await this.loadBaseConservation(tenantId, label);

    const preparedAt = dto.preparedAt
      ? new Date(dto.preparedAt)
      : label.preparedAt;

    // freeze: lo que diga el dto; si no viene, se mantiene el estado actual.
    const freeze =
      dto.freeze !== undefined ? dto.freeze : label.frozenAt !== null;
    const frozenAt = freeze
      ? dto.frozenAt
        ? new Date(dto.frozenAt)
        : (label.frozenAt ?? new Date())
      : null;

    const { conservation, frozenUseByDate, useByDate } = this.resolveLabelDates(
      {
        base,
        override: {
          storageCondition:
            dto.storageCondition ??
            (label.storageCondition as StorageCondition),
          storageTempMin:
            dto.storageTempMin !== undefined
              ? dto.storageTempMin
              : label.storageTempMin,
          storageTempMax:
            dto.storageTempMax !== undefined
              ? dto.storageTempMax
              : label.storageTempMax,
          shelfLifeDays:
            dto.shelfLifeDays !== undefined
              ? dto.shelfLifeDays
              : label.shelfLifeDaysApplied,
          shelfLifeFrozenDays: dto.shelfLifeFrozenDays ?? null,
        },
        preparedAt,
        freeze,
        frozenAt,
        explicitUseByDate: dto.useByDate,
      },
    );

    const manufacturerExpiryDate =
      dto.manufacturerExpiryDate !== undefined
        ? dto.manufacturerExpiryDate
          ? new Date(dto.manufacturerExpiryDate)
          : null
        : label.manufacturerExpiryDate;

    const next = {
      preparedAt,
      manufacturerExpiryDate,
      useByDate,
      frozenAt,
      frozenUseByDate,
      storageCondition: conservation.storageCondition as StorageCondition,
      storageTempMin: conservation.storageTempMin,
      storageTempMax: conservation.storageTempMax,
      shelfLifeDaysApplied: conservation.shelfLifeDays,
      quantity: dto.quantity !== undefined ? dto.quantity : label.quantity,
      quantityUnit:
        dto.quantityUnit !== undefined
          ? dto.quantityUnit?.trim() || null
          : label.quantityUnit,
      portions: dto.portions !== undefined ? dto.portions : label.portions,
      notes: dto.notes !== undefined ? dto.notes?.trim() || null : label.notes,
    };

    const changes = this.diffLabel(label, next);
    if (!Object.keys(changes).length) {
      return label;
    }

    const priorLog = Array.isArray(label.editLog)
      ? (label.editLog as unknown[])
      : [];
    const entry = {
      at: new Date().toISOString(),
      by: user.name?.trim() || "—",
      changes,
    };

    return this.prisma.foodLabel.update({
      where: { id },
      data: {
        ...next,
        editedAt: new Date(),
        editedByUserId: user.id,
        editedByName: user.name?.trim() || "—",
        editCount: { increment: 1 },
        editLog: [...priorLog, entry] as Prisma.InputJsonValue,
      },
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

  /**
   * Fecha de consumo preferente de la etiqueta. Si se congela, manda la
   * fecha límite de congelado (la vida útil en refrigerado no aplica); si
   * no, la vida útil normal contada desde la elaboración/manipulación.
   */
  private resolveUseByDate(input: {
    explicit: string | undefined;
    preparedAt: Date;
    shelfLifeDays: number | null;
    frozenUseByDate: Date | null;
    freeze: boolean;
  }): Date {
    if (input.explicit) {
      return new Date(input.explicit);
    }
    if (input.freeze) {
      if (input.frozenUseByDate) {
        return input.frozenUseByDate;
      }
      throw new BadRequestException(
        "Falta el consumo preferente: indica los días de vida útil de congelado.",
      );
    }
    if (input.shelfLifeDays !== null) {
      return computeUseByDate(input.preparedAt, input.shelfLifeDays);
    }
    throw new BadRequestException(
      "Falta el consumo preferente: configura los días de vida útil en la receta/artículo o indica la fecha en la etiqueta.",
    );
  }

  /**
   * Resuelve conservación efectiva + fechas de consumo (congelado y final) a
   * partir de la config base de la entidad y los overrides de la etiqueta.
   * Compartido por `create()` y `update()` para que ambos calculen igual.
   */
  private resolveLabelDates(input: {
    base: ConservationInput;
    override: ConservationInput;
    preparedAt: Date;
    freeze: boolean;
    frozenAt: Date | null;
    explicitUseByDate: string | undefined;
  }): {
    conservation: ResolvedConservation;
    frozenUseByDate: Date | null;
    useByDate: Date;
  } {
    const conservation = resolveConservation(input.base, input.override);
    if (!conservation.storageCondition) {
      throw new BadRequestException(
        "Falta la condición de conservación: configúrala en la receta/artículo o indícala en la etiqueta.",
      );
    }
    // Congelado: el consumo preferente ES la fecha límite de congelado (la
    // vida útil en refrigerado ya no aplica). Sin congelar: vida útil normal.
    const frozenUseByDate =
      input.frozenAt && conservation.shelfLifeFrozenDays !== null
        ? computeUseByDate(input.frozenAt, conservation.shelfLifeFrozenDays)
        : null;
    const useByDate = this.resolveUseByDate({
      explicit: input.explicitUseByDate,
      preparedAt: input.preparedAt,
      shelfLifeDays: conservation.shelfLifeDays,
      frozenUseByDate,
      freeze: input.freeze,
    });
    return { conservation, frozenUseByDate, useByDate };
  }

  private assertEditable(label: {
    voidedAt: Date | null;
    reprintCount: number;
    createdAt: Date;
  }): void {
    if (label.voidedAt) {
      throw new ConflictException(
        "La etiqueta está anulada: crea una nueva en su lugar.",
      );
    }
    if (label.reprintCount > 0) {
      throw new ConflictException(
        "La etiqueta ya se ha reimpreso: anúlala y crea una nueva con los datos corregidos.",
      );
    }
    if (!isSameMadridDay(label.createdAt, new Date())) {
      throw new ConflictException(
        "Solo se puede corregir una etiqueta el mismo día en que se creó. Anúlala y crea una nueva.",
      );
    }
  }

  /**
   * Config de conservación base para recalcular al editar: la viva de la
   * receta/artículo; si la entidad ya no existe, el snapshot de la etiqueta
   * (sin `shelfLifeFrozenDays`, que el override del dto debe aportar).
   */
  private async loadBaseConservation(
    tenantId: string,
    label: {
      labelType: string;
      recipeId: string | null;
      productId: string | null;
      storageCondition: string;
      storageTempMin: number | null;
      storageTempMax: number | null;
      shelfLifeDaysApplied: number | null;
    },
  ): Promise<ConservationInput> {
    try {
      const ctx =
        label.labelType === "ELABORATED"
          ? await this.loadRecipeContext(tenantId, label.recipeId ?? undefined)
          : await this.loadProductContext(
              tenantId,
              label.productId ?? undefined,
            );
      return ctx.conservation;
    } catch {
      return {
        storageCondition: label.storageCondition as StorageCondition | null,
        storageTempMin: label.storageTempMin,
        storageTempMax: label.storageTempMax,
        shelfLifeDays: label.shelfLifeDaysApplied,
        shelfLifeFrozenDays: null,
      };
    }
  }

  /** Campos que cambian entre el estado actual y el nuevo, como { from, to }. */
  private diffLabel(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { from: unknown; to: unknown }> {
    const norm = (v: unknown): unknown =>
      v instanceof Date ? v.toISOString() : v;
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of Object.keys(after)) {
      const b = norm(before[field]);
      const a = norm(after[field]);
      if (b !== a) {
        out[field] = { from: b, to: a };
      }
    }
    return out;
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
      supplierName: null as string | null,
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
        supplier: { select: { name: true } },
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
      supplierName: product.supplier?.name ?? null,
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
      select: {
        id: true,
        lotNumber: true,
        expiryDate: true,
        productId: true,
        receivedAt: true,
        supplier: { select: { name: true } },
      },
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

  /**
   * HANDLED sin lote: valida la línea de compra elegida y devuelve fecha +
   * proveedor para anclar la trazabilidad de la etiqueta.
   */
  private async resolvePurchaseLine(
    tenantId: string,
    labelType: string,
    lineId: string | undefined,
    productId: string | null,
  ): Promise<{ date: Date; supplierName: string | null } | null> {
    if (labelType !== "HANDLED" || !lineId) {
      return null;
    }
    const line = await this.prisma.albaranLine.findFirst({
      where: { id: lineId, albaran: { tenantId, deletedAt: null } },
      select: {
        matchedProductId: true,
        albaran: {
          select: { date: true, supplier: { select: { name: true } } },
        },
      },
    });
    if (!line) {
      throw new NotFoundException("Compra no encontrada");
    }
    if (productId && line.matchedProductId !== productId) {
      throw new BadRequestException(
        "La compra seleccionada no es de ese artículo",
      );
    }
    return {
      date: line.albaran.date,
      supplierName: line.albaran.supplier?.name ?? null,
    };
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
