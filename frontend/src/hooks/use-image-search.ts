'use client';

import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ImageSearchResult {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  sourcePage?: string;
}

/**
 * Búsqueda de imágenes de stock bajo demanda (disparada por el usuario, no
 * cacheable por query). El endpoint vive bajo /products pero es una búsqueda
 * Pexels genérica por texto, sin lógica de producto — reutilizable en Recetas.
 */
export function useImageSearch() {
  return useMutation<ImageSearchResult[], Error, string>({
    mutationFn: async (query: string) => {
      const response = await apiClient.get<ImageSearchResult[]>(
        `/v1/products/image-search?q=${encodeURIComponent(query)}`
      );
      return response.data;
    },
  });
}
