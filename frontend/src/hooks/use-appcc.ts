import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface AppccControlResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  criticalLimit?: string;
  frequency?: string;
  lastMeasurement?: string;
  lastMeasurementValue?: string;
  nextDueDate?: string;
  status: string;
  createdAt: string;
}

export interface ControlMeasurementResponse {
  id: string;
  controlId: string;
  value: number;
  unit: string;
  measuredAt: string;
  measuredBy?: string;
  notes?: string;
}

export interface CreateControlData {
  name: string;
  description?: string;
  type: string;
  criticalLimit?: string;
  frequency?: string;
}

export function useAppcc() {
  const queryClient = useQueryClient();

  const { data: controlsData, isLoading, error, refetch } = useQuery({
    queryKey: ['appcc-controls'],
    queryFn: async () => {
      const response = await apiClient.get<AppccControlResponse[]>('/v1/appcc/controls');
      return response.data;
    },
  });

  const { data: measurementsData, isLoading: measurementsLoading, error: measurementsError, refetch: measurementsRefetch } = useQuery({
    queryKey: ['appcc-measurements'],
    queryFn: async () => {
      const response = await apiClient.get<ControlMeasurementResponse[]>('/v1/appcc/measurements');
      return response.data;
    },
  });

  const createControlMutation = useMutation({
    mutationFn: async (data: CreateControlData) => {
      const response = await apiClient.post<AppccControlResponse>('/v1/appcc/controls', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appcc-controls'] });
    },
  });

  const recordMeasurementMutation = useMutation({
    mutationFn: async (data: { controlId: string; value: number; unit: string; notes?: string }) => {
      const response = await apiClient.post<ControlMeasurementResponse>('/v1/appcc/measurements', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appcc-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['appcc-controls'] });
    },
  });

  return {
    controls: controlsData || [],
    measurements: measurementsData || [],
    isLoading: isLoading || measurementsLoading,
    error: error || measurementsError,
    refetch,
    createControl: createControlMutation.mutateAsync,
    recordMeasurement: recordMeasurementMutation.mutateAsync,
    isCreating: createControlMutation.isPending,
  };
}