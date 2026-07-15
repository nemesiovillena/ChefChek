'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';

export interface SmtpPublicConfig {
  configured: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from?: string;
  hasPassword?: boolean;
}

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string; // omitir para conservar el guardado
  from?: string;
}

const BASE_URL = '/v1/compras/smtp';
const QUERY_KEY = ['smtp-config'];

export function useSmtpConfig() {
  return useApiQuery<SmtpPublicConfig>(QUERY_KEY, BASE_URL);
}

export function useSaveSmtpConfig() {
  const queryClient = useQueryClient();
  return useMutation<SmtpPublicConfig, Error, SmtpConfigInput>({
    mutationFn: async (data) => (await apiClient.put(BASE_URL, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useTestSmtp() {
  return useMutation<{ sentTo: string }, Error, { to?: string }>({
    mutationFn: async (data) =>
      (await apiClient.post(`${BASE_URL}/test`, data)).data,
  });
}
