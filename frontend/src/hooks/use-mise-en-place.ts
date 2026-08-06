import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { KitchenZone } from './use-production';

export type ChecklistCategory = 'EQUIPMENT' | 'INGREDIENTS' | 'TOOLS' | 'SANITATION';

export interface ChecklistItemInput {
  item: string;
  description: string;
  category: ChecklistCategory;
}

export interface MiseEnPlaceItem {
  id: string;
  orderId: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'VERIFIED';
  notes?: string | null;
  verifiedBy?: string | null;
}

export interface MiseEnPlaceSheet {
  id: string;
  tenantId: string;
  batchId: string;
  orderId: string;
  zone: KitchenZone;
  checklists: (ChecklistItemInput & { checked: boolean })[];
  completedAt?: string | null;
  verifiedBy?: string | null;
  items: MiseEnPlaceItem[];
}

export interface CreateMiseEnPlaceSheetInput {
  batchId: string;
  orderId: string;
  zone: KitchenZone;
  checklists: ChecklistItemInput[];
}

export interface AddMiseEnPlaceItemInput {
  orderId: string;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
}

/** Hoja de mise en place de una orden (0 o 1 — se busca por orderId, no hace
 * falta que el llamador conozca el sheetId). `sheet` es `null` si la orden
 * todavía no tiene hoja creada. */
export function useMiseEnPlaceSheet(orderId: string | null) {
  const queryClient = useQueryClient();

  const { data: sheet, isLoading } = useQuery({
    queryKey: ['mise-en-place-sheet', orderId],
    queryFn: async () => {
      const response = await apiClient.get<MiseEnPlaceSheet | null>(
        `/v1/production/orders/${orderId}/mise-en-place-sheet`,
      );
      return response.data;
    },
    enabled: !!orderId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mise-en-place-sheet', orderId] });
  };

  const createSheet = useMutation({
    mutationFn: async (input: CreateMiseEnPlaceSheetInput) => {
      const response = await apiClient.post<MiseEnPlaceSheet>('/v1/production/mise-en-place', input);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: async (input: AddMiseEnPlaceItemInput) => {
      const response = await apiClient.post<MiseEnPlaceItem>('/v1/production/mise-en-place/items', input);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: MiseEnPlaceItem['status'] }) => {
      const response = await apiClient.put<MiseEnPlaceItem>(
        `/v1/production/mise-en-place/items/${itemId}`,
        { status },
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  const verifySheet = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<MiseEnPlaceSheet>(
        `/v1/production/mise-en-place/${sheet?.id}/verify`,
      );
      return response.data;
    },
    onSuccess: invalidate,
  });

  return {
    sheet: sheet ?? null,
    isLoading,
    createSheet: createSheet.mutateAsync,
    isCreatingSheet: createSheet.isPending,
    addItem: addItem.mutateAsync,
    isAddingItem: addItem.isPending,
    updateItemStatus: updateItemStatus.mutateAsync,
    verifySheet: verifySheet.mutateAsync,
    isVerifying: verifySheet.isPending,
  };
}
