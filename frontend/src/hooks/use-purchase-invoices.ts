'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type { PurchaseInvoice } from './use-purchase-orders';

export interface CreateInvoiceInput {
  invoiceNumber: string;
  supplier?: string;
  totalAmount: number;
  issuedAt: string;
  dueDate?: string;
  albaranId?: string;
  purchaseOrderId?: string;
  fileUrl?: string;
}

const BASE_URL = '/v1/compras/facturas';

/** Facturas vinculadas a un pedido y/o albarán (registro mínimo). */
export function usePurchaseInvoices(filters: {
  purchaseOrderId?: string;
  albaranId?: string;
}) {
  const key = [
    'purchase-invoices',
    filters.purchaseOrderId ?? '',
    filters.albaranId ?? '',
  ];
  const params = new URLSearchParams();
  if (filters.purchaseOrderId) params.set('purchaseOrderId', filters.purchaseOrderId);
  if (filters.albaranId) params.set('albaranId', filters.albaranId);
  const url = params.toString() ? `${BASE_URL}?${params.toString()}` : BASE_URL;
  return useApiQuery<PurchaseInvoice[]>(key, url);
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation<PurchaseInvoice, Error, CreateInvoiceInput>({
    mutationFn: async (data) => (await apiClient.post(BASE_URL, data)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation<PurchaseInvoice, Error, string>({
    mutationFn: async (id) => (await apiClient.delete(`${BASE_URL}/${id}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }),
  });
}
