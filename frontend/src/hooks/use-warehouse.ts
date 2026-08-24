import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface WarehouseResponse {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
  isActive: boolean;
  currentStock: number;
  createdAt: string;
}

export interface StockMovementResponse {
  id: string;
  warehouseId: string | null;
  productId: string;
  product?: { name: string };
  warehouse?: { name: string } | null;
  type: 'ENTRANCE' | 'EXIT' | 'ADJUSTMENT';
  quantity: number;
  unit: string;
  reason?: string;
  createdAt: string;
}

export interface CreateWarehouseData {
  name: string;
  location?: string;
  capacity?: number;
}

interface RawWarehouse {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
  isActive: boolean;
  createdAt: string;
  stocks?: { quantity: number }[];
}

export function useWarehouse() {
  const queryClient = useQueryClient();

  const { data: warehousesData, isLoading, error, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const response = await apiClient.get<RawWarehouse[]>('/v1/almacenes');
      return response.data;
    },
  });

  const { data: movementsData, isLoading: movementsLoading, error: movementsError } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const response = await apiClient.get<StockMovementResponse[]>('/v1/almacenes/movimientos/historial');
      return response.data;
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: CreateWarehouseData) => {
      const response = await apiClient.post<RawWarehouse>('/v1/almacenes', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  const createStockMovementMutation = useMutation({
    mutationFn: async (data: {
      warehouseId?: string;
      productId: string;
      type: 'ENTRANCE' | 'EXIT' | 'ADJUSTMENT';
      quantity: number;
      unit: string;
      reason?: string;
    }) => {
      const response = await apiClient.post<StockMovementResponse>('/v1/almacenes/movimientos', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });

  const warehouses: WarehouseResponse[] = (warehousesData || []).map((w) => ({
    id: w.id,
    name: w.name,
    location: w.location,
    capacity: w.capacity,
    isActive: w.isActive,
    createdAt: w.createdAt,
    currentStock: (w.stocks || []).reduce((sum, s) => sum + s.quantity, 0),
  }));

  return {
    warehouses,
    stockMovements: movementsData || [],
    isLoading: isLoading || movementsLoading,
    error: error || movementsError,
    refetch,
    createWarehouse: createWarehouseMutation.mutateAsync,
    createStockMovement: createStockMovementMutation.mutateAsync,
    isCreating: createWarehouseMutation.isPending || createStockMovementMutation.isPending,
  };
}
