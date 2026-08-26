import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface TechnicalSheetDocument {
  id: string;
  name: string;
  recipeId?: string;
  templateId?: string;
  version: number;
  createdAt: string;
  fileSize: number;
  fileFormat: 'PDF' | 'DOCX';
  url: string;
}

/**
 * Fichas técnicas ya generadas. El backend no tiene CRUD de "sheets": cada
 * fila es el registro de un PDF generado vía /generate (el PDF en sí no se
 * persiste, solo su metadata), igual que el botón "Ficha" en Recetas.
 */
export function useTechnicalSheets() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['technical-sheets'],
    queryFn: async () => {
      const response = await apiClient.get<TechnicalSheetDocument[]>(
        '/v1/technical-sheets/documents',
        { params: { type: 'TECHNICAL_SHEET' } },
      );
      return response.data;
    },
  });

  const generateSheetMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const response = await apiClient.post(
        '/v1/technical-sheets/generate',
        { recipeId, includeAllergens: true, includeCosts: true },
        { responseType: 'blob' },
      );
      return response.data as Blob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-sheets'] });
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/v1/technical-sheets/documents/${documentId}`);
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
    generateSheet: generateSheetMutation.mutateAsync,
    isGenerating: generateSheetMutation.isPending,
    deleteSheet: deleteSheetMutation.mutateAsync,
  };
}
