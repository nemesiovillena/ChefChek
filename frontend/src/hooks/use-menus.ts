import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface MenusResponse {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateMenuData {
  name: string;
  description?: string;
}

export function useMenus() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['menus'],
    queryFn: async () => {
      const response = await apiClient.get<MenusResponse[]>('/v1/menus');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateMenuData) => {
      const response = await apiClient.post<MenusResponse>('/v1/menus', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
    },
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    createMenu: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}