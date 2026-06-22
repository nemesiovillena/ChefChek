import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ProductionBatchResponse {
  id: string;
  name: string;
  description?: string;
  plannedDate: string;
  status: string;
  createdAt: string;
}

export interface WorkOrderResponse {
  id: string;
  batchId: string;
  recipeId?: string;
  recipeName?: string;
  quantity: number;
  status: string;
  assignedTo?: string;
}

export function useProduction() {
  const queryClient = useQueryClient();

  const { data: batchesData, isLoading: batchesLoading, error: batchesError, refetch: batchesRefetch } = useQuery({
    queryKey: ['production-batches'],
    queryFn: async () => {
      const response = await apiClient.get<ProductionBatchResponse[]>('/v1/production/batches');
      return response.data;
    },
  });

  const { data: ordersData, isLoading: ordersLoading, error: ordersError, refetch: ordersRefetch } = useQuery({
    queryKey: ['production-orders'],
    queryFn: async () => {
      const response = await apiClient.get<WorkOrderResponse[]>('/v1/production/orders');
      return response.data;
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; plannedDate: string }) => {
      const response = await apiClient.post<ProductionBatchResponse>('/v1/production/batches', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
    },
  });

  return {
    batches: batchesData || [],
    workOrders: ordersData || [],
    isLoading: batchesLoading || ordersLoading,
    error: batchesError || ordersError,
    refetch: batchesRefetch,
    createBatch: createBatchMutation.mutateAsync,
    isCreating: createBatchMutation.isPending,
  };
}