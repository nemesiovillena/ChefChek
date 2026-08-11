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
  estimatedTime: number;
  assignedStaffNames: string[];
}

interface KPIs {
  totalProducts: number;
  totalRecipes: number;
  totalMenus: number;
  activeUsers: number;
  lowStockItems: number;
  pendingOrders: number;
  scheduledDraftOrders: number;
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
