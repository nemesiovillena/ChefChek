import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { KitchenZone } from './use-production';

export interface ProductionKpis {
  completionRate: number;
  efficiency: number;
  onTimeDelivery: number;
  staffUtilization: number;
  avgTaskDuration: number;
  alertCount: number;
}

export interface ProductionReport {
  period: { startDate: string; endDate: string };
  kpis: ProductionKpis;
  generatedAt: string;
}

export interface GenerateProductionReportInput {
  startDate: string;
  endDate: string;
  batchIds?: string[];
  zone?: KitchenZone;
}

export function useGenerateProductionReport() {
  return useMutation({
    mutationFn: async (input: GenerateProductionReportInput) => {
      const response = await apiClient.post<ProductionReport>('/v1/production/reports', input);
      return response.data;
    },
  });
}
