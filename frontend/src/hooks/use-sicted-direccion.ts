'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  AssessmentScoreRow,
  CreateComplianceDocInput,
  CreateEventInput,
  CreateImprovementActionInput,
  CreateObjectiveInput,
  SictedAssessment,
  SictedComplianceDoc,
  SictedEvent,
  SictedImprovementAction,
  SictedObjective,
  SictedPractice,
  UpdateComplianceDocInput,
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
const EVENTS_KEY = 'sicted-events';
const COMPLIANCE_DOCS_KEY = 'sicted-compliance-docs';

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

// --- Eventos -------------------------------------------------------------------

export function useSictedEvents(kind?: string) {
  return useQuery<SictedEvent[], Error>({
    queryKey: [EVENTS_KEY, kind ?? 'all'],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/events`, { params: kind ? { kind } : undefined })).data,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation<SictedEvent, Error, CreateEventInput>({
    mutationFn: async ({ attachment, ...data }) => {
      const form = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) form.append(key, String(value));
      });
      if (attachment) form.append('attachment', attachment);
      return (await apiClient.post(`${BASE_URL}/events`, form)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

// --- Documentos legales ----------------------------------------------------------

export function useSictedComplianceDocs(includeArchived = false) {
  return useQuery<SictedComplianceDoc[], Error>({
    queryKey: [COMPLIANCE_DOCS_KEY, includeArchived],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/compliance-docs`, { params: { includeArchived } })).data,
  });
}

function toComplianceDocForm(data: CreateComplianceDocInput | UpdateComplianceDocInput) {
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === 'attachment') form.append('attachment', value as File);
    else form.append(key, String(value));
  });
  return form;
}

export function useCreateComplianceDoc() {
  const queryClient = useQueryClient();
  return useMutation<SictedComplianceDoc, Error, CreateComplianceDocInput>({
    mutationFn: async (data) =>
      (await apiClient.post(`${BASE_URL}/compliance-docs`, toComplianceDocForm(data))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPLIANCE_DOCS_KEY] }),
  });
}

export function useUpdateComplianceDoc() {
  const queryClient = useQueryClient();
  return useMutation<SictedComplianceDoc, Error, { id: string; data: UpdateComplianceDocInput }>({
    mutationFn: async ({ id, data }) =>
      (await apiClient.patch(`${BASE_URL}/compliance-docs/${id}`, toComplianceDocForm(data))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPLIANCE_DOCS_KEY] }),
  });
}

export function useArchiveComplianceDoc() {
  const queryClient = useQueryClient();
  return useMutation<SictedComplianceDoc, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/compliance-docs/${id}/archive`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPLIANCE_DOCS_KEY] }),
  });
}
