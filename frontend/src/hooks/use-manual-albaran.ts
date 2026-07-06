import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ManualAlbaranLineInput {
  productId?: string | null;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  category?: string;
  categoryId?: string;
}

export interface ManualAlbaranInput {
  supplierId?: string;
  supplierName?: string;
  date: string;
  reference?: string;
  lines: ManualAlbaranLineInput[];
}

export function useCreateManualAlbaran() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ManualAlbaranInput) => {
      const response = await apiClient.post('/v1/albaranes/manual', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
