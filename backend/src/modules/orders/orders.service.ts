import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  OrderRequirementDto,
  AutomatedOrderDto,
  OrderItemDto,
  SupplierClassificationDto,
  PurchaseOrderTemplateDto,
  SafetyFactorConfigDto,
  OrderStatus,
  Urgency,
  PriceTier,
  PreferredStatus,
  TemplateFormat,
  CreateOrderRequirementDto,
  CreateAutomatedOrderDto,
  UpdateOrderItemDto,
  ApproveOrderDto,
  SendOrderDto,
  ExportOrderDto,
  CreateOrderItemDto,
  CalculationOptionsDto,
} from "./dto/orders.dto";
import { WebSocketService } from "../../websocket/websocket.service";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private readonly webSocketService: WebSocketService,
  ) {}

  // Safety factors configuration
  private safetyFactors: SafetyFactorConfigDto[] = [
    {
      productCategory: "PERISHABLE",
      conservationZone: "FROZEN",
      supplierReliability: 0.9,
      baseFactor: 1.2,
      maxFactor: 1.5,
    },
    {
      productCategory: "PERISHABLE",
      conservationZone: "REFRIGERATED",
      supplierReliability: 0.9,
      baseFactor: 1.3,
      maxFactor: 1.6,
    },
    {
      productCategory: "DRY_GOODS",
      conservationZone: "DRY_GOODS",
      supplierReliability: 0.8,
      baseFactor: 1.1,
      maxFactor: 1.3,
    },
    {
      productCategory: "NON_PERISHABLE",
      conservationZone: "AMBIENT",
      supplierReliability: 0.9,
      baseFactor: 1.05,
      maxFactor: 1.1,
    },
  ];

  // Order rules for optimization
  private orderRules = [
    {
      id: "rule-001",
      name: "Orden mínima por proveedor",
      description: "Agrupar pedidos pequeños por proveedor",
      priority: 1,
      condition: (req: OrderRequirementDto) => req.suggestedQuantity < 50,
      action: (req: OrderRequirementDto) => ({
        ...req,
        suggestedQuantity: 50,
        notes: "Agrupado con otros productos del mismo proveedor",
      }),
    },
    {
      id: "rule-002",
      name: "Descuento por volumen",
      description: "Aplicar descuentos por volumen grande",
      priority: 2,
      condition: (req: OrderRequirementDto) => req.suggestedQuantity >= 100,
      action: (req: OrderRequirementDto) => ({
        ...req,
        estimatedCost: req.estimatedCost * 0.9,
        notes: "Descuento por volumen aplicado",
      }),
    },
    {
      id: "rule-003",
      name: "Pedido consolidado",
      description: "Consolidar pedidos de zonas cercanas",
      priority: 3,
      condition: (req: OrderRequirementDto) =>
        req.conservationZone === "REFRIGERATED" && req.suggestedQuantity < 30,
      action: (req: OrderRequirementDto) => ({
        ...req,
        suggestedQuantity: 30,
        notes: "Consolidado con otros productos de refrigeración",
      }),
    },
    {
      id: "rule-004",
      name: "Urgencia de entrega",
      description: "Priorizar productos urgentes",
      priority: 0,
      condition: (req: OrderRequirementDto) => req.urgency === Urgency.CRITICAL,
      action: (req: OrderRequirementDto) => ({
        ...req,
        notes: "Entrega prioritaria solicitada",
      }),
    },
  ];

  async calculateOrderRequirements(
    dto: CreateOrderRequirementDto,
  ): Promise<OrderRequirementDto[]> {
    const { tenantId, historicalPeriod = 7, lookaheadDays = 7 } = dto;
    const requirements: OrderRequirementDto[] = [];

    // OPTIMIZED: Batch fetch all products with their stocks in a single query
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: {
        stocks: {
          where: {
            quantity: { gt: 0 },
          },
          take: 1,
        },
      },
    });

    // OPTIMIZED: Batch calculate requirements for all products
    for (const product of products) {
      const requirement = await this.calculateProductRequirement(
        product,
        tenantId,
        historicalPeriod,
        lookaheadDays,
        product.stocks || [],
      );

      if (requirement.requiredQuantity > 0) {
        requirements.push(requirement);
      }
    }

    return this.optimizeOrderQuantities(requirements);
  }

  private async calculateProductRequirement(
    product: any,
    tenantId: string,
    historicalPeriod: number,
    lookaheadDays: number,
    stocks: any[],
  ): Promise<OrderRequirementDto> {
    const productId = product.id;

    const currentStock =
      stocks?.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0) || 0;
    const minStock = product.minimumStock || 0;
    const avgDailyConsumption = await this.calculateAverageConsumption(
      productId,
      historicalPeriod,
    );
    const projectedConsumption = avgDailyConsumption * lookaheadDays;

    const baseRequirement = Math.max(0, minStock - currentStock);
    const projectedRequirement = baseRequirement + projectedConsumption;
    const safetyFactor = this.getSafetyFactor(product);
    const adjustedRequirement = projectedRequirement * safetyFactor;

    const packageSize = product.packageSize || 1;
    const suggestedQuantity =
      Math.ceil(adjustedRequirement / packageSize) * packageSize;

    const urgency = this.calculateUrgency(
      currentStock,
      minStock,
      projectedConsumption,
    );

    const supplier = await (this.prisma as any).supplier?.findUnique({
      where: { id: product.primarySupplierId || "" },
    });

    return {
      id: `req-${productId}-${Date.now()}`,
      productId,
      productName: product.name,
      currentStock,
      minimumStock: minStock,
      projectedConsumption,
      requiredQuantity: adjustedRequirement,
      suggestedQuantity,
      urgency,
      supplierId: product.primarySupplierId || "none",
      supplierName: supplier?.name || "Sin proveedor asignado",
      conservationZone: product.conservationZone || "AMBIENT",
      category: product.category || "GENERAL",
      unit: product.unit || "units",
      estimatedCost: (product.costPerUnit || 0) * suggestedQuantity,
      lastOrderDate: product.lastOrderDate,
      averageDailyConsumption: avgDailyConsumption,
    };
  }

  private async calculateAverageConsumption(
    productId: string,
    period: number,
  ): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // OPTIMIZED: Include ingredients in single query and calculate consumption inline
    const recipes = await this.prisma.recipe.findMany({
      where: {
        ingredients: {
          some: {
            productId,
          },
        } as any,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        ingredients: {
          where: {
            productId,
          },
        },
      },
    });

    const totalConsumption = recipes.reduce((sum: number, recipe: any) => {
      const recipeConsumption = recipe.ingredients?.reduce(
        (ingredSum: number, ingredient: any) =>
          ingredSum + (ingredient?.quantity || 0),
        0,
      );
      return sum + recipeConsumption;
    }, 0);

    return totalConsumption / period;
  }

  private getSafetyFactor(product: any): number {
    const config = this.safetyFactors.find(
      (f) =>
        f.productCategory === product.category &&
        f.conservationZone === product.conservationZone,
    );

    if (!config) {
      return 1.1;
    }

    const reliabilityAdjustment = (1 - config.supplierReliability) * 0.3;
    return Math.min(
      config.maxFactor,
      config.baseFactor + reliabilityAdjustment,
    );
  }

  private calculateUrgency(
    stock: number,
    minStock: number,
    projectedConsumption: number,
  ): Urgency {
    const stockRatio = stock / minStock;

    if (stock <= 0 || stockRatio < 0.25) {
      return Urgency.CRITICAL;
    } else if (stockRatio < 0.5 || projectedConsumption > stock) {
      return Urgency.HIGH;
    } else if (stockRatio < 0.75) {
      return Urgency.MEDIUM;
    } else {
      return Urgency.LOW;
    }
  }

  private optimizeOrderQuantities(
    requirements: OrderRequirementDto[],
  ): OrderRequirementDto[] {
    const optimized = requirements.map((req) => {
      const optimizedReq = { ...req };

      for (const rule of this.orderRules) {
        if (rule.condition(req)) {
          const result = rule.action(req);
          Object.assign(optimizedReq, result);
        }
      }

      return optimizedReq;
    });

    const filtered = optimized.filter((req) => req.suggestedQuantity >= 1);

    return filtered.sort((a, b) => {
      const ratioA = a.projectedConsumption / a.estimatedCost;
      const ratioB = b.projectedConsumption / b.estimatedCost;
      return ratioB - ratioA;
    });
  }

  async classifyBySupplier(
    requirements: OrderRequirementDto[],
  ): Promise<Map<string, OrderRequirementDto[]>> {
    const supplierOrders = new Map<string, OrderRequirementDto[]>();

    for (const requirement of requirements) {
      const supplierId = requirement.supplierId;

      if (!supplierOrders.has(supplierId)) {
        supplierOrders.set(supplierId, []);
      }

      supplierOrders.get(supplierId).push(requirement);
    }

    const urgencyOrder = { LOW: 4, MEDIUM: 3, HIGH: 2, CRITICAL: 1 };

    for (const [supplierId, items] of supplierOrders.entries()) {
      items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    }

    return supplierOrders;
  }

  async classifyByZone(
    requirements: OrderRequirementDto[],
  ): Promise<Map<string, OrderRequirementDto[]>> {
    const zoneOrders = new Map<string, OrderRequirementDto[]>();

    for (const requirement of requirements) {
      const zone = requirement.conservationZone;

      if (!zoneOrders.has(zone)) {
        zoneOrders.set(zone, []);
      }

      zoneOrders.get(zone).push(requirement);
    }

    const zonePriority = {
      FROZEN: 1,
      REFRIGERATED: 2,
      DRY_GOODS: 3,
      AMBIENT: 4,
      SPECIAL: 5,
    };

    const zoneOrder = [...zoneOrders.entries()].sort(
      (a, b) => zonePriority[a[0]] - zonePriority[b[0]],
    );

    return new Map(zoneOrder);
  }

  async classifyByCategory(
    requirements: OrderRequirementDto[],
  ): Promise<Map<string, OrderRequirementDto[]>> {
    const categoryOrders = new Map<string, OrderRequirementDto[]>();

    for (const requirement of requirements) {
      const category = requirement.category;

      if (!categoryOrders.has(category)) {
        categoryOrders.set(category, []);
      }

      categoryOrders.get(category).push(requirement);
    }

    return categoryOrders;
  }

  async getSupplierClassification(
    tenantId: string,
    supplierId: string,
  ): Promise<SupplierClassificationDto> {
    const supplier = await (this.prisma as any).supplier?.findFirst({
      where: { id: supplierId, tenantId },
      include: {
        products: {
          select: {
            category: true,
            conservationZone: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const categories = [...new Set(supplier.products.map((p) => p.category))];
    const conservationZones = [
      ...new Set(supplier.products.map((p) => p.conservationZone)),
    ];

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      categories: categories as string[],
      conservationZones: conservationZones as string[],
      averageDeliveryTime: supplier.averageDeliveryTime || 3,
      reliabilityScore: supplier.reliabilityScore || 85,
      priceTier: supplier.priceTier || PriceTier.MEDIUM,
      preferredStatus: supplier.preferredStatus || PreferredStatus.ALTERNATIVE,
      contactInfo: {
        email: supplier.email,
        phone: supplier.phone,
        website: supplier.website,
      },
      orderMethods: supplier.orderMethods || ["EMAIL"],
    };
  }

  async createAutomatedOrder(
    dto: CreateAutomatedOrderDto,
  ): Promise<AutomatedOrderDto> {
    const { tenantId, supplierId, urgency, scheduledDelivery, items } = dto;

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const order = await (this.prisma as any).automatedOrder?.create({
      data: {
        tenantId,
        supplierId,
        orderNumber,
        status: OrderStatus.DRAFT,
        urgency,
        scheduledDelivery,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            requestedQuantity: item.requestedQuantity,
            adjustedQuantity: item.adjustedQuantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            alternativeProducts: item.alternativeProducts,
          })),
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // Broadcast WebSocket event
    this.webSocketService.broadcastOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.supplier?.name || "Unknown",
      status: order.status,
      totalAmount: order.totalAmount || 0,
      items:
        order.items?.map((item: any) => ({
          productId: item.productId,
          productName: item.productId,
          quantity: item.adjustedQuantity || item.requestedQuantity,
          unit: "units",
        })) || [],
      createdAt: order.createdAt,
      tenantId,
    });

    return this.formatOrder(order);
  }

  async getAutomatedOrder(
    tenantId: string,
    orderId: string,
  ): Promise<AutomatedOrderDto> {
    const order = await (this.prisma as any).automatedOrder?.findFirst({
      where: { id: orderId, tenantId },
      include: {
        supplier: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Broadcast WebSocket event
    this.webSocketService.broadcastOrderCreated({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.supplier?.name || "Unknown",
      status: order.status,
      totalAmount: order.totalAmount || 0,
      items:
        order.items?.map((item: any) => ({
          productId: item.productId,
          productName: item.productId,
          quantity: item.adjustedQuantity || item.requestedQuantity,
          unit: "units",
        })) || [],
      createdAt: order.createdAt,
      tenantId,
    });

    return this.formatOrder(order);
  }

  private formatOrder(order: any): AutomatedOrderDto {
    const items: OrderItemDto[] = order.items.map((item: any) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.product?.name || "Unknown",
      requestedQuantity: item.requestedQuantity,
      adjustedQuantity: item.adjustedQuantity,
      unit: item.product?.unit || "units",
      unitPrice: item.unitPrice,
      totalCost: item.totalCost,
      notes: item.notes,
      alternativeProducts: item.alternativeProducts,
    }));

    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      id: order.id,
      tenantId: order.tenantId,
      supplierId: order.supplierId,
      supplierName: order.supplier?.name || "Unknown",
      orderNumber: order.orderNumber,
      status: order.status,
      urgency: order.urgency,
      scheduledDelivery: order.scheduledDelivery,
      estimatedCost: totalCost,
      createdAt: order.createdAt,
      createdBy: order.createdBy,
      reviewedBy: order.reviewedBy,
      reviewedAt: order.reviewedAt,
      approvedBy: order.approvedBy,
      approvedAt: order.approvedAt,
      sentAt: order.sentAt,
      receivedAt: order.receivedAt,
      items,
    };
  }

  async updateOrderItem(
    tenantId: string,
    orderId: string,
    itemId: string,
    dto: UpdateOrderItemDto,
  ): Promise<OrderItemDto> {
    const order = await (this.prisma as any).automatedOrder?.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const item = await (this.prisma as any).orderItem?.findUnique({
      where: { id: itemId },
      include: {
        order: true,
        product: true,
      },
    });

    if (!item || item.orderId !== orderId) {
      throw new NotFoundException(`Order item ${itemId} not found`);
    }

    const updated = await (this.prisma as any).orderItem?.update({
      where: { id: itemId },
      data: {
        adjustedQuantity: dto.adjustedQuantity,
        notes: dto.notes,
        alternativeProducts: dto.alternativeProducts,
      },
      include: {
        product: true,
      },
    });

    return {
      id: updated.id,
      orderId: updated.orderId,
      productId: updated.productId,
      productName: updated.product?.name || "Unknown",
      requestedQuantity: updated.requestedQuantity,
      adjustedQuantity: updated.adjustedQuantity,
      unit: updated.product?.unit || "units",
      unitPrice: updated.unitPrice,
      totalCost: updated.totalCost,
      notes: updated.notes,
      alternativeProducts: updated.alternativeProducts,
    };
  }

  async approveOrder(
    tenantId: string,
    orderId: string,
    dto: ApproveOrderDto,
  ): Promise<AutomatedOrderDto> {
    const order = await (this.prisma as any).automatedOrder?.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (
      order.status !== OrderStatus.DRAFT &&
      order.status !== OrderStatus.REVIEW
    ) {
      throw new BadRequestException(
        `Order must be in DRAFT or REVIEW status to approve`,
      );
    }

    const updated = await (this.prisma as any).automatedOrder?.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.APPROVED,
        approvedBy: dto.approvedBy,
        approvedAt: new Date(),
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // Broadcast WebSocket event
    this.webSocketService.broadcastOrderApproved({
      id: updated.id,
      orderNumber: updated.orderNumber,
      supplierId: updated.supplierId,
      supplierName: updated.supplier?.name || "Unknown",
      status: updated.status,
      totalAmount: updated.totalAmount || 0,
      items:
        updated.items?.map((item: any) => ({
          productId: item.productId,
          productName: item.productId, // Will be fetched if needed
          quantity: item.adjustedQuantity || item.requestedQuantity,
          unit: "units",
        })) || [],
      createdAt: updated.createdAt,
      tenantId,
    });

    return this.formatOrder(updated);
  }

  async sendOrder(
    tenantId: string,
    orderId: string,
    dto: SendOrderDto,
  ): Promise<AutomatedOrderDto> {
    const order = await (this.prisma as any).automatedOrder?.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.APPROVED) {
      throw new BadRequestException(`Order must be APPROVED to send`);
    }

    const updated = await (this.prisma as any).automatedOrder?.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SENT,
        sentAt: new Date(),
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return this.formatOrder(updated);
  }

  async getOrdersHistory(tenantId: string): Promise<AutomatedOrderDto[]> {
    const orders = await (this.prisma as any).automatedOrder?.findMany({
      where: { tenantId },
      include: {
        supplier: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders.map((order) => this.formatOrder(order));
  }

  async getOrdersBySupplier(
    tenantId: string,
    supplierId: string,
  ): Promise<AutomatedOrderDto[]> {
    const orders = await (this.prisma as any).automatedOrder?.findMany({
      where: { tenantId, supplierId },
      include: {
        supplier: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders.map((order) => this.formatOrder(order));
  }

  async getOrdersByZone(
    tenantId: string,
    zone: string,
  ): Promise<AutomatedOrderDto[]> {
    const orders = await (this.prisma as any).automatedOrder?.findMany({
      where: {
        tenantId,
        items: {
          some: {
            product: {
              conservationZone: zone,
            },
          },
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders.map((order) => this.formatOrder(order));
  }

  async generatePurchaseTemplate(
    tenantId: string,
    orderId: string,
    dto: ExportOrderDto,
  ): Promise<PurchaseOrderTemplateDto> {
    const order = await this.getAutomatedOrder(tenantId, orderId);

    const supplier = await (this.prisma as any).supplier?.findUnique({
      where: { id: order.supplierId },
    });

    const subtotal = order.items.reduce((sum, item) => sum + item.totalCost, 0);
    const taxes = subtotal * 0.21;
    const shippingCost = 15;
    const total = subtotal + taxes + shippingCost;

    const orderItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      requestedQuantity: item.adjustedQuantity || item.requestedQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalCost:
        (item.adjustedQuantity || item.requestedQuantity) * item.unitPrice,
      specifications: item.notes,
      alternativeProducts: item.alternativeProducts,
    }));

    return {
      id: `template-${orderId}`,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      orderNumber: order.orderNumber,
      generationDate: new Date(),
      estimatedDelivery: order.scheduledDelivery,
      contactInfo: {
        email: supplier?.email,
        phone: supplier?.phone,
        website: supplier?.website,
      },
      orderItems,
      subtotal,
      taxes,
      shippingCost,
      total,
      notes: "Orden generada automáticamente por ChefChek",
      format: dto.format,
    };
  }
}
