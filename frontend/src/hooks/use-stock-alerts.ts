import { useApiQuery } from './use-api';

export interface StockAlertSummary {
  total: number;
  low: number;
  empty: number;
}

export function useStockAlerts() {
  return useApiQuery<StockAlertSummary>(
    ['stock-alerts'],
    '/v1/products/stock-status/count',
  );
}
