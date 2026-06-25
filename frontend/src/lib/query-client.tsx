'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { AxiosError } from 'axios';

let queryClient: QueryClient | null = null;

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: (failureCount, error: unknown) => {
          // Don't retry on 401 (auth errors) or 404 (not found)
          if (error instanceof AxiosError) {
            if (error.response?.status === 401 || error.response?.status === 404) {
              return false;
            }
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnReconnect: true, // Refetch on reconnect
      },
      mutations: {
        retry: (failureCount, error: unknown) => {
          // Don't retry on 401 (auth errors)
          if (error instanceof AxiosError && error.response?.status === 401) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        // Handle global query errors
        if (error instanceof Error) {
          console.error('Query error:', error.message);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        // Handle global mutation errors
        if (error instanceof Error) {
          console.error('Mutation error:', error.message);
        }
      },
    }),
  });
};

export function getQueryClient() {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}