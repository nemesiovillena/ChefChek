'use client';

import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ImageSearchResult {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  sourcePage?: string;
}

/** Búsqueda de imágenes bajo demanda (disparada por el usuario, no cacheable por query). */
export function useProductImageSearch() {
  return useMutation<ImageSearchResult[], Error, string>({
    mutationFn: async (query: string) => {
      const response = await apiClient.get<ImageSearchResult[]>(
        `/v1/products/image-search?q=${encodeURIComponent(query)}`
      );
      return response.data;
    },
  });
}
