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
    referencePrice: number; // purchasePrice / unitSize

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
