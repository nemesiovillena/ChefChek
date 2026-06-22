import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface DigitalMenuResponse {
  id: string;
  name: string;
  description?: string;
  qrCode?: string;
  isActive: boolean;
  menuId?: string;
  views: number;
  clicks: number;
  createdAt: string;
}

export interface CreateDigitalMenuData {
  name: string;
  description?: string;
  menuId?: string;
  isActive?: boolean;
}

export function useDigitalMenus() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['digital-menus'],
    queryFn: async () => {
      const response = await apiClient.get<DigitalMenuResponse[]>('/v1/digital-menu');
      return response.data;
    },
  });

  const createDigitalMenuMutation = useMutation({
    mutationFn: async (data: CreateDigitalMenuData) => {
      const response = await apiClient.post<DigitalMenuResponse>('/v1/digital-menu', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-menus'] });
    },
  });

  const updateDigitalMenuMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateDigitalMenuData> }) => {
      const response = await apiClient.patch<DigitalMenuResponse>(`/v1/digital-menu/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-menus'] });
    },
  });

  return {
    digitalMenus: data || [],
    isLoading,
    error,
    refetch,
    createDigitalMenu: createDigitalMenuMutation.mutateAsync,
    updateDigitalMenu: updateDigitalMenuMutation.mutateAsync,
    isCreating: createDigitalMenuMutation.isPending,
  };
}