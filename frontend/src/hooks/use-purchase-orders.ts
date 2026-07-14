'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export type PurchaseOrderStatus =
  | 'BORRADOR'
  | 'PENDIENTE_ENVIO'
  | 'ENVIADO'
  | 'RECIBIDO_PARCIAL'
  | 'RECIBIDO'
  | 'CANCELADO';

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  quantity: number;
  unit?: string | null;
  expectedPrice?: number | null;
  receivedQuantity?: number | null;
  receivedPrice?: number | null;
  lineNotes?: string | null;
  product?: {
    id: string;
    name: string;
    referenceUnit: string;
    purchaseFormat: string;
  };
}

export interface PurchaseOrderEvent {
  id: string;
  type: string;
  channel?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  locationId?: string | null;
  notes?: string | null;
  sentAt?: string | null;
  sentVia?: string | null;
  expectedTotal: number;
  receivedTotal?: number | null;
  createdAt: string;
  supplier?: { id: string; name: string; orderMethods?: string[] };
  location?: { id: string; name: string } | null;
  lines?: PurchaseOrderLine[];
  events?: PurchaseOrderEvent[];
  _count?: { lines: number };
}

export interface PurchaseOrderLineInput {
  productId: string;
  quantity: number;
  expectedPrice?: number;
  unit?: string;
  lineNotes?: string;
}

export interface PurchaseOrdersParams {
  page?: number;
  limit?: number;
  status?: PurchaseOrderStatus | '';
  supplierId?: string;
  search?: string;
}

interface PaginatedOrders {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const BASE_URL = '/v1/compras/pedidos';
const QUERY_KEY = 'purchase-orders';

export function usePurchaseOrders(params: PurchaseOrdersParams) {
  return useQuery<PaginatedOrders, Error>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      // Solo params con valor: el DTO backend rechaza campos vacíos/extra
      const clean = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== '' && v != null),
      );
      const response = await apiClient.get<PaginatedOrders>(BASE_URL, {
        params: clean,
      });
      return response.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function usePurchaseOrder(id: string | null) {
  return useQuery<PurchaseOrder, Error>({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/${id}`)).data,
    enabled: !!id,
  });
}

function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
}

export function useCreatePurchaseOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation<
    PurchaseOrder,
    Error,
    {
      supplierId: string;
      locationId?: string;
      notes?: string;
      lines: PurchaseOrderLineInput[];
    }
  >({
    mutationFn: async (data) => (await apiClient.post(BASE_URL, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdatePurchaseOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation<
    PurchaseOrder,
    Error,
    {
      id: string;
      data: { locationId?: string; notes?: string; lines?: PurchaseOrderLineInput[] };
    }
  >({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE_URL}/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useTransitionPurchaseOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation<
    PurchaseOrder,
    Error,
    { id: string; status: PurchaseOrderStatus }
  >({
    mutationFn: async ({ id, status }) =>
      (await apiClient.patch(`${BASE_URL}/${id}/estado`, { status })).data,
    onSuccess: invalidate,
  });
}

export function useDeletePurchaseOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation<PurchaseOrder, Error, string>({
    // URL con id a mano (la rama DELETE de useApiMutation descarta variables)
    mutationFn: async (id) => (await apiClient.delete(`${BASE_URL}/${id}`)).data,
    onSuccess: invalidate,
  });
}

/** Etiquetas y colores M3 por estado, compartidos por tabla y detalle. */
export const ORDER_STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; className: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    className:
      'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
  },
  PENDIENTE_ENVIO: {
    label: 'Pendiente de envío',
    className: 'bg-[var(--secondary-container)] text-[var(--on-surface)]',
  },
  ENVIADO: {
    label: 'Enviado',
    className: 'bg-[var(--primary)] text-primary-foreground',
  },
  RECIBIDO_PARCIAL: {
    label: 'Recibido parcial',
    className: 'bg-[var(--secondary-container)] text-[var(--on-surface)]',
  },
  RECIBIDO: {
    label: 'Recibido',
    className: 'bg-[var(--secondary-container)] text-[var(--on-surface)]',
  },
  CANCELADO: {
    label: 'Cancelado',
    className: 'bg-[var(--error-container)] text-[var(--on-error-container)]',
  },
};
