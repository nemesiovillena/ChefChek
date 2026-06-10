import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  estimatedTime?: string;
  cover?: string;
  items?: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  recipeId?: string;
  recipeName?: string;
  quantity: number;
  unit: string;
}

export interface CreateOrderData {
  orderNumber: string;
  orderDate?: string;
  estimatedTime?: string;
  cover?: string;
  items?: OrderItem[];
}

export function useOrders() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await apiClient.get<OrderResponse[]>('/v1/orders');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const response = await apiClient.post<OrderResponse>('/v1/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateOrderData> }) => {
      const response = await apiClient.patch<OrderResponse>(`/v1/orders/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    createOrder: createMutation.mutateAsync,
    updateOrder: updateMutation.mutateAsync,
    deleteOrder: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}