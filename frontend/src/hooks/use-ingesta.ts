import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface IngestaResponse {
  id: string;
  image?: string;
  recognizedProducts?: string[];
  processedAt: string;
  status: string;
}

export interface CreateIngestaData {
  image?: string;
}

export function useIngesta() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ingesta'],
    queryFn: async () => {
      const response = await apiClient.get<IngestaResponse[]>('/v1/ingesta');
      return response.data;
    },
  });

  const createIngestaMutation = useMutation({
    mutationFn: async (data: CreateIngestaData) => {
      const response = await apiClient.post<IngestaResponse>('/v1/ingesta', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingesta'] });
    },
  });

  const processIngestaMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<IngestaResponse>(`/v1/ingesta/${id}/process`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingesta'] });
    },
  });

  return {
    ingestaEntries: data || [],
    isLoading,
    error,
    refetch,
    createIngesta: createIngestaMutation.mutateAsync,
    processIngesta: processIngestaMutation.mutateAsync,
    isCreating: createIngestaMutation.isPending,
  };
}