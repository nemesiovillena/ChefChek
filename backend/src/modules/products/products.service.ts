import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import {
  getReferencePrice,
  referencePriceChanged,
} from "../../common/utils/unit-conversions";
import { ProductSupplierOffersService } from "./product-supplier-offers.service";
import { NotificationsService } from "../core/notifications.service";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productSupplierOffersService: ProductSupplierOffersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private resolveLastPurchase(
    albaranDate: Date | null,
    manualDate: Date | null,
  ): {
    lastPurchaseDate: Date | null;
    purchaseDateSource: "albaran" | "manual" | null;
  } {
    if (albaranDate && manualDate) {
      return albaranDate >= manualDate
        ? { lastPurchaseDate: albaranDate, purchaseDateSource: "albaran" }
        : { lastPurchaseDate: manualDate, purchaseDateSource: "manual" };
    }
    if (albaranDate) {
      return { lastPurchaseDate: albaranDate, purchaseDateSource: "albaran" };
    }
    if (manualDate) {
      return { lastPurchaseDate: manualDate, purchaseDateSource: "manual" };
    }
    return { lastPurchaseDate: null, purchaseDateSource: null };
  }

  async create(createProductDto: CreateProductDto, requestTenantId: string) {
    const {
      purchasePrice,
      wastePercentage = 0,
      profitMargin = 0,
      yieldFactor = 1.0,
      grossWeight,
      netWeight,
      allergens = [],
      category,
      supplier,
      unitsPerFormat = 1,
      referenceUnitSize,
      unitSize,
      nutritionalInfo,
      minimumStock,
      maximumStock,
      ...productData
    } = createProductDto;

    // Calculate unitSize from unitsPerFormat * referenceUnitSize
    const effectiveRefUnitSize = referenceUnitSize ?? unitSize ?? 1;
    const calculatedUnitSize = unitsPerFormat * effectiveRefUnitSize;

    const effectivePrice = purchasePrice ?? 0;
    const netPrice = this.calculateNetPrice(
      effectivePrice,
      wastePercentage,
      profitMargin,
    );
    // Peso Bruto/Neto (prueba de rendimiento) manda sobre el % de merma manual
    // cuando ambos llegan — deriva yieldFactor/wastePercentage reales.
    const yieldFromWeights =
      grossWeight && netWeight && grossWeight > 0
        ? netWeight / grossWeight
        : undefined;
    const finalYieldFactor =
      yieldFromWeights ??
      (wastePercentage > 0
        ? this.calculateYieldFactor(wastePercentage)
        : yieldFactor);
    const finalWastePercentage =
      yieldFromWeights !== undefined
        ? 100 - yieldFromWeights * 100
        : wastePercentage;

    const createData: any = {
      tenantId: requestTenantId,
      purchasePrice: effectivePrice,
      netPrice,
      profitMargin,
      wastePercentage: finalWastePercentage,
      yieldFactor: finalYieldFactor,
      grossWeight,
      netWeight,
      allergens,
      unitsPerFormat,
      referenceUnitSize: effectiveRefUnitSize,
      unitSize: calculatedUnitSize,
      ...productData,
    };

    if (category) {
      createData.categoryId = category;
    }
    if (supplier) {
      createData.supplierId = supplier;
    }

    // Nested create: información nutricional
    if (nutritionalInfo) {
      createData.nutritionalInfo = {
        create: nutritionalInfo,
      };
    }

    const product = await this.prisma.product.create({
      data: createData,
      include: {
        purchaseFormats: true,
        nutritionalInfo: true,
        category: true,
        supplier: true,
        stocks: true,
      },
    });

    // Create stock record with min/max if provided
    if (minimumStock !== undefined || maximumStock !== undefined) {
      await this.prisma.stock.create({
        data: {
          tenantId: requestTenantId,
          productId: product.id,
          minimumStock: minimumStock || 0,
          maximumStock: maximumStock || null,
          quantity: 0,
        },
      });
    }

    return {
      success: true,
      data: product,
      message: "Product created successfully",
    };
  }

  // ─── Detección advisory de duplicados por nombre ────────────────
  // Normaliza acentos (español) para comparar Tomate = Tomáte = JAMÓN.
  // Advisory-only: NO bloquea create/update/bulk; solo alimenta el aviso
  // de la UI. Ambos lados se pasan por lower() antes de mapear acentos,
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

    // Matching "exacto + contiene + primera palabra" (accent-insensitive):
    // avisa si el nombre es idéntico, si lo escrito está contenido en uno
    // existente (o viceversa: "aceite girasol" ⊂ "Aceite girasol alto
    // oleico"), o si ambos empiezan por la misma palabra (≥3 letras: evita
    // ruido con "de/el/la"). Este último caso cubre líneas OCR de albarán
    // largas que solo comparten el género del producto con el artículo ya
    // existente, ej. "Lejía caja 6ud x 2L" vs "Lejía alimentaria 2L
    // sanitaria" — mismo inicio, cero contención mutua. NO detecta typos
    // ("grasol"≠"girasol"). Se normaliza una sola vez (CTE + subquery) para
    // no repetir translate().
    const matches = await this.prisma.$queryRaw<
      { id: string; name: string; isActive: boolean }[]
    >(Prisma.sql`
      WITH norm AS (
        SELECT translate(lower(trim(${trimmed})), ${ProductsService.ACCENTS_FROM}, ${ProductsService.ACCENTS_TO}) AS input
      )
      SELECT q.id, q.name, q."isActive"
      FROM (
        SELECT p.id, p.name, p."isActive",
               translate(lower(trim(p.name)), ${ProductsService.ACCENTS_FROM}, ${ProductsService.ACCENTS_TO}) AS pn
        FROM products p
        WHERE p."tenantId" = ${tenantId}
          AND p."deletedAt" IS NULL
          ${excludeId ? Prisma.sql`AND p.id <> ${excludeId}` : Prisma.empty}
      ) q
      CROSS JOIN norm
      WHERE strpos(q.pn, norm.input) > 0
         OR strpos(norm.input, q.pn) > 0
         OR (
           LENGTH(split_part(q.pn, ' ', 1)) >= 3
           AND split_part(q.pn, ' ', 1) = split_part(norm.input, ' ', 1)
         )
      ORDER BY (q.pn = norm.input) DESC, LENGTH(q.name), q.name
      LIMIT 5
    `);
    return matches;
  }

  // Debe reflejar exactamente resolveLastPurchase(): el más reciente entre
  // la fecha de albarán y la fecha manual (Postgres GREATEST ignora NULLs).
  private static readonly LAST_PURCHASE_DATE_SQL = Prisma.sql`GREATEST(p."manualPurchaseDate", (SELECT MAX(a."date") FROM albaran_lines al JOIN albaranes a ON a.id = al."albaranId" WHERE al."matchedProductId" = p.id AND a."deletedAt" IS NULL))`;

  private static readonly REFERENCE_PRICE_SQL = Prisma.sql`(p."purchasePrice" / NULLIF(p."unitSize", 0))`;

  // Debe reflejar exactamente getRealPrice() (use-products.ts): usa verdad JS
  // (!!grossWeight && !!netWeight), donde 0 cuenta como "sin dato" — no basta
  // con IS NOT NULL, hay que excluir también el 0 explícito.
  private static readonly REAL_PRICE_SQL = Prisma.sql`(CASE WHEN (p."grossWeight" IS NOT NULL AND p."grossWeight" != 0 AND p."netWeight" IS NOT NULL AND p."netWeight" != 0) OR p."wastePercentage" > 0 THEN p."purchasePrice" / NULLIF(p."unitSize", 0) / NULLIF(p."yieldFactor", 0) ELSE NULL END)`;

  private static readonly CATEGORY_NAME_SQL = Prisma.sql`COALESCE(parent.name, c.name)`;
  private static readonly SUBCATEGORY_NAME_SQL = Prisma.sql`c.name`;

  // Allowlist obligatorio: sortBy nunca se interpola directo en SQL raw.
  private sortExprFor(sortBy: string): Prisma.Sql {
    switch (sortBy) {
      case "purchasePrice":
        return Prisma.sql`p."purchasePrice"`;
      case "isActive":
        return Prisma.sql`p."isActive"`;
      case "createdAt":
        return Prisma.sql`p."createdAt"`;
      case "lastPurchaseDate":
        return ProductsService.LAST_PURCHASE_DATE_SQL;
      case "realPrice":
        // COALESCE a 0: replica el ?? 0 del sort en cliente (legacy) — sin
        // esto, Postgres pone los NULL primero en DESC (justo al revés).
        return Prisma.sql`COALESCE(${ProductsService.REAL_PRICE_SQL}, 0)`;
      case "referencePrice":
        return ProductsService.REFERENCE_PRICE_SQL;
      case "category":
        return ProductsService.CATEGORY_NAME_SQL;
      case "subcategory":
        return ProductsService.SUBCATEGORY_NAME_SQL;
      case "name":
      default:
        return Prisma.sql`p.name`;
    }
  }

  private buildProductsWhere(
    query: ProductsQueryDto,
    requestTenantId: string,
  ): Prisma.Sql {
    const {
      categoryIds,
      search,
      category,
      supplier,
      dateField,
      dateFrom,
      dateTo,
      isActive,
      stockStatus,
    } = query;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."tenantId" = ${requestTenantId}`,
      Prisma.sql`p."deletedAt" IS NULL`,
    ];

    if (search) {
      const term = `%${search}%`;
      conditions.push(
        Prisma.sql`(p.name ILIKE ${term} OR p.description ILIKE ${term} OR p.barcode ILIKE ${term} OR p.brand ILIKE ${term})`,
      );
    }

    const ids = categoryIds
      ? categoryIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : category
        ? [category]
        : [];
    if (ids.length > 0) {
      conditions.push(Prisma.sql`p."categoryId" = ANY(${ids}::text[])`);
    }
    if (supplier) {
      // Proveedor principal del artículo O cualquier oferta multi-proveedor
      // suya (módulo Compras: los pedidos son por proveedor, y un artículo
      // puede tener ofertas de varios proveedores sin ser el principal).
      conditions.push(
        Prisma.sql`(p."supplierId" = ${supplier} OR EXISTS (
          SELECT 1 FROM product_supplier_offers pso
          WHERE pso."productId" = p.id AND pso."supplierId" = ${supplier} AND pso."deletedAt" IS NULL
        ))`,
      );
    }
    if (isActive !== undefined) {
      conditions.push(Prisma.sql`p."isActive" = ${isActive}`);
    }

    if (stockStatus === "empty") {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM stocks s WHERE s."productId" = p.id AND s.quantity <= 0)`,
      );
    } else if (stockStatus === "low") {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM stocks s WHERE s."productId" = p.id AND (s.quantity <= 0 OR (s.quantity > 0 AND s.quantity <= s."minimumStock")))`,
      );
    }

    if (dateFrom || dateTo) {
      const dateExpr =
        dateField === "lastPurchaseDate"
          ? ProductsService.LAST_PURCHASE_DATE_SQL
          : Prisma.sql`p."createdAt"`;
      if (dateFrom) {
        conditions.push(Prisma.sql`${dateExpr} >= ${new Date(dateFrom)}`);
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        conditions.push(Prisma.sql`${dateExpr} <= ${end}`);
      }
    }

    return Prisma.join(conditions, " AND ");
  }

  async findAll(query: ProductsQueryDto, requestTenantId: string) {
    const { sortBy = "name", sortOrder = "asc", page = 1, limit = 20 } = query;

    const exportAll = query.export === "true";
    const orderDirection =
      sortOrder === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const orderExpr = this.sortExprFor(sortBy);
    const whereSql = this.buildProductsWhere(query, requestTenantId);

    const paginationSql = exportAll
      ? Prisma.empty
      : Prisma.sql`LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id
        FROM products p
        LEFT JOIN categories c ON c.id = p."categoryId" AND c."deletedAt" IS NULL
        LEFT JOIN categories parent ON parent.id = c."parentId" AND parent."deletedAt" IS NULL
        WHERE ${whereSql}
        ORDER BY ${orderExpr} ${orderDirection}
        ${paginationSql}
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM products p
        WHERE ${whereSql}
      `),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const orderedIds = rows.map((r) => r.id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: orderedIds } },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
        purchaseFormats: true,
        nutritionalInfo: true,
        stocks: {
          select: {
            id: true,
            quantity: true,
            minimumStock: true,
            maximumStock: true,
          },
        },
        albaranLines: {
          select: {
            albaran: {
              select: { date: true },
            },
          },
          orderBy: { albaran: { date: "desc" } },
          take: 1,
        },
        // Último cambio de precio registrado: alimenta el badge de tendencia del
        // listado (sourcear desde el historial, no desde la columna plana
        // `previousPurchasePrice`, que deriva). Se omite en exports (no muestran
        // badge y devolverían la relación completa).
        //
        // Solo cambios originados por una compra real (albarán confirmado). Las
        // filas manuales (albaranId null = correcciones, toggles de proveedor
        // preferente, ediciones) son ruido, no tendencia de compra, y generaban
        // badges falsos (p.ej. Arla 6.95→20.85 = +200% por cambio de unidad).
        ...(exportAll
          ? {}
          : {
              priceHistory: {
                where: { albaranId: { not: null } },
                take: 1,
                orderBy: { recordedAt: "desc" },
              },
            }),
      },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    // Mapear lastPurchaseDate: la más reciente entre albarán y fecha manual
    const productsWithLastPurchase = orderedIds
      .map((id) => productsById.get(id))
      .filter((p): p is (typeof products)[number] => !!p)
      .map((p) => {
        const { albaranLines, priceHistory, ...rest } = p as any;
        const albaranDate = albaranLines?.[0]?.albaran?.date ?? null;
        const manualDate = (rest.manualPurchaseDate as Date | null) ?? null;
        const { lastPurchaseDate, purchaseDateSource } =
          this.resolveLastPurchase(albaranDate, manualDate);
        // Delta del último cambio real con traza (null si no hay historial → el
        // badge no se renderiza).
        const latest = priceHistory?.[0] ?? null;
        const latestPriceChange = latest
          ? {
              previousPrice: latest.previousPrice,
              newPrice: latest.newPrice,
              recordedAt: latest.recordedAt,
              previousUnitSize: latest.previousUnitSize,
              newUnitSize: latest.newUnitSize,
            }
          : null;
        return {
          ...rest,
          lastPurchaseDate,
          purchaseDateSource,
          latestPriceChange,
        };
      });

    return {
      success: true,
      data: productsWithLastPurchase,
      meta: exportAll
        ? { total, page: 1, limit: total || 1, totalPages: 1 }
        : { total, page, limit, totalPages: Math.ceil(total / limit) },
      message: "Products retrieved successfully",
    };
  }

  async findOne(id: string, requestTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: requestTenantId },
      include: {
        category: { include: { parent: true } },
        supplier: true,
        purchaseFormats: true,
        nutritionalInfo: true,
        stocks: true,
        albaranLines: {
          select: { albaran: { select: { date: true } } },
          orderBy: { albaran: { date: "desc" } },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const { albaranLines, ...rest } = product as any;
    const albaranDate = albaranLines?.[0]?.albaran?.date ?? null;
    const manualDate = (rest.manualPurchaseDate as Date | null) ?? null;
    const { lastPurchaseDate, purchaseDateSource } = this.resolveLastPurchase(
      albaranDate,
      manualDate,
    );

    return {
      success: true,
      data: { ...rest, lastPurchaseDate, purchaseDateSource },
      message: "Product retrieved successfully",
    };
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    requestTenantId: string,
  ) {
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, tenantId: requestTenantId },
      include: { stocks: true },
    });

    if (!existingProduct) {
      throw new NotFoundException("Product not found");
    }

    const {
      category,
      supplier,
      nutritionalInfo,
      minimumStock,
      maximumStock,
      ...updateData
    } = updateProductDto as any;

    const data: any = { ...updateData };

    if (category) {
      data.categoryId = category;
      delete data.category;
    }
    if (supplier) {
      data.supplierId = supplier;
      delete data.supplier;
    }

    // Recalculate unitSize if unitsPerFormat or referenceUnitSize changed
    if (
      data.unitsPerFormat !== undefined ||
      data.referenceUnitSize !== undefined
    ) {
      const upf = data.unitsPerFormat ?? existingProduct.unitsPerFormat ?? 1;
      const rus =
        data.referenceUnitSize ??
        existingProduct.referenceUnitSize ??
        existingProduct.unitSize ??
        1;
      data.unitsPerFormat = upf;
      data.referenceUnitSize = rus;
      data.unitSize = upf * rus;
    } else {
      // Sin cambios de formato: ignorar cualquier unitSize suelto (es auto-calculado)
      delete data.unitSize;
    }

    // Invariante: el trigger de historial de abajo solo evalúa €/kg cuando el DTO
    // incluye `purchasePrice` (formulario actual siempre lo manda). Un cambio de
    // formato/unitSize SIN `purchasePrice` en el mismo DTO no registra fila de
    // historial aunque el €/kg real cambie — si en el futuro se permite editar
    // solo el formato, extender `refPriceChanged` para cubrir ese caso también.

    // Flag: ¿cambia el precio normalizado €/kg? Gobierna si se registra una fila en
    // ProductPriceHistory (igual que hace el flujo de albaranes), para que las
    // ediciones manuales también dejen traza — pero sin variaciones falsas cuando
    // solo cambia el tamaño de caja/formato.
    let refPriceChanged = false;
    let newUnitSizeForHistory: number | null = existingProduct.unitSize;

    // Recalcular precios si se modifican
    if (
      updateData.purchasePrice !== undefined ||
      updateData.wastePercentage !== undefined ||
      updateData.profitMargin !== undefined
    ) {
      // Save previous price before updating (campo plano previousPurchasePrice:
      // sigue disparándose con el precio crudo, sin cambios).
      if (
        updateData.purchasePrice !== undefined &&
        updateData.purchasePrice !== existingProduct.purchasePrice
      ) {
        data.previousPurchasePrice = existingProduct.purchasePrice;
      }

      if (updateData.purchasePrice !== undefined) {
        newUnitSizeForHistory = data.unitSize ?? existingProduct.unitSize;
        refPriceChanged = referencePriceChanged(
          existingProduct.purchasePrice,
          existingProduct.unitSize,
          updateData.purchasePrice,
          newUnitSizeForHistory,
        );
      }

      const purchasePrice =
        updateData.purchasePrice ?? existingProduct.purchasePrice;
      const wastePercentage =
        updateData.wastePercentage ?? existingProduct.wastePercentage;
      const profitMargin =
        updateData.profitMargin ?? existingProduct.profitMargin;

      data.netPrice = this.calculateNetPrice(
        purchasePrice,
        wastePercentage,
        profitMargin,
      );
      if (updateData.wastePercentage !== undefined) {
        data.yieldFactor =
          wastePercentage > 0
            ? this.calculateYieldFactor(wastePercentage)
            : 1.0;
      }
    }

    // Si cambia el precio de compra, se enruta SIEMPRE a la oferta que sea
    // preferente AHORA MISMO (leída de BD en este instante) — nunca al
    // `supplier` que traiga el DTO, que puede ser una foto fija tomada al
    // abrir el modal y haber quedado obsoleta si mientras tanto se cambió el
    // proveedor preferente desde la pestaña "Proveedor y Stock" (ese cambio
    // es independiente e inmediato, no espera al botón Guardar). Confiar en
    // el DTO aquí revertía el proveedor preferente al guardar el formulario
    // grande. Solo se usa `supplier` del DTO como fallback cuando el producto
    // todavía no tiene ninguna oferta (alta inicial de la primera oferta).
    if (updateData.purchasePrice !== undefined) {
      const currentPreferredOffer =
        await this.prisma.productSupplierOffer.findFirst({
          where: {
            productId: id,
            tenantId: requestTenantId,
            isPreferred: true,
          },
        });
      const targetSupplierId = currentPreferredOffer?.supplierId ?? supplier;

      // Sin proveedor preferente y sin `supplier` en el DTO: no hay a qué
      // oferta enrutar el precio (caso legacy sin proveedor conocido) — se
      // mantiene el camino directo sobre Product de más abajo, sin tocar.
      if (targetSupplierId) {
        const offer = await this.productSupplierOffersService.upsertOffer(
          id,
          targetSupplierId,
          requestTenantId,
          {
            purchasePrice: data.purchasePrice,
            netPrice: data.netPrice,
            purchaseFormat: data.purchaseFormat,
            referenceUnit: data.referenceUnit,
            unitsPerFormat: data.unitsPerFormat,
            referenceUnitSize: data.referenceUnitSize,
            profitMargin: data.profitMargin,
          },
        );
        if (!offer.isPreferred) {
          await this.productSupplierOffersService.setPreferred(
            id,
            offer.id,
            requestTenantId,
          );
        }

        // Notificar en €/kg normalizado (no precio crudo) para no reintroducir
        // variaciones falsas por cambio de tamaño de caja — mismo criterio que
        // el histórico de precios (plans/260718-0056-historico-precio-normalizado-kg).
        if (
          referencePriceChanged(
            existingProduct.purchasePrice,
            existingProduct.unitSize,
            offer.purchasePrice,
            offer.unitSize,
          )
        ) {
          const refBefore = getReferencePrice(
            existingProduct.purchasePrice,
            existingProduct.unitSize,
          );
          const refAfter = getReferencePrice(
            offer.purchasePrice,
            offer.unitSize,
          );
          const pct = refBefore
            ? Math.abs(((refAfter - refBefore) / refBefore) * 100)
            : 100;
          await this.notificationsService.notifyPriceChange(
            requestTenantId,
            existingProduct.name,
            refBefore,
            refAfter,
            pct,
          );
        }

        delete data.supplierId;
        delete data.purchasePrice;
        delete data.previousPurchasePrice;
        delete data.netPrice;
        delete data.purchaseFormat;
        delete data.referenceUnit;
        delete data.unitsPerFormat;
        delete data.referenceUnitSize;
        delete data.unitSize;
        delete data.profitMargin;
        refPriceChanged = false;
      }
    }

    // Peso Bruto/Neto (prueba de rendimiento) manda sobre el % de merma manual
    // cuando ambos están presentes (nuevos o ya guardados) — deriva
    // yieldFactor/wastePercentage reales, igual que en create().
    if (
      updateData.grossWeight !== undefined ||
      updateData.netWeight !== undefined
    ) {
      const grossWeight = updateData.grossWeight ?? existingProduct.grossWeight;
      const netWeight = updateData.netWeight ?? existingProduct.netWeight;
      if (grossWeight && netWeight && grossWeight > 0) {
        const yieldFromWeights = netWeight / grossWeight;
        data.yieldFactor = yieldFromWeights;
        data.wastePercentage = 100 - yieldFromWeights * 100;
      }
    }

    // Upsert nutritional info
    if (nutritionalInfo) {
      data.nutritionalInfo = {
        upsert: {
          create: nutritionalInfo,
          update: nutritionalInfo,
        },
      };
    }

    // Prisma DateTime no acepta "YYYY-MM-DD" crudo; string vacío/null limpia el campo
    if (updateData.manualPurchaseDate !== undefined) {
      data.manualPurchaseDate = updateData.manualPurchaseDate
        ? new Date(updateData.manualPurchaseDate)
        : null;
    }

    const productInclude = {
      purchaseFormats: true,
      nutritionalInfo: true,
      category: { include: { parent: true } },
      supplier: true,
      stocks: true,
      albaranLines: {
        select: { albaran: { select: { date: true } } },
        orderBy: { albaran: { date: "desc" as const } },
        take: 1,
      },
    };

    // Si el precio normalizado €/kg cambió, registrar la traza de historial en la
    // misma transacción que la actualización del producto (consistencia garantizada).
    const product = refPriceChanged
      ? await this.prisma.$transaction(async (tx) => {
          const updated = await tx.product.update({
            where: { id },
            data,
            include: productInclude,
          });
          await tx.productPriceHistory.create({
            data: {
              tenantId: requestTenantId,
              productId: id,
              supplierId: existingProduct.supplierId ?? null,
              albaranId: null,
              previousPrice: existingProduct.purchasePrice,
              newPrice: updateData.purchasePrice as number,
              previousUnitSize: existingProduct.unitSize,
              newUnitSize: newUnitSizeForHistory,
            },
          });
          return updated;
        })
      : await this.prisma.product.update({
          where: { id },
          data,
          include: productInclude,
        });

    // Fuera de la transacción: no debe bloquear el commit de BD si falla el
    // envío de la notificación (WS/BD de alerts es secundaria al cambio real).
    if (refPriceChanged) {
      const refBefore = getReferencePrice(
        existingProduct.purchasePrice,
        existingProduct.unitSize,
      );
      const refAfter = getReferencePrice(
        updateData.purchasePrice as number,
        newUnitSizeForHistory ?? existingProduct.unitSize,
      );
      const pct = refBefore
        ? Math.abs(((refAfter - refBefore) / refBefore) * 100)
        : 100;
      await this.notificationsService.notifyPriceChange(
        requestTenantId,
        existingProduct.name,
        refBefore,
        refAfter,
        pct,
      );
    }

    // Update stock min/max if provided
    if (minimumStock !== undefined || maximumStock !== undefined) {
      const stock = existingProduct.stocks[0];
      if (stock) {
        await this.prisma.stock.update({
          where: { id: stock.id },
          data: {
            ...(minimumStock !== undefined && { minimumStock }),
            ...(maximumStock !== undefined && { maximumStock }),
          },
        });
      } else {
        await this.prisma.stock.create({
          data: {
            tenantId: requestTenantId,
            productId: id,
            minimumStock: minimumStock || 0,
            maximumStock: maximumStock || null,
            quantity: 0,
          },
        });
      }
    }

    const { albaranLines, ...productRest } = product as any;
    const albaranDate = albaranLines?.[0]?.albaran?.date ?? null;
    const manualDate = (productRest.manualPurchaseDate as Date | null) ?? null;
    const { lastPurchaseDate, purchaseDateSource } = this.resolveLastPurchase(
      albaranDate,
      manualDate,
    );

    return {
      success: true,
      data: { ...productRest, lastPurchaseDate, purchaseDateSource },
      message: "Product updated successfully",
    };
  }

  async remove(id: string, requestTenantId: string) {
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, tenantId: requestTenantId },
    });

    if (!existingProduct) {
      throw new NotFoundException("Product not found");
    }

    await this.prisma.product.delete({ where: { id } });

    return {
      success: true,
      data: null,
      message: "Product deleted successfully",
    };
  }

  /**
   * Aviso advisory pre-borrado: lista recetas/escandallos VIVOS que usan este
   * producto como ingrediente. Ambos comparten la tabla recipe_ingredients.
   * No bloquea el borrado (soft-delete): solo informa para que el usuario sepa
   * que dejará recetas con el ingrediente apuntando a un artículo en papelera.
   * El filtro explícito recipe.deletedAt=null es necesario porque los includes
   * anidados no son filtrados por el middleware de soft-delete.
   */
  async getUsage(id: string, requestTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: requestTenantId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const ingredients = await this.prisma.recipeIngredient.findMany({
      where: {
        productId: id,
        recipe: { deletedAt: null, tenantId: requestTenantId },
      },
      select: { recipe: { select: { id: true, name: true } } },
    });

    const recipes = ingredients
      .map((i) => i.recipe)
      .filter((r): r is { id: string; name: string } => r !== null)
      .map((r) => ({ id: r.id, name: r.name }));

    return { count: recipes.length, recipes };
  }

  /**
   * Fusiona `sourceId` en `targetId`: reasigna todas las referencias del
   * artículo origen (recetas, stock, histórico de precios, líneas de
   * albarán, alias de proveedor, lotes, pedidos, listas de compra...) al
   * artículo destino y da de baja (soft-delete) el origen. Recuperable
   * desde Papelera igual que un remove() normal — nada se borra físicamente
   * salvo filas que quedan sumadas/duplicadas en el destino.
   *
   * Colisiones con restricciones únicas (mismo almacén, misma receta, mismo
   * proveedor+alias, misma lista de compra) se resuelven sumando cantidades
   * en la fila del destino y retirando la del origen — decisión de producto:
   * fusionar no debe perder cantidades ya registradas.
   */
  async merge(sourceId: string, targetId: string, requestTenantId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException(
        "No se puede fusionar un artículo consigo mismo",
      );
    }

    const [source, target] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id: sourceId, tenantId: requestTenantId },
      }),
      this.prisma.product.findFirst({
        where: { id: targetId, tenantId: requestTenantId },
      }),
    ]);

    if (!source) {
      throw new NotFoundException("Artículo origen no encontrado");
    }
    if (!target) {
      throw new NotFoundException("Artículo destino no encontrado");
    }

    const warnings: string[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        // Tablas sin restricción única sobre productId: reasignación directa.
        await tx.purchaseFormat.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });
        await tx.stockMovement.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });
        await tx.albaranLine.updateMany({
          where: { matchedProductId: sourceId },
          data: { matchedProductId: targetId },
        });
        await tx.lot.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });
        await tx.productPriceHistory.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });
        await tx.purchaseOrderLine.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });
        await tx.catalogImportLine.updateMany({
          where: { matchedProductId: sourceId },
          data: { matchedProductId: targetId },
        });
        await tx.inventoryItem.updateMany({
          where: { productId: sourceId },
          data: { productId: targetId },
        });

        // NutritionalInfo (1:1 vía productId único): si el destino ya tiene
        // ficha nutricional, la del origen se queda huérfana junto al
        // artículo dado de baja (no se pierde, solo deja de ser la vigente).
        const [sourceNutrition, targetNutrition] = await Promise.all([
          tx.nutritionalInfo.findUnique({ where: { productId: sourceId } }),
          tx.nutritionalInfo.findUnique({ where: { productId: targetId } }),
        ]);
        if (sourceNutrition && !targetNutrition) {
          await tx.nutritionalInfo.update({
            where: { id: sourceNutrition.id },
            data: { productId: targetId },
          });
        } else if (sourceNutrition && targetNutrition) {
          warnings.push(
            "Ambos artículos tenían ficha nutricional; se mantuvo la del artículo destino.",
          );
        }

        // Stock (único por productId+warehouseId): suma cantidad/reserva en el
        // almacén ya existente en destino; si el destino no tiene stock en ese
        // almacén, reasigna la fila directamente.
        const sourceStocks = await tx.stock.findMany({
          where: { productId: sourceId },
        });
        for (const stock of sourceStocks) {
          const targetStock = await tx.stock.findFirst({
            where: { productId: targetId, warehouseId: stock.warehouseId },
          });
          if (targetStock) {
            await tx.stock.update({
              where: { id: targetStock.id },
              data: {
                quantity: targetStock.quantity + stock.quantity,
                reservedStock: targetStock.reservedStock + stock.reservedStock,
              },
            });
            await tx.stock.delete({ where: { id: stock.id } });
          } else {
            await tx.stock.update({
              where: { id: stock.id },
              data: { productId: targetId },
            });
          }
        }

        // RecipeIngredient (único por recipeId+productId): si la receta ya usa
        // el destino, suma cantidades cuando la unidad coincide; si no
        // coincide, conserva la línea del destino y avisa (no se puede sumar
        // sin conversión de unidad).
        const sourceIngredients = await tx.recipeIngredient.findMany({
          where: { productId: sourceId },
          include: { recipe: { select: { name: true } } },
        });
        for (const ingredient of sourceIngredients) {
          const targetIngredient = await tx.recipeIngredient.findFirst({
            where: { recipeId: ingredient.recipeId, productId: targetId },
          });
          if (targetIngredient) {
            if (targetIngredient.unit === ingredient.unit) {
              await tx.recipeIngredient.update({
                where: { id: targetIngredient.id },
                data: {
                  quantity: targetIngredient.quantity + ingredient.quantity,
                },
              });
            } else {
              warnings.push(
                `La receta "${ingredient.recipe.name}" ya usaba el artículo destino con otra unidad; se mantuvo su cantidad y se descartó la del origen.`,
              );
            }
            await tx.recipeIngredient.delete({ where: { id: ingredient.id } });
          } else {
            await tx.recipeIngredient.update({
              where: { id: ingredient.id },
              data: { productId: targetId },
            });
          }
        }

        // PurchaseListItem (único por listId+productId): suma defaultQuantity.
        const sourceListItems = await tx.purchaseListItem.findMany({
          where: { productId: sourceId },
        });
        for (const item of sourceListItems) {
          const targetItem = await tx.purchaseListItem.findFirst({
            where: { listId: item.listId, productId: targetId },
          });
          if (targetItem) {
            await tx.purchaseListItem.update({
              where: { id: targetItem.id },
              data: {
                defaultQuantity:
                  targetItem.defaultQuantity + item.defaultQuantity,
              },
            });
            await tx.purchaseListItem.delete({ where: { id: item.id } });
          } else {
            await tx.purchaseListItem.update({
              where: { id: item.id },
              data: { productId: targetId },
            });
          }
        }

        // SupplierProductAlias (único por tenantId+supplierId+normalizedDescription):
        // si el destino ya tiene ese mismo alias, retira el del origen (mismo
        // texto, no hay nada que sumar).
        const sourceAliases = await tx.supplierProductAlias.findMany({
          where: { productId: sourceId },
        });
        for (const alias of sourceAliases) {
          const targetAlias = await tx.supplierProductAlias.findFirst({
            where: {
              productId: targetId,
              supplierId: alias.supplierId,
              normalizedDescription: alias.normalizedDescription,
            },
          });
          if (targetAlias) {
            await tx.supplierProductAlias.delete({ where: { id: alias.id } });
          } else {
            await tx.supplierProductAlias.update({
              where: { id: alias.id },
              data: { productId: targetId },
            });
          }
        }

        // ProductSupplierOffer: únicos parciales "1 activa por producto+proveedor"
        // y "1 preferente por producto". Si el destino ya tiene oferta de ese
        // proveedor, retira (soft-delete) la del origen; si no, reasigna pero
        // sin isPreferred (evita chocar con la preferente del destino, si la
        // hay). El precio/proveedor "de verdad" de Product no se toca aquí.
        const [sourceOffers, targetOffers] = await Promise.all([
          tx.productSupplierOffer.findMany({
            where: { productId: sourceId, deletedAt: null },
          }),
          tx.productSupplierOffer.findMany({
            where: { productId: targetId, deletedAt: null },
          }),
        ]);
        const targetSupplierIds = new Set(
          targetOffers.map((o) => o.supplierId),
        );
        const targetHadPreferredOffer = targetOffers.some((o) => o.isPreferred);
        let reassignedOfferCount = 0;
        for (const offer of sourceOffers) {
          if (targetSupplierIds.has(offer.supplierId)) {
            // ProductSupplierOffer tiene soft-delete, pero el interceptor de
            // Prisma que lo implementa (prisma.service.ts) captura el cliente
            // base fuera de la transacción activa — usar `.delete()` aquí
            // confirmaría el cambio antes de tiempo, rompiendo la atomicidad
            // del merge. Se escribe `deletedAt` directamente vía `.update()`
            // para que quede dentro de `tx`.
            await tx.productSupplierOffer.update({
              where: { id: offer.id },
              data: { deletedAt: new Date() },
            });
          } else {
            await tx.productSupplierOffer.update({
              where: { id: offer.id },
              data: { productId: targetId, isPreferred: false },
            });
            reassignedOfferCount++;
          }
        }
        if (
          !targetHadPreferredOffer &&
          targetOffers.length + reassignedOfferCount > 0
        ) {
          warnings.push(
            "El artículo destino quedó sin oferta de proveedor preferente; márcala manualmente en la pestaña Proveedor y Stock.",
          );
        }

        // Dar de baja el artículo origen (soft-delete, recuperable en Papelera).
        await tx.product.update({
          where: { id: sourceId },
          data: { deletedAt: new Date() },
        });
      },
      { timeout: 15000 },
    );

    return {
      success: true,
      data: { mergedInto: targetId, warnings },
      message: `"${source.name}" se fusionó con "${target.name}"`,
    };
  }

  async calculateProductCost(id: string, requestTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: requestTenantId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const refPrice = getReferencePrice(product.purchasePrice, product.unitSize);

    return {
      success: true,
      data: {
        productId: product.id,
        productName: product.name,
        costPerPurchaseUnit: product.purchasePrice,
        referencePrice: refPrice,
        purchaseFormat: product.purchaseFormat,
        referenceUnit: product.referenceUnit,
        unitsPerFormat: product.unitsPerFormat,
        referenceUnitSize: product.referenceUnitSize,
        unitSize: product.unitSize,
        purchasePrice: product.purchasePrice,
        netPrice: product.netPrice,
        wastePercentage: product.wastePercentage,
        yieldFactor: product.yieldFactor,
      },
      message: "Product cost calculated successfully",
    };
  }

  async getCategories(requestTenantId: string) {
    const categories = await this.prisma.product.findMany({
      where: { tenantId: requestTenantId },
      select: { categoryId: true },
      distinct: ["categoryId"],
    });

    return {
      success: true,
      data: categories.map((c) => c.categoryId).filter(Boolean),
      message: "Categories retrieved successfully",
    };
  }

  async getSuppliers(
    requestTenantId: string,
    search?: string,
    isActive?: boolean,
  ) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        tenantId: requestTenantId,
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search?.trim()
          ? { name: { contains: search.trim(), mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: suppliers,
      message: "Suppliers retrieved successfully",
    };
  }

  async createSupplier(
    tenantId: string,
    data: {
      name: string;
      cifNif?: string;
      address?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      whatsapp?: string;
      website?: string;
      sanitaryRegistry?: string;
      iban?: string;
      paymentTerms?: string;
      notes?: string;
      averageDeliveryTime?: number;
      reliabilityScore?: number;
      priceTier?: string;
      preferredStatus?: string;
      orderMethods?: string[];
      isActive?: boolean;
    },
  ) {
    // Avoid duplicates
    const existing = await this.prisma.supplier.findFirst({
      where: { tenantId, name: data.name.trim() },
    });
    if (existing) {
      return {
        success: true,
        data: existing,
        message: "Proveedor ya existente",
      };
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId,
        name: data.name.trim(),
        cifNif: data.cifNif || null,
        address: data.address || null,
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        website: data.website || null,
        sanitaryRegistry: data.sanitaryRegistry || null,
        iban: data.iban || null,
        paymentTerms: data.paymentTerms || null,
        notes: data.notes || null,
        averageDeliveryTime: data.averageDeliveryTime ?? 3,
        reliabilityScore: data.reliabilityScore ?? 85,
        priceTier: data.priceTier || "MEDIUM",
        preferredStatus: data.preferredStatus || "ALTERNATIVE",
        orderMethods: data.orderMethods?.length ? data.orderMethods : ["EMAIL"],
        isActive: data.isActive ?? true,
      },
    });

    return {
      success: true,
      data: supplier,
      message: "Proveedor creado correctamente",
    };
  }

  async getSuppliersStats(tenantId: string) {
    const count = await this.prisma.supplier.count({
      where: { tenantId, isActive: true },
    });

    return { count };
  }

  async getSupplierById(supplierId: string, tenantId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    return {
      success: true,
      data: supplier,
      message: "Proveedor encontrado",
    };
  }

  async updateSupplier(supplierId: string, data: any, tenantId: string) {
    // Verificar que el proveedor existe y pertenece al tenant
    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    const supplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data,
    });

    return {
      success: true,
      data: supplier,
      message: "Proveedor actualizado correctamente",
    };
  }

  async deleteSupplier(supplierId: string, tenantId: string) {
    // Verificar que el proveedor existe y pertenece al tenant
    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    // Verificar que NO tenga productos asociados
    const productCount = await this.prisma.product.count({
      where: { supplierId },
    });

    if (productCount > 0) {
      throw new Error(
        `No se puede eliminar el proveedor porque tiene ${productCount} productos asociados.`,
      );
    }

    await this.prisma.supplier.delete({
      where: { id: supplierId },
    });

    return {
      success: true,
      message: "Proveedor eliminado correctamente",
    };
  }

  async getSupplierProducts(
    supplierId: string,
    tenantId: string,
    page: number,
    limit: number,
  ) {
    // Verificar que el proveedor existe y pertenece al tenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { supplierId, tenantId, isActive: true },
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: true,
          stocks: { take: 1 },
        },
      }),
      this.prisma.product.count({
        where: { supplierId, tenantId, isActive: true },
      }),
    ]);

    return {
      success: true,
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSupplierPriceTrend(supplierId: string, tenantId: string) {
    // Verificar que el proveedor existe y pertenece al tenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    // Obtener productos del proveedor
    const products = await this.prisma.product.findMany({
      where: { supplierId, tenantId },
      select: { purchasePrice: true },
    });

    if (products.length === 0) {
      return {
        status: "stable",
        percentage: 0,
        lastPrice: 0,
        currentPrice: 0,
      };
    }

    // Calcular precio promedio actual
    const currentAvg =
      products.reduce((sum, p) => sum + p.purchasePrice, 0) / products.length;

    // Obtener último registro de histórico
    const lastHistory = await this.prisma.supplierPriceHistory.findFirst({
      where: { supplierId },
      orderBy: { recordDate: "desc" },
    });

    if (!lastHistory) {
      // Crear primer registro histórico
      await this.prisma.supplierPriceHistory.create({
        data: { tenantId, supplierId, averagePrice: currentAvg },
      });

      return {
        status: "stable",
        percentage: 0,
        lastPrice: currentAvg,
        currentPrice: currentAvg,
      };
    }

    // Calcular diferencia
    const diff =
      ((currentAvg - lastHistory.averagePrice) / lastHistory.averagePrice) *
      100;

    // Crear nuevo registro histórico si es significativo (cada 24h o > 5% cambio)
    const shouldRecord =
      Date.now() - lastHistory.recordDate.getTime() > 86400000 ||
      Math.abs(diff) > 5;

    if (shouldRecord) {
      await this.prisma.supplierPriceHistory.create({
        data: { tenantId, supplierId, averagePrice: currentAvg },
      });
    }

    return {
      status: diff > 0 ? "increased" : diff < 0 ? "decreased" : "stable",
      percentage: Math.abs(diff),
      lastPrice: lastHistory.averagePrice,
      currentPrice: currentAvg,
    };
  }

  async getSupplierPriceHistory(
    supplierId: string,
    tenantId: string,
    limit: number = 30,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    const history = await this.prisma.supplierPriceHistory.findMany({
      where: { supplierId, tenantId },
      orderBy: { recordDate: "desc" },
      take: limit,
    });

    return history.map((h) => ({
      id: h.id,
      averagePrice: h.averagePrice,
      recordDate: h.recordDate,
    }));
  }

  async getStockAlertsCount(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      include: { stocks: { take: 1 } },
    });

    let low = 0,
      empty = 0;

    products.forEach((p) => {
      const qty = p.stocks[0]?.quantity ?? 0;
      const min = p.stocks[0]?.minimumStock ?? 0;

      if (qty <= 0) {
        empty++;
      } else if (qty <= min) {
        low++;
      }
    });

    return {
      total: products.length,
      low,
      empty,
    };
  }

  async getCategoryProductCount(categoryId: string, tenantId: string) {
    // Obtener categoría y verificar pertenece al tenant
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Categoría no encontrada`);
    }

    // Obtener todos los descendientes recursivamente
    const allCategoryIds = await this.getAllCategoryDescendants(
      categoryId,
      tenantId,
    );

    // Contar productos en la categoría y sus descendientes
    const count = await this.prisma.product.count({
      where: {
        categoryId: { in: allCategoryIds },
        tenantId,
        isActive: true,
      },
    });

    return { count };
  }

  async reorderCategories(
    updates: Array<{ id: string; sortOrder: number; parentId?: string }>,
    tenantId: string,
  ) {
    // Verificar que todas las categorías pertenecen al tenant
    const categoryIds = updates.map((u) => u.id);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, tenantId },
    });

    if (categories.length !== categoryIds.length) {
      throw new Error(
        `Algunas categorías no existen o no pertenecen al tenant`,
      );
    }

    // Validar que no se crean ciclos en jerarquía
    for (const update of updates) {
      if (update.parentId) {
        const hasCycle = await this.checkCategoryCycle(
          update.id,
          update.parentId,
          tenantId,
        );
        if (hasCycle) {
          throw new Error(`Se crearía un ciclo en la jerarquía de categorías`);
        }
      }
    }

    // Actualizar en transaction
    const results = await Promise.all(
      updates.map((update) =>
        this.prisma.category.update({
          where: { id: update.id },
          data: {
            sortOrder: update.sortOrder,
            parentId: update.parentId || null,
          },
        }),
      ),
    );

    return {
      success: true,
      data: results,
      message: "Categorías reordenadas correctamente",
    };
  }

  async toggleCategoryActive(categoryId: string, tenantId: string) {
    // Obtener categoría
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Categoría no encontrada`);
    }

    // Toggle isActive
    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: { isActive: !category.isActive },
    });

    return {
      success: true,
      data: updated,
      message: `Categoría ${updated.isActive ? "activada" : "desactivada"}`,
    };
  }

  // Helper: obtener todos los descendientes de una categoría recursivamente
  private async getAllCategoryDescendants(
    categoryId: string,
    tenantId: string,
    descendants: string[] = [],
  ): Promise<string[]> {
    descendants.push(categoryId);

    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId, tenantId },
      select: { id: true },
    });

    for (const child of children) {
      await this.getAllCategoryDescendants(child.id, tenantId, descendants);
    }

    return descendants;
  }

  // Helper: detectar ciclos en jerarquía de categorías (DFS)
  private async checkCategoryCycle(
    categoryId: string,
    newParentId: string,
    tenantId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> {
    if (categoryId === newParentId) {
      return true;
    } // Ciclo directo
    if (visited.has(newParentId)) {
      return false;
    } // Ya visitado, no ciclo

    visited.add(newParentId);

    const parent = await this.prisma.category.findFirst({
      where: { id: newParentId, tenantId },
      select: { parentId: true },
    });

    if (!parent || !parent.parentId) {
      return false;
    } // No más ancestros

    return this.checkCategoryCycle(
      categoryId,
      parent.parentId,
      tenantId,
      visited,
    );
  }

  private calculateNetPrice(
    purchasePrice: number,
    wastePercentage: number,
    profitMargin: number,
  ): number {
    const priceAfterWaste =
      purchasePrice - (purchasePrice * wastePercentage) / 100;
    const netPrice = priceAfterWaste * (1 + profitMargin / 100);
    return Math.round(netPrice * 100) / 100;
  }

  private calculateYieldFactor(wastePercentage: number): number {
    return (100 - wastePercentage) / 100;
  }

  async getSupplierProductCount(supplierId: string, tenantId: string) {
    // Verificar que el proveedor existe y pertenece al tenant
    const existing = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Proveedor no encontrado`);
    }

    // Contar productos activos del proveedor
    const productCount = await this.prisma.product.count({
      where: { supplierId, tenantId },
    });

    return {
      count: productCount,
      supplierName: existing.name,
    };
  }

  async reassignSupplierProducts(
    supplierId: string,
    targetSupplierId: string,
    tenantId: string,
  ) {
    // Verificar que ambos proveedores existen y pertenecen al tenant
    const [existingSource, existingTarget] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: supplierId, tenantId },
      }),
      this.prisma.supplier.findFirst({
        where: { id: targetSupplierId, tenantId },
      }),
    ]);

    if (!existingSource) {
      throw new NotFoundException(`Proveedor origen no encontrado`);
    }

    if (!existingTarget) {
      throw new NotFoundException(`Proveedor destino no encontrado`);
    }

    if (supplierId === targetSupplierId) {
      throw new BadRequestException(
        "No se puede reasignar productos al mismo proveedor",
      );
    }

    // Reasignar todos los productos
    const result = await this.prisma.product.updateMany({
      where: { supplierId, tenantId },
      data: { supplierId: targetSupplierId },
    });

    return {
      success: true,
      message: `${result.count} producto${result.count > 1 ? "s" : ""} reasignados de "${existingSource.name}" a "${existingTarget.name}"`,
      reassignedCount: result.count,
    };
  }

  // ─── UnitOfMeasure CRUD ─────────────────────────────────────────

  async getUnits(tenantId: string) {
    return this.prisma.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async createUnit(dto: { name: string; symbol: string }, tenantId: string) {
    const existing = await this.prisma.unitOfMeasure.findFirst({
      where: { tenantId, symbol: dto.symbol },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe una unidad con símbolo "${dto.symbol}"`,
      );
    }
    return this.prisma.unitOfMeasure.create({
      data: { tenantId, name: dto.name, symbol: dto.symbol },
    });
  }

  async updateUnit(
    id: string,
    dto: { name?: string; symbol?: string; isActive?: boolean },
    tenantId: string,
  ) {
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { id, tenantId },
    });
    if (!unit) {
      throw new NotFoundException("Unidad no encontrada");
    }
    if (dto.symbol && dto.symbol !== unit.symbol) {
      const duplicate = await this.prisma.unitOfMeasure.findFirst({
        where: { tenantId, symbol: dto.symbol, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Ya existe una unidad con símbolo "${dto.symbol}"`,
        );
      }
    }
    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: dto,
    });
  }

  async deleteUnit(id: string, tenantId: string) {
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { id, tenantId },
    });
    if (!unit) {
      throw new NotFoundException("Unidad no encontrada");
    }
    // Soft-delete: marcar como inactiva en vez de eliminar
    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Validate that a symbol is a valid unit for the tenant */
  async isValidUnit(symbol: string, tenantId: string): Promise<boolean> {
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { tenantId, symbol, isActive: true },
    });
    return !!unit;
  }

  // ─── Product Price History ──────────────────────────────────────

  async getProductPriceHistory(
    productId: string,
    tenantId: string,
    supplierId?: string,
  ) {
    const where: any = { productId, tenantId };
    if (supplierId) {
      where.supplierId = supplierId;
    }
    return this.prisma.productPriceHistory.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: 50,
      include: {
        supplier: { select: { id: true, name: true } },
        albaran: {
          select: { id: true, internalNumber: true, albaranNumber: true },
        },
      },
    });
  }

  async createBulk(productsData: any[], requestTenantId: string) {
    const existingCategories = await this.prisma.category.findMany({
      where: { tenantId: requestTenantId },
    });
    const existingSuppliers = await this.prisma.supplier.findMany({
      where: { tenantId: requestTenantId },
    });

    const categoryMap = new Map(
      existingCategories.map((c) => [c.name.toLowerCase().trim(), c.id]),
    );
    const supplierMap = new Map(
      existingSuppliers.map((s) => [s.name.toLowerCase().trim(), s.id]),
    );

    const createdProducts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of productsData) {
        let categoryId = null;
        let supplierId = null;

        // Resolver categoría
        if (item.categoryName && item.categoryName.trim()) {
          const catNameLower = item.categoryName.toLowerCase().trim();
          if (categoryMap.has(catNameLower)) {
            categoryId = categoryMap.get(catNameLower);
          } else {
            const newCat = await tx.category.create({
              data: {
                tenantId: requestTenantId,
                name: item.categoryName.trim(),
                slug: item.categoryName
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]/g, "-"),
                context: "articles",
              },
            });
            categoryId = newCat.id;
            categoryMap.set(catNameLower, newCat.id);
          }
        } else if (item.categoryId) {
          categoryId = item.categoryId;
        }

        // Resolver proveedor
        if (item.supplierName && item.supplierName.trim()) {
          const supNameLower = item.supplierName.toLowerCase().trim();
          if (supplierMap.has(supNameLower)) {
            supplierId = supplierMap.get(supNameLower);
          } else {
            const newSup = await tx.supplier.create({
              data: {
                tenantId: requestTenantId,
                name: item.supplierName.trim(),
              },
            });
            supplierId = newSup.id;
            supplierMap.set(supNameLower, newSup.id);
          }
        } else if (item.supplierId) {
          supplierId = item.supplierId;
        }

        // Preparar datos del artículo
        const {
          name,
          description = "",
          purchaseFormat = "",
          referenceUnit = "kilo",
          unitsPerFormat = 1,
          referenceUnitSize = 1,
          purchasePrice = 0,
          wastePercentage = 0,
          profitMargin = 0,
          iva = 10,
          barcode = "",
          brand = "",
          minimumStock,
          maximumStock,
        } = item;

        if (!name || !name.trim()) {
          throw new BadRequestException(
            "El nombre del producto es obligatorio en la importación masiva",
          );
        }

        const calculatedUnitSize =
          Number(unitsPerFormat) * Number(referenceUnitSize);
        const effectivePrice = Number(purchasePrice);
        const effWastePercentage = Number(wastePercentage);
        const effProfitMargin = Number(profitMargin);

        const netPrice = this.calculateNetPrice(
          effectivePrice,
          effWastePercentage,
          effProfitMargin,
        );

        const yieldFactor =
          effWastePercentage > 0
            ? this.calculateYieldFactor(effWastePercentage)
            : 1.0;

        const product = await tx.product.create({
          data: {
            tenantId: requestTenantId,
            name: name.trim(),
            description,
            purchaseFormat,
            referenceUnit,
            unitsPerFormat: Number(unitsPerFormat),
            referenceUnitSize: Number(referenceUnitSize),
            unitSize: calculatedUnitSize,
            purchasePrice: effectivePrice,
            netPrice,
            profitMargin: effProfitMargin,
            wastePercentage: effWastePercentage,
            yieldFactor,
            iva: Number(iva),
            barcode,
            brand,
            categoryId,
            supplierId,
          },
        });

        // Crear stock si corresponde
        if (minimumStock !== undefined || maximumStock !== undefined) {
          await tx.stock.create({
            data: {
              tenantId: requestTenantId,
              productId: product.id,
              minimumStock:
                minimumStock !== undefined ? Number(minimumStock) : 0,
              maximumStock:
                maximumStock !== undefined ? Number(maximumStock) : null,
              quantity: 0,
            },
          });
        }

        createdProducts.push(product);
      }
    });

    return {
      success: true,
      count: createdProducts.length,
      message: `${createdProducts.length} productos importados correctamente`,
    };
  }
}
