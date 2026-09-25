'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  AssessmentScoreRow,
  SictedAssessment,
  SictedPractice,
  UpdatePracticeInput,
  UpsertScoreInput,
} from '@/lib/sicted-direccion-types';

const BASE_URL = '/v1/sicted/direccion';
const PRACTICES_KEY = 'sicted-practices';
const ASSESSMENTS_KEY = 'sicted-assessments';
const SCORES_KEY = 'sicted-assessment-scores';
const PENDING_KEY = 'sicted-assessment-pending-mandatory';

// --- Catálogo --------------------------------------------------------------

export function useSictedPractices() {
  return useQuery<SictedPractice[], Error>({
    queryKey: [PRACTICES_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/practices`)).data,
  });
}

export function useSeedSictedCatalog() {
  const queryClient = useQueryClient();
  return useMutation<SictedPractice[], Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE_URL}/practices/seed`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PRACTICES_KEY] }),
  });
}

export function useUpdateSictedPractice() {
  const queryClient = useQueryClient();
  return useMutation<SictedPractice, Error, { id: string; data: UpdatePracticeInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE_URL}/practices/${id}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PRACTICES_KEY] }),
  });
}

// --- Autoevaluación --------------------------------------------------------

export function useSictedAssessments() {
  return useQuery<SictedAssessment[], Error>({
    queryKey: [ASSESSMENTS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/assessments`)).data,
  });
}

export function useCreateSictedAssessment() {
  const queryClient = useQueryClient();
  return useMutation<SictedAssessment, Error, string>({
    mutationFn: async (label) => (await apiClient.post(`${BASE_URL}/assessments`, { label })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ASSESSMENTS_KEY] }),
  });
}

export function useSictedAssessmentScores(assessmentId: string | null) {
  return useQuery<AssessmentScoreRow[], Error>({
    queryKey: [SCORES_KEY, assessmentId],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/assessments/${assessmentId}/scores`)).data,
    enabled: !!assessmentId,
  });
}

export function useSictedPendingMandatory(assessmentId: string | null) {
  return useQuery<AssessmentScoreRow[], Error>({
    queryKey: [PENDING_KEY, assessmentId],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/assessments/${assessmentId}/pending-mandatory`)).data,
    enabled: !!assessmentId,
  });
}

export function useUpsertSictedScore() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { assessmentId: string; practiceId: string; data: UpsertScoreInput }>({
    mutationFn: async ({ assessmentId, practiceId, data }) =>
      (await apiClient.post(`${BASE_URL}/assessments/${assessmentId}/scores/${practiceId}`, data)).data,
    onSuccess: (_data, { assessmentId }) => {
      queryClient.invalidateQueries({ queryKey: [SCORES_KEY, assessmentId] });
      queryClient.invalidateQueries({ queryKey: [PENDING_KEY, assessmentId] });
    },
  });
}

export function useCloseSictedAssessment() {
  const queryClient = useQueryClient();
  return useMutation<SictedAssessment, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/assessments/${id}/close`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ASSESSMENTS_KEY] }),
  });
}
