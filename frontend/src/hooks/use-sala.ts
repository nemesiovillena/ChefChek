import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface KitchenOrderResponse {
  id: string;
  orderId: string;
  status: string;
  items: KitchenOrderItem[];
  displayedAt: string;
  completedAt?: string;
}

export interface KitchenOrderItem {
  id: string;
  recipeId?: string;
  recipeName?: string;
  quantity: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MiseEnPlaceResponse {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export function useSala() {
  const queryClient = useQueryClient();

  const { data: ordersData, isLoading, error, refetch } = useQuery({
    queryKey: ['sala-orders'],
    queryFn: async () => {
      const response = await apiClient.get<KitchenOrderResponse[]>('/v1/sala/orders');
      return response.data;
    },
  });

  const { data: miseEnPlaceData, isLoading: miseEnPlaceLoading, error: miseEnPlaceError, refetch: miseEnPlaceRefetch } = useQuery({
    queryKey: ['mise-en-place'],
    queryFn: async () => {
      const response = await apiClient.get<MiseEnPlaceResponse[]>('/v1/sala/mise-en-place');
      return response.data;
    },
  });

  const completeOrderItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiClient.post<KitchenOrderItem>(`/v1/sala/order-items/${itemId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sala-orders'] });
    },
  });

  const createMiseEnPlaceMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: number; unit: string; dueDate?: string }) => {
      const response = await apiClient.post<MiseEnPlaceResponse>('/v1/sala/mise-en-place', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-place'] });
    },
  });

  const updateMiseEnPlaceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ status: string }> }) => {
      const response = await apiClient.patch<MiseEnPlaceResponse>(`/v1/sala/mise-en-place/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mise-en-place'] });
    },
  });

  return {
    kitchenOrders: ordersData || [],
    miseEnPlace: miseEnPlaceData || [],
    isLoading: isLoading || miseEnPlaceLoading,
    error: error || miseEnPlaceError,
    refetch,
    completeOrderItem: completeOrderItemMutation.mutateAsync,
    createMiseEnPlace: createMiseEnPlaceMutation.mutateAsync,
    updateMiseEnPlace: updateMiseEnPlaceMutation.mutateAsync,
    isCompleting: completeOrderItemMutation.isPending,
  };
}