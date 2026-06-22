import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface TechnicalSheetResponse {
  id: string;
  name: string;
  description?: string;
  sheetNumber?: string;
  recipeId?: string;
  recipeName?: string;
  status: string;
  ingredients?: SheetIngredient[];
  temperatures?: SheetTemperature[];
  createdAt: string;
}

export interface SheetIngredient {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  temperature?: string;
  note?: string;
}

export interface SheetTemperature {
  id: string;
  step: string;
  minTemp?: number;
  maxTemp?: number;
  targetTemp?: number;
  duration?: number;
  note?: string;
}

export interface CreateSheetData {
  name: string;
  description?: string;
  sheetNumber?: string;
  recipeId?: string;
}

export function useTechnicalSheets() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['technical-sheets'],
    queryFn: async () => {
      const response = await apiClient.get<TechnicalSheetResponse[]>('/v1/technical-sheets');
      return response.data;
    },
  });

  const createSheetMutation = useMutation({
    mutationFn: async (data: CreateSheetData) => {
      const response = await apiClient.post<TechnicalSheetResponse>('/v1/technical-sheets', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-sheets'] });
    },
  });

  const updateSheetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateSheetData> }) => {
      const response = await apiClient.patch<TechnicalSheetResponse>(`/v1/technical-sheets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-sheets'] });
    },
  });

  return {
    sheets: data || [],
    isLoading,
    error,
    refetch,
    createSheet: createSheetMutation.mutateAsync,
    updateSheet: updateSheetMutation.mutateAsync,
    isCreating: createSheetMutation.isPending,
  };
}