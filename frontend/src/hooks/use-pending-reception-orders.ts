'use client';

import apiClient from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

export interface PendingReceptionOrder {
  id: string;
  orderNumber: string;
  status: 'ENVIADO' | 'RECIBIDO_PARCIAL';
  sentAt: string;
  expectedTotal: number;
}

/**
 * Pedidos ENVIADOS/RECIBIDO_PARCIAL de un proveedor, cercanos (±7 días) a una
 * fecha de referencia — para sugerir el vínculo al revisar un albarán.
 */
export function usePendingReceptionOrders(
  supplierId: string | undefined,
  referenceDate?: string,
) {
  return useQuery<PendingReceptionOrder[], Error>({
    queryKey: ['pending-reception-orders', supplierId, referenceDate ?? ''],
    queryFn: async () =>
      (
        await apiClient.get('/v1/compras/pedidos/pendientes-recepcion', {
          params: { supplierId, ...(referenceDate ? { date: referenceDate } : {}) },
        })
      ).data,
    enabled: !!supplierId,
  });
}
