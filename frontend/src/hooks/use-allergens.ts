import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface AllergenResponse {
  id: number;
  name: string;
  nameEu1169?: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  productsCount?: number;
  createdAt: string;
}

export interface CreateAllergenData {
  name: string;
  nameEu1169?: string;
  description?: string;
  icon?: string;
}

export function useAllergens() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['allergens'],
    queryFn: async () => {
      const response = await apiClient.get<AllergenResponse[]>('/v1/allergens');
      return response.data;
    },
  });

  const createAllergenMutation = useMutation({
    mutationFn: async (data: CreateAllergenData) => {
      const response = await apiClient.post<AllergenResponse>('/v1/allergens', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
    },
  });

  const updateAllergenMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateAllergenData> }) => {
      const response = await apiClient.patch<AllergenResponse>(`/v1/allergens/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergens'] });
    },
  });

  return {
    allergens: data || [],
    isLoading,
    error,
    refetch,
    createAllergen: createAllergenMutation.mutateAsync,
    updateAllergen: updateAllergenMutation.mutateAsync,
    isCreating: createAllergenMutation.isPending,
  };
}