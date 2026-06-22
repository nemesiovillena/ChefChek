import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime: number;
  reliabilityScore: number;
  priceTier: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus: 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED';
  orderMethods: string[];
  isActive: boolean;
}

interface UpdateSupplierDto {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  averageDeliveryTime?: number;
  reliabilityScore?: number;
  priceTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredStatus?: 'PREFERRED' | 'ALTERNATIVE' | 'EXCLUDED';
  orderMethods?: string[];
  isActive?: boolean;
}

/** Strip empty strings and NaN from payload before sending */
function cleanPayload(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) continue;
    if (typeof value === 'number' && Number.isNaN(value)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSupplierDto) => {
      const cleaned = cleanPayload({ ...data });
      const res = await apiClient.post('/v1/products/suppliers', cleaned);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSupplierDto }) => {
      const cleaned = cleanPayload({ ...data });
      const res = await apiClient.put(`/v1/products/suppliers/${id}`, cleaned);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/products/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    },
    onError: (error: any) => {
      // El error se maneja en el UI, no devolvemos nada aquí
    }
  });
}

export function useToggleSupplierActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.put(`/v1/products/suppliers/${id}`, { isActive });
      return res.data;
    },
    onMutate: async ({ id, isActive }) => {
      // Actualización optimista: actualizar el estado local inmediatamente
      await queryClient.cancelQueries({ queryKey: ['suppliers'] });

      const previousData = queryClient.getQueryData(['suppliers']);

      queryClient.setQueryData(['suppliers'], (old: any) => {
        if (!old) return old;
        return old.map((supplier: any) =>
          supplier.id === id ? { ...supplier, isActive } : supplier
        );
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revertir al estado anterior si hay error
      if (context?.previousData) {
        queryClient.setQueryData(['suppliers'], context.previousData);
      }
    },
    onSettled: () => {
      // Invalidar queries después de completar
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', 'stats'] });
    },
  });
}

export type { CreateSupplierDto, UpdateSupplierDto };
