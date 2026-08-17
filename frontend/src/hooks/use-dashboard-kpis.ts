import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export interface UpcomingProductionTask {
  id: string;
  batchId: string;
  title: string;
  orderType: string;
  status: string;
  lotDate: string;
  isPostponed: boolean;
  estimatedTime: number;
  assignedStaffNames: string[];
}

export interface NextScheduledPurchase {
  dateKey: string; // 'YYYY-MM-DD' en Europe/Madrid
  timeOfDay: string; // 'HH:mm' en Europe/Madrid
  supplierName: string;
}

interface KPIs {
  totalProducts: number;
  totalRecipes: number;
  totalMenus: number;
  activeUsers: number;
  lowStockItems: number;
  pendingOrders: number;
  scheduledDraftOrders: number;
  nextScheduledPurchase: NextScheduledPurchase | null;
  todayRevenue: number;
  monthlyRevenue: number;
  activeProductionBatches: number;
  upcomingProductionTasks: UpcomingProductionTask[];
}

export function useDashboardKPIs() {
  return useApiQuery<KPIs>(
    ['dashboard-kpis'],
    '/v1/dashboard/kpis',
    {
      refetchInterval: 30000, // Refetch every 30s
      enabled: true,
    },
  );
}

export function useCompleteProductionTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, actualTime }: { orderId: string; actualTime: number }) => {
      const response = await apiClient.put(`/v1/production/orders/${orderId}/complete`, { actualTime });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });
}

export function usePostponeProductionTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, scheduledFor }: { orderId: string; scheduledFor: string }) => {
      const response = await apiClient.patch(`/v1/production/orders/${orderId}/postpone`, { scheduledFor });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });
}

export function useReorderProductionTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await apiClient.patch('/v1/production/orders/reorder', { orderIds });
      return response.data;
    },
    onError: () => {
      // El drag ya se aplicó de forma optimista en el cache; si el guardado
      // falla, se descarta y se recupera el orden real del servidor.
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });
}
