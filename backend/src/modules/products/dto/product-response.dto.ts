export class ProductResponseDto {
  success: true;
  data: {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    category: string;
    supplier?: string;

    // Unidad de referencia
    purchaseFormat: string;
    referenceUnit: string;
    unitsPerFormat: number;
    referenceUnitSize: number;
    unitSize: number; // auto-calculated: unitsPerFormat * referenceUnitSize

    // Precios
    purchasePrice: number;
    previousPurchasePrice: number;
    netPrice: number;
    profitMargin: number;
    discountPercentage: number; // Descuento fijo del proveedor aplicado al coste (sobre purchasePrice)
    referencePrice: number; // purchasePrice / unitSize

    // Último cambio de precio con traza (delta del historial). null si no hay
    // historial → el badge de tendencia no se renderiza.
    latestPriceChange?: {
      previousPrice: number;
      newPrice: number;
      recordedAt: string;
    } | null;

    // Rendimiento
    wastePercentage: number;
    yieldFactor: number;

    // Alérgenos
    allergens: number[];

    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  message: string;
}

export class ProductsListResponseDto {
  success: true;
  data: Array<{
    id: string;
    name: string;
    category: string;
    supplier?: string;
    purchaseFormat: string;
    referenceUnit: string;
    unitsPerFormat: number;
    referenceUnitSize: number;
    unitSize: number;
    purchasePrice: number;
    previousPurchasePrice: number;
    netPrice: number;
    referencePrice: number;
    isActive: boolean;
    allergens: number[];
    latestPriceChange?: {
      previousPrice: number;
      newPrice: number;
      recordedAt: string;
    } | null;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string;
}

export class ProductCostCalculationDto {
  success: true;
  data: {
    productId: string;
    productName: string;

    // Costeo por unidad de referencia
    costPerPurchaseUnit: number;
    referencePrice: number; // price per kg/L/und

    // Info de conversión
    purchaseFormat: string;
    referenceUnit: string;
    unitsPerFormat: number;
    referenceUnitSize: number;
    unitSize: number;

    // Información de precio
    purchasePrice: number;
    netPrice: number;
    wastePercentage: number;
    yieldFactor: number;
  };
  message: string;
}
