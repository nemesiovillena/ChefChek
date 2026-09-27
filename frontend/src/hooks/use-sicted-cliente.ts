'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CreateFeedbackInput,
  CreateLostItemInput,
  CreateSatisfactionSampleInput,
  Feedback,
  FeedbackOverdueReport,
  LostItem,
  SatisfactionMonthlySummary,
  SatisfactionSample,
} from '@/lib/sicted-cliente-types';

const BASE_URL = '/v1/sicted/clientes';
const FEEDBACK_KEY = 'sicted-feedback';
const OVERDUE_KEY = 'sicted-feedback-overdue';
const SATISFACTION_KEY = 'sicted-satisfaction';
const SATISFACTION_SUMMARY_KEY = 'sicted-satisfaction-summary';
const LOST_ITEMS_KEY = 'sicted-lost-items';

// --- Feedback (quejas/sugerencias/felicitaciones) -----------------------------

export function useSictedFeedback(status?: string) {
  return useQuery<Feedback[], Error>({
    queryKey: [FEEDBACK_KEY, status ?? null],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/feedback`, { params: status ? { status } : {} })).data,
  });
}

export function useSictedFeedbackOverdue() {
  return useQuery<FeedbackOverdueReport, Error>({
    queryKey: [OVERDUE_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/feedback/overdue`)).data,
  });
}

function useInvalidateFeedback() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [FEEDBACK_KEY] });
    queryClient.invalidateQueries({ queryKey: [OVERDUE_KEY] });
  };
}

export function useCreateSictedFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation<Feedback, Error, CreateFeedbackInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/feedback`, data)).data,
    onSuccess: invalidate,
  });
}

export function useRespondSictedFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation<Feedback, Error, { id: string; response: string; respondedByName: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE_URL}/feedback/${id}/respond`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCloseSictedFeedback() {
  const invalidate = useInvalidateFeedback();
  return useMutation<Feedback, Error, { id: string; improvementActionId?: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE_URL}/feedback/${id}/close`, data)).data,
    onSuccess: invalidate,
  });
}

// --- Satisfacción --------------------------------------------------------------

export function useSictedSatisfaction() {
  return useQuery<SatisfactionSample[], Error>({
    queryKey: [SATISFACTION_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/satisfaction`)).data,
  });
}

export function useSictedSatisfactionSummary(year: number, month: number) {
  return useQuery<SatisfactionMonthlySummary, Error>({
    queryKey: [SATISFACTION_SUMMARY_KEY, year, month],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/satisfaction/monthly-summary`, { params: { year, month } })).data,
  });
}

export function useCreateSictedSatisfaction() {
  const queryClient = useQueryClient();
  return useMutation<SatisfactionSample, Error, CreateSatisfactionSampleInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/satisfaction`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SATISFACTION_KEY] });
      queryClient.invalidateQueries({ queryKey: [SATISFACTION_SUMMARY_KEY] });
    },
  });
}

// --- Objetos perdidos ------------------------------------------------------------

export function useSictedLostItems(onlyPending?: boolean) {
  return useQuery<LostItem[], Error>({
    queryKey: [LOST_ITEMS_KEY, onlyPending ?? false],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/lost-items`, { params: onlyPending ? { onlyPending: 'true' } : {} })).data,
  });
}

function useInvalidateLostItems() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [LOST_ITEMS_KEY] });
}

export function useCreateSictedLostItem() {
  const invalidate = useInvalidateLostItems();
  return useMutation<LostItem, Error, CreateLostItemInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/lost-items`, data)).data,
    onSuccess: invalidate,
  });
}

export function useReturnSictedLostItem() {
  const invalidate = useInvalidateLostItems();
  return useMutation<LostItem, Error, { id: string; returnedTo: string }>({
    mutationFn: async ({ id, returnedTo }) => (await apiClient.post(`${BASE_URL}/lost-items/${id}/return`, { returnedTo })).data,
    onSuccess: invalidate,
  });
}
