'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { AxiosError } from 'axios';

let queryClient: QueryClient | null = null;

// 4xx son errores deterministas (validación, permisos, not found...):
// reintentar nunca los arregla, solo cuelga el botón ~7s (backoff
// exponencial x3) antes de mostrar el error real. Solo vale la pena
// reintentar fallos de red o 5xx, que sí pueden ser transitorios.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      return false;
    }
  }
  return failureCount < 3;
};

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: shouldRetry,
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnReconnect: true, // Refetch on reconnect
      },
      mutations: {
        retry: shouldRetry,
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