import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateProductDto, UpdateProductDto, ProductsQueryDto } from './dto/create-product.dto';

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
      ...productData
    } = createProductDto;

    // Calcular precio neto si no se proporciona
    const netPrice = this.calculateNetPrice(purchasePrice, wastePercentage, profitMargin);

    // Validar yield factor si wastePercentage > 0
    const finalYieldFactor = wastePercentage > 0 ? this.calculateYieldFactor(wastePercentage) : yieldFactor;

    const product = await this.prisma.product.create({
      data: {
        tenantId: requestTenantId,
        ...productData,
        purchasePrice,
        netPrice,
        profitMargin,
        wastePercentage,
        yieldFactor: finalYieldFactor,
        allergens,
      },
    });

    return {
      success: true,
      data: product,
      message: 'Product created successfully',
    };
  }

  async findAll(query: ProductsQueryDto, requestTenantId: string) {
    const {
      search,
      category,
      supplier,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = { tenantId: requestTenantId };

    // Filtros
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (supplier) {
      where.supplier = supplier;
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
        select: {
          id: true,
          name: true,
          category: true,
          supplier: true,
          purchaseUnit: true,
          purchasePrice: true,
          netPrice: true,
          isActive: true,
          allergens: true,
        },
      }),
      this.prisma.product.count({ where }),
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
      message: 'Products retrieved successfully',
    };
  }

  async findOne(id: string, requestTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      success: true,
      data: product,
      message: 'Product retrieved successfully',
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto, requestTenantId: string) {
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    const updateData: any = { ...updateProductDto };

    // Recalcular precios si se modifican
    if (updateProductDto.purchasePrice !== undefined ||
        updateProductDto.wastePercentage !== undefined ||
        updateProductDto.profitMargin !== undefined) {

      const purchasePrice = updateProductDto.purchasePrice ?? existingProduct.purchasePrice;
      const wastePercentage = updateProductDto.wastePercentage ?? existingProduct.wastePercentage;
      const profitMargin = updateProductDto.profitMargin ?? existingProduct.profitMargin;

      updateData.netPrice = this.calculateNetPrice(purchasePrice, wastePercentage, profitMargin);

      if (wastePercentage !== undefined) {
        updateData.yieldFactor = wastePercentage > 0
          ? this.calculateYieldFactor(wastePercentage)
          : 1.0;
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      data: product,
      message: 'Product updated successfully',
    };
  }

  async remove(id: string, requestTenantId: string) {
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return {
      success: true,
      data: null,
      message: 'Product deleted successfully',
    };
  }

  async calculateProductCost(id: string, requestTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: requestTenantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Sistema multi-unidad: factores de conversión
    // Estos factores se pueden configurar por producto en el futuro
    const ucToUaFactor = this.getUcToUaFactor(product.purchaseUnit, product.storageUnit);
    const uaToUrFactor = this.getUaToUrFactor(product.storageUnit, product.recipeUnit);
    const ucToUrFactor = ucToUaFactor * uaToUrFactor;

    // Cálculo de costeo por unidad
    const costPerPurchaseUnit = product.purchasePrice;
    const costPerStorageUnit = costPerPurchaseUnit / ucToUaFactor;
    const costPerRecipeUnit = costPerStorageUnit / uaToUrFactor;

    return {
      success: true,
      data: {
        productId: product.id,
        productName: product.name,

        // Costeo por unidad
        costPerPurchaseUnit,
        costPerStorageUnit,
        costPerRecipeUnit,

        // Factores de conversión
        ucToUaFactor,
        uaToUrFactor,
        ucToUrFactor,

        // Información de precio
        purchasePrice: product.purchasePrice,
        netPrice: product.netPrice,
        wastePercentage: product.wastePercentage,
        yieldFactor: product.yieldFactor,
      },
      message: 'Product cost calculated successfully',
    };
  }

  // Helper methods para cálculos

  private calculateNetPrice(purchasePrice: number, wastePercentage: number, profitMargin: number): number {
    // Precio neto = Precio bruto - (Precio bruto * wastePercentage / 100)
    // Luego se aplica margen de beneficio
    const priceAfterWaste = purchasePrice - (purchasePrice * wastePercentage / 100);
    const netPrice = priceAfterWaste * (1 + profitMargin / 100);

    return Math.round(netPrice * 100) / 100; // Redondear a 2 decimales
  }

  private calculateYieldFactor(wastePercentage: number): number {
    // Factor de rendimiento = (100 - wastePercentage) / 100
    return (100 - wastePercentage) / 100;
  }

  private getUcToUaFactor(purchaseUnit: string, storageUnit: string): number {
    // Sistema de conversión UC → UA
    // En producción esto sería configurable por producto
    const conversionMap: { [key: string]: { [key: string]: number } } = {
      'Caja 10kg': { 'Kilogramos': 10, 'Gramos': 10000 },
      'Bote 300uds': { 'Unidades': 300 },
      'Saco 25kg': { 'Kilogramos': 25, 'Gramos': 25000 },
      'Litro': { 'Litros': 1, 'Mililitros': 1000 },
      'Kilogramo': { 'Kilogramos': 1, 'Gramos': 1000 },
    };

    return conversionMap[purchaseUnit]?.[storageUnit] || 1;
  }

  private getUaToUrFactor(storageUnit: string, recipeUnit: string): number {
    // Sistema de conversión UA → UR
    const conversionMap: { [key: string]: { [key: string]: number } } = {
      'Kilogramos': { 'Gramos': 1000, 'Miligramos': 1000000 },
      'Litros': { 'Mililitros': 1000 },
      'Unidades': { 'Unidades': 1 },
      'Gramos': { 'Miligramos': 1000 },
    };

    return conversionMap[storageUnit]?.[recipeUnit] || 1;
  }

  async getCategories(requestTenantId: string) {
    const categories = await this.prisma.product.findMany({
      where: { tenantId: requestTenantId },
      select: { category: true },
      distinct: ['category'],
    });

    return {
      success: true,
      data: categories.map(c => c.category).filter(Boolean),
      message: 'Categories retrieved successfully',
    };
  }

  async getSuppliers(requestTenantId: string) {
    const suppliers = await this.prisma.product.findMany({
      where: { tenantId: requestTenantId },
      select: { supplier: true },
      where: { supplier: { not: null } },
      distinct: ['supplier'],
    });

    return {
      success: true,
      data: suppliers.map(s => s.supplier).filter(Boolean),
      message: 'Suppliers retrieved successfully',
    };
  }
}