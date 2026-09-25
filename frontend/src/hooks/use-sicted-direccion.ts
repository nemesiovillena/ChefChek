'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  AssessmentScoreRow,
  CreateImprovementActionInput,
  CreateObjectiveInput,
  SictedAssessment,
  SictedImprovementAction,
  SictedObjective,
  SictedPractice,
  UpdateImprovementActionInput,
  UpdateObjectiveInput,
  UpdatePracticeInput,
  UpsertScoreInput,
} from '@/lib/sicted-direccion-types';

const BASE_URL = '/v1/sicted/direccion';
const PRACTICES_KEY = 'sicted-practices';
const ASSESSMENTS_KEY = 'sicted-assessments';
const SCORES_KEY = 'sicted-assessment-scores';
const PENDING_KEY = 'sicted-assessment-pending-mandatory';
const IMPROVEMENT_ACTIONS_KEY = 'sicted-improvement-actions';
const OBJECTIVES_KEY = 'sicted-objectives';

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

export function useGenerateImprovementActionsFromAssessment() {
  const queryClient = useQueryClient();
  return useMutation<SictedImprovementAction[], Error, string>({
    mutationFn: async (assessmentId) =>
      (await apiClient.post(`${BASE_URL}/assessments/${assessmentId}/generate-actions`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [IMPROVEMENT_ACTIONS_KEY] }),
  });
}

// --- Plan de mejora ----------------------------------------------------------

export function useSictedImprovementActions(status?: string) {
  return useQuery<SictedImprovementAction[], Error>({
    queryKey: [IMPROVEMENT_ACTIONS_KEY, status ?? 'all'],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/improvement-actions`, { params: status ? { status } : undefined })).data,
  });
}

export function useCreateImprovementAction() {
  const queryClient = useQueryClient();
  return useMutation<SictedImprovementAction, Error, CreateImprovementActionInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/improvement-actions`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [IMPROVEMENT_ACTIONS_KEY] }),
  });
}

export function useUpdateImprovementAction() {
  const queryClient = useQueryClient();
  return useMutation<SictedImprovementAction, Error, { id: string; data: UpdateImprovementActionInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE_URL}/improvement-actions/${id}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [IMPROVEMENT_ACTIONS_KEY] }),
  });
}

// --- Objetivos anuales ---------------------------------------------------------

export function useSictedObjectives(year?: number) {
  return useQuery<SictedObjective[], Error>({
    queryKey: [OBJECTIVES_KEY, year ?? 'all'],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/objectives`, { params: year ? { year } : undefined })).data,
  });
}

export function useCreateObjective() {
  const queryClient = useQueryClient();
  return useMutation<SictedObjective, Error, CreateObjectiveInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/objectives`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OBJECTIVES_KEY] }),
  });
}

export function useUpdateObjective() {
  const queryClient = useQueryClient();
  return useMutation<SictedObjective, Error, { id: string; data: UpdateObjectiveInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE_URL}/objectives/${id}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [OBJECTIVES_KEY] }),
  });
}
