import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import { getReferencePrice } from "../../common/utils/unit-conversions";
import {
  CreateProductDto,
  UpdateProductDto,
  ProductsQueryDto,
} from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, requestTenantId: string) {
    const {
      purchasePrice,
      wastePercentage = 0,
      profitMargin = 0,
      yieldFactor = 1.0,
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
    const finalYieldFactor =
      wastePercentage > 0
        ? this.calculateYieldFactor(wastePercentage)
        : yieldFactor;

    const createData: any = {
      tenantId: requestTenantId,
      purchasePrice: effectivePrice,
      netPrice,
      profitMargin,
      wastePercentage,
      yieldFactor: finalYieldFactor,
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

  async findAll(query: ProductsQueryDto, requestTenantId: string) {
    const {
      search,
      category,
      supplier,
      isActive,
      sortBy = "name",
      sortOrder = "asc",
      page = 1,
      limit = 20,
      stockStatus,
    } = query;

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId: requestTenantId };

    if (search) {
      (where as any).OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
        { barcode: { contains: search, mode: "insensitive" as const } },
        { brand: { contains: search, mode: "insensitive" as const } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }
    if (supplier) {
      where.supplierId = supplier;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (stockStatus) {
      where.stocks = {
        some: stockStatus === "empty"
          ? { quantity: { lte: 0 } }
          : {
              OR: [
                { quantity: { lte: 0 } },
                {
                  AND: [
                    { quantity: { gt: 0 } },
                    { quantity: { lte: this.prisma.$queryRaw`"minimumStock"` } }
                  ]
                }
              ]
          }
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
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
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Mapear lastPurchaseDate desde la línea de albarán más reciente
    const productsWithLastPurchase = products.map((p) => {
      const { albaranLines, ...rest } = p as any;
      const lastPurchaseDate = albaranLines?.[0]?.albaran?.date ?? null;
      return { ...rest, lastPurchaseDate };
    });

    return {
      success: true,
      data: productsWithLastPurchase,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return {
      success: true,
      data: product,
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
    if (data.unitsPerFormat !== undefined || data.referenceUnitSize !== undefined) {
      const upf = data.unitsPerFormat ?? existingProduct.unitsPerFormat ?? 1;
      const rus = data.referenceUnitSize ?? existingProduct.referenceUnitSize ?? existingProduct.unitSize ?? 1;
      data.unitsPerFormat = upf;
      data.referenceUnitSize = rus;
      data.unitSize = upf * rus;
    }
    // Remove unitSize from updateData if sent directly (it's auto-calculated)
    delete data.unitSize;

    // Recalcular precios si se modifican
    if (
      updateData.purchasePrice !== undefined ||
      updateData.wastePercentage !== undefined ||
      updateData.profitMargin !== undefined
    ) {
      // Save previous price before updating
      if (updateData.purchasePrice !== undefined && updateData.purchasePrice !== existingProduct.purchasePrice) {
        data.previousPurchasePrice = existingProduct.purchasePrice;
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

    // Upsert nutritional info
    if (nutritionalInfo) {
      data.nutritionalInfo = {
        upsert: {
          create: nutritionalInfo,
          update: nutritionalInfo,
        },
      };
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        purchaseFormats: true,
        nutritionalInfo: true,
        category: { include: { parent: true } },
        supplier: true,
        stocks: true,
      },
    });

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

    return {
      success: true,
      data: product,
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

  async getSuppliers(requestTenantId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId: requestTenantId, isActive: true },
      select: { id: true, name: true },
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
      contactPerson?: string;
      email?: string;
      phone?: string;
      whatsapp?: string;
      website?: string;
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
        contactPerson: data.contactPerson || null,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        website: data.website || null,
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
        `No se puede eliminar el proveedor porque tiene ${productCount} productos asociados.`
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
    const currentAvg = products.reduce((sum, p) => sum + p.purchasePrice, 0) / products.length;

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
    const diff = ((currentAvg - lastHistory.averagePrice) / lastHistory.averagePrice) * 100;

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
    const allCategoryIds = await this.getAllCategoryDescendants(categoryId, tenantId);

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
      throw new Error(`Algunas categorías no existen o no pertenecen al tenant`);
    }

    // Validar que no se crean ciclos en jerarquía
    for (const update of updates) {
      if (update.parentId) {
        const hasCycle = await this.checkCategoryCycle(update.id, update.parentId, tenantId);
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
        })
      )
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
      message: `Categoría ${updated.isActive ? 'activada' : 'desactivada'}`,
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
    if (categoryId === newParentId) return true; // Ciclo directo
    if (visited.has(newParentId)) return false; // Ya visitado, no ciclo

    visited.add(newParentId);

    const parent = await this.prisma.category.findFirst({
      where: { id: newParentId, tenantId },
      select: { parentId: true },
    });

    if (!parent || !parent.parentId) return false; // No más ancestros

    return this.checkCategoryCycle(categoryId, parent.parentId, tenantId, visited);
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

  async reassignSupplierProducts(supplierId: string, targetSupplierId: string, tenantId: string) {
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
      throw new BadRequestException('No se puede reasignar productos al mismo proveedor');
    }

    // Reasignar todos los productos
    const result = await this.prisma.product.updateMany({
      where: { supplierId, tenantId },
      data: { supplierId: targetSupplierId },
    });

    return {
      success: true,
      message: `${result.count} producto${result.count > 1 ? 's' : ''} reasignados de "${existingSource.name}" a "${existingTarget.name}"`,
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
      throw new BadRequestException(`Ya existe una unidad con símbolo "${dto.symbol}"`);
    }
    return this.prisma.unitOfMeasure.create({
      data: { tenantId, name: dto.name, symbol: dto.symbol },
    });
  }

  async updateUnit(id: string, dto: { name?: string; symbol?: string; isActive?: boolean }, tenantId: string) {
    const unit = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!unit) {
      throw new NotFoundException("Unidad no encontrada");
    }
    if (dto.symbol && dto.symbol !== unit.symbol) {
      const duplicate = await this.prisma.unitOfMeasure.findFirst({
        where: { tenantId, symbol: dto.symbol, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException(`Ya existe una unidad con símbolo "${dto.symbol}"`);
      }
    }
    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: dto,
    });
  }

  async deleteUnit(id: string, tenantId: string) {
    const unit = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
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

  async getProductPriceHistory(productId: string, tenantId: string, supplierId?: string) {
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
        albaran: { select: { id: true, internalNumber: true, albaranNumber: true } },
      },
    });
  }
}
