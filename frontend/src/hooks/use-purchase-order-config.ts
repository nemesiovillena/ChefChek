import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';

export interface PurchaseOrderConfig {
  supplierNote: string;
}

const PURCHASE_ORDER_CONFIG_KEY = ['purchase-order-config'];

/** Texto fijo añadido a los pedidos generados desde una lista de compra. */
export function usePurchaseOrderConfig() {
  return useApiQuery<PurchaseOrderConfig>(
    PURCHASE_ORDER_CONFIG_KEY,
    '/v1/compras/config-pedido',
  );
}

export function useUpdatePurchaseOrderConfig() {
  const invalidateQueries = useInvalidateQueries();

  return useApiMutation<PurchaseOrderConfig, Partial<PurchaseOrderConfig>>(
    '/v1/compras/config-pedido',
    'PATCH',
    {
      onSuccess: () => {
        invalidateQueries([PURCHASE_ORDER_CONFIG_KEY]);
      },
    },
  );
}
