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
  purchaseUnit: string;
  storageUnit: string;
  recipeUnit: string;
  purchasePrice: number;
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

export interface PurchaseFormatInput {
  name: string;
  format: string;
  price: number;
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
  purchaseUnit: string;
  storageUnit: string;
  recipeUnit: string;
  purchasePrice: number;
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
  purchaseFormats?: PurchaseFormatInput[];
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
