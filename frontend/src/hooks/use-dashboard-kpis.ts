import { useApiQuery } from './use-api';

interface KPIs {
  totalProducts: number;
  totalRecipes: number;
  totalMenus: number;
  activeUsers: number;
  lowStockItems: number;
  pendingOrders: number;
  todayRevenue: number;
  monthlyRevenue: number;
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