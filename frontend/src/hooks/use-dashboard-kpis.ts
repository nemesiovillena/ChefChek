import { useApiQuery } from './use-api';

export interface UpcomingProductionTask {
  id: string;
  title: string;
  station: string;
  orderType: string;
  status: string;
  scheduledFor: string;
  estimatedTime: number;
}

interface KPIs {
  totalProducts: number;
  totalRecipes: number;
  totalMenus: number;
  activeUsers: number;
  lowStockItems: number;
  pendingOrders: number;
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