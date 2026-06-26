'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';
import apiClient from '@/lib/api-client';
import { ApiError, PaginatedResponse } from '@/types/api.types';

/** Extract a human-readable message from an axios error, falling back to a default. */
function resolveErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return (
      error.response?.data?.message ||
      error.message ||
      fallback
    );
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

// Query hook factory
export function useApiQuery<T>(
  key: string[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error, T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: async (): Promise<T> => {
      try {
        const response = await apiClient.get<T>(url);
        return response.data;
      } catch (error: unknown) {
        throw new Error(resolveErrorMessage(error, 'Error desconocido'));
      }
    },
    ...options,
  });
}

// Mutation hook factory
export function useApiMutation<TData, TVariables>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  options?: Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn'
  >
) {

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables): Promise<TData> => {
      try {
        let response: AxiosResponse<TData>;
        if (method === 'DELETE') {
          response = await apiClient.delete<TData>(url);
        } else if (method === 'POST') {
          response = await apiClient.post<TData>(url, variables);
        } else if (method === 'PUT') {
          response = await apiClient.put<TData>(url, variables);
        } else {
          response = await apiClient.patch<TData>(url, variables);
        }
        return response.data;
      } catch (error: unknown) {
        throw new Error(resolveErrorMessage(error, 'Error desconocido'));
      }
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      // Let specific hooks handle invalidation
      // This hook is generic and doesn't know the query structure
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

// Paginated query hook - NOTE: Backend uses meta internally, doesn't require page/pageSize params
export function usePaginatedQuery<T>(
  key: string[],
  url: string,
  _page: number = 1,
  _pageSize: number = 50,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<T>, Error, PaginatedResponse<T>>,
    'queryKey' | 'queryFn'
  >
) {
  return useApiQuery<PaginatedResponse<T>>(
    key,
    url,
    options
  );
}

// CRUD hooks factory
export function useCrud<T, TCreate = Partial<T>, TUpdate = Partial<T>>(
  baseUrl: string,
  queryKey: string[]
) {
  // Get all (paginated)
  const useList = (page: number = 1, pageSize: number = 50) =>
    usePaginatedQuery<T>(queryKey, baseUrl, page, pageSize);

  // Get by ID
  const useGet = (id: string, options?: UseQueryOptions<T, Error, T>) =>
    useQuery<T, Error>({
      queryKey: [...queryKey, id],
      queryFn: async () => {
        const response = await apiClient.get<T>(`${baseUrl}/${id}`);
        return response.data;
      },
      ...options,
    });

  // Create
  const useCreate = (options?: UseMutationOptions<T, Error, TCreate>) => {
    const queryClient = useQueryClient();

    return useMutation<T, Error, TCreate>({
      mutationFn: async (data) => {
        const response = await apiClient.post<T>(baseUrl, data);
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
      ...options,
    });
  };

  // Update
  const useUpdate = (options?: UseMutationOptions<T, Error, TUpdate & { id: string }>) => {
    const queryClient = useQueryClient();

    return useMutation<T, Error, TUpdate & { id: string }>({
      mutationFn: async ({ id, ...data }) => {
        const response = await apiClient.patch<T>(`${baseUrl}/${id}`, data);
        return response.data;
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: [...queryKey, variables.id] });
      },
      ...options,
    });
  };

  // Delete
  const useDelete = (options?: UseMutationOptions<void, Error, string>) => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
      mutationFn: async (id) => {
        await apiClient.delete(`${baseUrl}/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
      ...options,
    });
  };

  return {
    useList,
    useGet,
    useCreate,
    useUpdate,
    useDelete,
  };
}

// Helper to invalidate related queries - call this within a component
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return (keys: string[][]) => {
    keys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  };
}

// Helper to prefetch queries - call this within a component
export function usePrefetchQuery<T>() {
  const queryClient = useQueryClient();

  return (key: string[], url: string) => {
    return queryClient.prefetchQuery<T, Error>({
      queryKey: key,
      queryFn: async (): Promise<T> => {
        const response = await apiClient.get<T>(url);
        return response.data;
      },
    });
  };
}