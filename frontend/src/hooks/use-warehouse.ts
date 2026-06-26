import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface WarehouseResponse {
  id: string;
  name: string;
  type: 'MAIN' | 'KITCHEN' | 'COLD_STORAGE' | 'DRY_STORAGE' | 'SPECIAL';
  capacity?: number;
  isActive: boolean;
  currentStock?: number;
  createdAt: string;
}

export interface StockMovementResponse {
  id: string;
  warehouseId: string;
  productId?: string;
  productName?: string;
  movementType: 'IN' | 'OUT';
  quantity: number;
  reason?: string;
  createdAt: string;
}

export interface CreateWarehouseData {
  name: string;
  type: 'MAIN' | 'KITCHEN' | 'COLD_STORAGE' | 'DRY_STORAGE' | 'SPECIAL';
  capacity?: number;
}

export function useWarehouse() {
  const queryClient = useQueryClient();

  const { data: warehousesData, isLoading, error, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await apiClient.get<WarehouseResponse[]>('/v1/almacenes/warehouses');
      return response.data;
    },
  });

  const { data: movementsData, isLoading: movementsLoading, error: movementsError } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const response = await apiClient.get<StockMovementResponse[]>('/v1/almacenes/stocks');
      return response.data;
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: CreateWarehouseData) => {
      const response = await apiClient.post<WarehouseResponse>('/v1/almacenes/warehouses', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  const createStockMovementMutation = useMutation({
    mutationFn: async (data: { warehouseId: string; productId?: string; movementType: 'IN' | 'OUT'; quantity: number; reason?: string }) => {
      const response = await apiClient.post<StockMovementResponse>('/v1/almacenes/stocks', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  return {
    warehouses: warehousesData || [],
    stockMovements: movementsData || [],
    isLoading: isLoading || movementsLoading,
    error: error || movementsError,
    refetch,
    createWarehouse: createWarehouseMutation.mutateAsync,
    createStockMovement: createStockMovementMutation.mutateAsync,
    isCreating: createWarehouseMutation.isPending,
  };
}