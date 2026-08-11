import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export type BatchPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type KitchenZone =
  | 'HOT_KITCHEN'
  | 'COLD_KITCHEN'
  | 'PASTRY_KITCHEN'
  | 'GRILL_STATION'
  | 'FRYING_STATION'
  | 'PLATING_STATION'
  | 'SERVICE_STATION';

export interface WorkBatch {
  id: string;
  tenantId: string;
  batchNumber: string;
  batchType: string;
  status: string;
  scheduledFor: string;
  priority: BatchPriority;
  responsible: string[];
  kitchenZone: KitchenZone;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  productionOrders?: ProductionOrder[];
}

export interface ProductionOrder {
  id: string;
  tenantId: string;
  batchId: string;
  title: string;
  recipeId?: string | null;
  recipeName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  estimatedTime?: number | null;
  orderNumber: string;
  orderType: string;
  status: string;
  scheduledFor: string;
  startedAt?: string | null;
  completedAt?: string | null;
  description?: string | null;
  assignedStaffIds?: string[];
  actualTime?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface CreateWorkBatchInput {
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  priority: BatchPriority;
  responsible: string[];
  kitchenZone: KitchenZone;
}

export interface CreateProductionOrderInput {
  batchId: string;
  title: string;
  recipeId?: string;
  recipeName?: string;
  quantity?: number;
  unit?: string;
  estimatedTime?: number;
  description?: string;
  assignedStaffIds?: string[];
}

export function useProductionBatches() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['production-batches'],
    queryFn: async () => {
      const response = await apiClient.get<WorkBatch[]>('/v1/production/batches');
      return response.data;
    },
  });

  const createBatch = useMutation({
    mutationFn: async (input: CreateWorkBatchInput) => {
      const response = await apiClient.post<WorkBatch>('/v1/production/batches', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
    },
  });

  const completeBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await apiClient.post<WorkBatch>(`/v1/production/batches/${batchId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
    },
  });

  return {
    batches: data || [],
    isLoading,
    error,
    refetch,
    createBatch: createBatch.mutateAsync,
    isCreating: createBatch.isPending,
    completeBatch: completeBatch.mutateAsync,
    isCompleting: completeBatch.isPending,
  };
}

export function useProductionOrders(batchId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['production-orders', batchId],
    queryFn: async () => {
      const response = await apiClient.get<ProductionOrder[]>(
        `/v1/production/orders/${batchId}`,
      );
      return response.data;
    },
    enabled: !!batchId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-orders', batchId] });
    // El lote incluye sus órdenes (include: productionOrders), así que crear/avanzar
    // una orden también deja stale el listado de lotes.
    queryClient.invalidateQueries({ queryKey: ['production-batches'] });
  };

  const createOrder = useMutation({
    mutationFn: async (input: CreateProductionOrderInput) => {
      const response = await apiClient.post<ProductionOrder>('/v1/production/orders', input);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const startOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.post<ProductionOrder>(
        `/v1/production/orders/${orderId}/start`,
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const completeOrder = useMutation({
    mutationFn: async ({ orderId, actualTime }: { orderId: string; actualTime: number }) => {
      const response = await apiClient.put<ProductionOrder>(
        `/v1/production/orders/${orderId}/complete`,
        { actualTime },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      await apiClient.delete(`/v1/production/orders/${orderId}`);
    },
    onSuccess: invalidate,
  });

  return {
    orders: data || [],
    isLoading,
    error,
    createOrder: createOrder.mutateAsync,
    isCreating: createOrder.isPending,
    startOrder: startOrder.mutateAsync,
    isStarting: startOrder.isPending,
    completeOrder: completeOrder.mutateAsync,
    isCompleting: completeOrder.isPending,
    deleteOrder: deleteOrder.mutateAsync,
    isDeleting: deleteOrder.isPending,
  };
}
