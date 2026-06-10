import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
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
      purchaseFormats,
      nutritionalInfo,
      minimumStock,
      maximumStock,
      ...productData
    } = createProductDto;

    const netPrice = this.calculateNetPrice(
      purchasePrice,
      wastePercentage,
      profitMargin,
    );
    const finalYieldFactor =
      wastePercentage > 0
        ? this.calculateYieldFactor(wastePercentage)
        : yieldFactor;

    const createData: any = {
      tenantId: requestTenantId,
      purchasePrice,
      netPrice,
      profitMargin,
      wastePercentage,
      yieldFactor: finalYieldFactor,
      allergens,
      ...productData,
    };

    if (category) {
      createData.categoryId = category;
    }
    if (supplier) {
      createData.supplierId = supplier;
    }

    // Nested create: formatos de compra
    if (purchaseFormats && purchaseFormats.length > 0) {
      createData.purchaseFormats = {
        create: purchaseFormats.map((pf) => ({
          name: pf.name,
          format: pf.format,
          price: pf.price,
        })),
      };
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
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
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
      purchaseFormats,
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

    // Recalcular precios si se modifican
    if (
      updateData.purchasePrice !== undefined ||
      updateData.wastePercentage !== undefined ||
      updateData.profitMargin !== undefined
    ) {
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

    // Replace all purchase formats
    if (purchaseFormats) {
      data.purchaseFormats = {
        deleteMany: {},
        create: purchaseFormats.map((pf: any) => ({
          name: pf.name,
          format: pf.format,
          price: pf.price,
        })),
      };
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

    const ucToUaFactor = this.getUcToUaFactor(
      product.purchaseUnit,
      product.storageUnit,
    );
    const uaToUrFactor = this.getUaToUrFactor(
      product.storageUnit,
      product.recipeUnit,
    );
    const ucToUrFactor = ucToUaFactor * uaToUrFactor;

    const costPerPurchaseUnit = product.purchasePrice;
    const costPerStorageUnit = costPerPurchaseUnit / ucToUaFactor;
    const costPerRecipeUnit = costPerStorageUnit / uaToUrFactor;

    return {
      success: true,
      data: {
        productId: product.id,
        productName: product.name,
        costPerPurchaseUnit,
        costPerStorageUnit,
        costPerRecipeUnit,
        ucToUaFactor,
        uaToUrFactor,
        ucToUrFactor,
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
      Kilogramos: { Gramos: 1000, Miligramos: 1000000 },
      Litros: { Mililitros: 1000 },
      Unidades: { Unidades: 1 },
      Gramos: { Miligramos: 1000 },
    };
    return conversionMap[storageUnit]?.[recipeUnit] || 1;
  }
}
