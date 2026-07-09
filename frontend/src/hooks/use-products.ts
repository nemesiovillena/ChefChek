import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCrud as createCrudHooks, useApiMutation, useApiQuery } from './use-api';
import apiClient from '@/lib/api-client';
import { formatEuro } from '@/lib/utils';

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
  grossWeight?: number | null;
  netWeight?: number | null;
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
  lastPurchaseDate?: string | null;
  manualPurchaseDate?: string | null;
  purchaseDateSource?: 'albaran' | 'manual' | null;
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
  grossWeight?: number;
  netWeight?: number;
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
  manualPurchaseDate?: string | null;
}

export interface ProductsQuery {
  category?: string;
  supplier?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

// useCrud is a hook factory (builds hooks, does not itself call React hooks);
// aliased to a non-hook name so it can run at module scope.
const {
  useList,
  useGet,
  useCreate,
  useUpdate,
  useDelete,
} = createCrudHooks<Product, CreateProductData, UpdateProductData>('/v1/products', ['products']);

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

/** Format reference price for display: "5,00 €/kg" */
export function formatRefPrice(price: number, unit: string): string {
  return `${formatEuro(price)}/${unit}`;
}

/**
 * Precio Real/kg: coste del kg limpio tras mermar. Usa product.yieldFactor
 * directamente (fuente de verdad persistida, ya sea derivado de una prueba de
 * rendimiento Peso Bruto/Neto o de un % de merma manual). null si el artículo
 * no tiene ningún dato de merma configurado.
 */
export function getRealPrice(product: Product): number | null {
  const hasYieldInfo = (!!product.grossWeight && !!product.netWeight) || product.wastePercentage > 0;
  if (!hasYieldInfo) return null;
  const unitSize = product.unitSize || 1;
  return product.purchasePrice / unitSize / (product.yieldFactor || 1);
}

/**
 * Ofertas de proveedor por artículo: un mismo Product puede tener varias
 * ofertas (mismo ingrediente, distintos proveedores/precios). La marcada
 * `isPreferred` es la que alimenta los campos planos del Product
 * (purchasePrice/netPrice/etc.), que es lo que leen getReferencePrice/
 * getRealPrice de arriba — sin cambios en esas funciones.
 */
export interface ProductSupplierOffer {
  id: string;
  productId: string;
  supplierId: string;
  supplier?: ProductSupplier;
  purchaseFormat: string;
  referenceUnit: string;
  unitsPerFormat: number;
  referenceUnitSize: number;
  unitSize: number;
  purchasePrice: number;
  previousPurchasePrice: number;
  netPrice: number;
  profitMargin: number;
  isPreferred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOfferInput {
  purchasePrice: number;
  netPrice?: number;
  purchaseFormat?: string;
  referenceUnit?: string;
  unitsPerFormat?: number;
  referenceUnitSize?: number;
  profitMargin?: number;
}

function invalidateSupplierOffers(
  queryClient: ReturnType<typeof useQueryClient>,
  productId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['products', productId, 'supplier-offers'] });
  queryClient.invalidateQueries({ queryKey: ['products', productId] });
  queryClient.invalidateQueries({ queryKey: ['products'] });
}

export function useProductSupplierOffers(productId: string) {
  return useApiQuery<ProductSupplierOffer[]>(
    ['products', productId, 'supplier-offers'],
    `/v1/products/${productId}/supplier-offers`,
    { enabled: !!productId }
  );
}

export function useCreateSupplierOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      supplierId,
      ...data
    }: SupplierOfferInput & { productId: string; supplierId: string }) => {
      const res = await apiClient.post<ProductSupplierOffer>(
        `/v1/products/${productId}/supplier-offers`,
        { supplierId, ...data }
      );
      return res.data;
    },
    onSuccess: (_, variables) => invalidateSupplierOffers(queryClient, variables.productId),
  });
}

export function useUpdateSupplierOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      offerId,
      ...data
    }: SupplierOfferInput & { productId: string; offerId: string }) => {
      const res = await apiClient.patch<ProductSupplierOffer>(
        `/v1/products/${productId}/supplier-offers/${offerId}`,
        data
      );
      return res.data;
    },
    onSuccess: (_, variables) => invalidateSupplierOffers(queryClient, variables.productId),
  });
}

export function useDeleteSupplierOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      offerId,
      promoteOfferId,
    }: {
      productId: string;
      offerId: string;
      promoteOfferId?: string;
    }) => {
      const query = promoteOfferId ? `?promoteOfferId=${promoteOfferId}` : '';
      await apiClient.delete(`/v1/products/${productId}/supplier-offers/${offerId}${query}`);
    },
    onSuccess: (_, variables) => invalidateSupplierOffers(queryClient, variables.productId),
  });
}

export function useSetPreferredSupplierOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, offerId }: { productId: string; offerId: string }) => {
      const res = await apiClient.post<ProductSupplierOffer>(
        `/v1/products/${productId}/supplier-offers/${offerId}/set-preferred`
      );
      return res.data;
    },
    onSuccess: (_, variables) => invalidateSupplierOffers(queryClient, variables.productId),
  });
}
