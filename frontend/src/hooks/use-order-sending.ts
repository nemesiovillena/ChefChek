'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useInvalidateOrders, type PurchaseOrder } from './use-purchase-orders';

export type SendChannel = 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'WEB';

export interface SendPreview {
  orderNumber: string;
  status: string;
  channels: SendChannel[];
  text: string;
  email: string | null;
  phone: string | null;
  whatsappUrl: string | null;
}

const ORDERS_URL = '/v1/compras/pedidos';

export function useSendPreview(orderId: string, enabled: boolean) {
  return useQuery<SendPreview, Error>({
    queryKey: ['purchase-orders', orderId, 'send-preview'],
    queryFn: async () =>
      (await apiClient.get(`${ORDERS_URL}/${orderId}/envio`)).data,
    enabled,
  });
}

export function useSendOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation<
    PurchaseOrder,
    Error,
    { orderId: string; channel: SendChannel }
  >({
    mutationFn: async ({ orderId, channel }) =>
      (await apiClient.post(`${ORDERS_URL}/${orderId}/enviar`, { channel }))
        .data,
    onSuccess: invalidate,
  });
}

/** Abre el PDF del pedido en una pestaña nueva (blob autenticado). */
export async function openOrderPdf(orderId: string) {
  const response = await apiClient.get(`${ORDERS_URL}/${orderId}/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(
    new Blob([response.data], { type: 'application/pdf' }),
  );
  window.open(url, '_blank');
}
