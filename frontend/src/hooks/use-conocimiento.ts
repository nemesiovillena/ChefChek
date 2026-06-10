import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ArticleResponse {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  authorId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateArticleData {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export function useConocimiento() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const response = await apiClient.get<ArticleResponse[]>('/v1/conocimiento');
      return response.data;
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: async (data: CreateArticleData) => {
      const response = await apiClient.post<ArticleResponse>('/v1/conocimiento', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateArticleData> }) => {
      const response = await apiClient.patch<ArticleResponse>(`/v1/conocimiento/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  return {
    articles: data || [],
    isLoading,
    error,
    refetch,
    createArticle: createArticleMutation.mutateAsync,
    updateArticle: updateArticleMutation.mutateAsync,
    isCreating: createArticleMutation.isPending,
  };
}