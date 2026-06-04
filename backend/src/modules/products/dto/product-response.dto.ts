export class ProductResponseDto {
  success: true;
  data: {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    category: string;
    supplier?: string;

    // Multi-unidad
    purchaseUnit: string;
    storageUnit: string;
    recipeUnit: string;

    // Precios
    purchasePrice: number;
    netPrice: number;
    profitMargin: number;

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
    purchaseUnit: string;
    purchasePrice: number;
    netPrice: number;
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

    // Costeo por unidad
    costPerPurchaseUnit: number;
    costPerStorageUnit: number;
    costPerRecipeUnit: number;

    // Factores de conversión
    ucToUaFactor: number;
    uaToUrFactor: number;
    ucToUrFactor: number;

    // Información de precio
    purchasePrice: number;
    netPrice: number;
    wastePercentage: number;
    yieldFactor: number;
  };
  message: string;
}
