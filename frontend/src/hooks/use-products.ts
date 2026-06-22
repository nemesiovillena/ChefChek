import { useCrud, useApiMutation } from './use-api';

export interface PurchaseFormat {
  id: string;
  name: string;
  format: string;
  price: number;
  createdAt: string;
}

export interface NutritionalInfo {
  id: string;
  energyKj?: number;
  energyKcal?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  monounsaturatedFat?: number;
  polyunsaturatedFat?: number;
  omega3?: number;
  cholesterol?: number;
  carbohydrates?: number;
  sugars?: number;
  protein?: number;
  salt?: number;
}

export interface ProductStock {
  id: string;
  quantity: number;
  minimumStock: number;
  maximumStock?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  parentId?: string;
  parent?: { id: string; name: string };
}

export interface ProductSupplier {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: number;
  referenceUnitSize: number;
  unitSize: number; // auto-calculated: unitsPerFormat * referenceUnitSize
  purchasePrice: number;
  previousPurchasePrice: number;
  netPrice: number;
  profitMargin: number;
  wastePercentage: number;
  yieldFactor: number;
  categoryId?: string;
  supplierId?: string;
  allergens: number[];
  iva: number;
  qr?: string;
  barcode?: string;
  brand?: string;
  hideAllergens: boolean;
  imageUrl?: string;
  isActive: boolean;
  tenantId: string;
  category?: ProductCategory;
  supplier?: ProductSupplier;
  purchaseFormats: PurchaseFormat[];
  nutritionalInfo?: NutritionalInfo;
  stocks: ProductStock[];
  createdAt: string;
  updatedAt: string;
}

export interface NutritionalInfoInput {
  energyKj?: number;
  energyKcal?: number;
  fat?: number;
  saturatedFat?: number;
  transFat?: number;
  monounsaturatedFat?: number;
  polyunsaturatedFat?: number;
  omega3?: number;
  cholesterol?: number;
  carbohydrates?: number;
  sugars?: number;
  protein?: number;
  salt?: number;
}

export interface CreateProductData {
  name: string;
  description?: string;
  category?: string;
  supplier?: string;
  purchaseFormat?: string;
  referenceUnit?: string;
  unitsPerFormat?: number;
  referenceUnitSize?: number;
  purchasePrice?: number;
  wastePercentage?: number;
  profitMargin?: number;
  yieldFactor?: number;
  allergens?: number[];
  iva?: number;
  qr?: string;
  barcode?: string;
  brand?: string;
  hideAllergens?: boolean;
  imageUrl?: string;
  nutritionalInfo?: NutritionalInfoInput;
  minimumStock?: number;
  maximumStock?: number;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string;
  isActive?: boolean;
}

export interface ProductsQuery {
  category?: string;
  supplier?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

const {
  useList,
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = useCrud<Product, CreateProductData, UpdateProductData>('/v1/products', ['products']);

export function useProducts(query?: ProductsQuery, page: number = 1, pageSize: number = 50) {
  return useList(page, pageSize);
}

export function useProduct(id: string) {
  return useGet(id);
}

export function useCreateProduct() {
  return useCreate();
}

export function useUpdateProduct() {
  return useUpdate();
}

export function useDeleteProduct() {
  return useDelete();
}

export function useUploadProductImage() {
  return useApiMutation<{ url: string }, FormData>(
    '/v1/products/upload-image',
    'POST'
  );
}

/** Calculate reference price: price per kg/L/und */
export function getReferencePrice(product: Product): number {
  const size = product.unitSize || 1;
  return product.purchasePrice / size;
}

/** Format reference price for display: "€5.00/kg" */
export function formatRefPrice(price: number, unit: string): string {
  return `€${price.toFixed(2)}/${unit}`;
}
