'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  JobProfile,
  JobProfileInput,
  Protocol,
  ProtocolAckMatrixRow,
  ProtocolInput,
  ProtocolWithContent,
  TrainingAction,
  TrainingActionInput,
  TrainingAttendance,
  TrainingCoverageReport,
  TrainingPlan,
  TrainingPlanStatus,
  UnassignedUser,
} from '@/lib/sicted-personas-types';

const BASE_URL = '/v1/sicted/personas';
const JOB_PROFILES_KEY = 'sicted-job-profiles';
const UNASSIGNED_KEY = 'sicted-unassigned-users';
const TRAINING_PLANS_KEY = 'sicted-training-plans';
const TRAINING_ACTIONS_KEY = 'sicted-training-actions';
const ATTENDANCE_KEY = 'sicted-training-attendance';
const COVERAGE_KEY = 'sicted-training-coverage';
const PROTOCOLS_KEY = 'sicted-protocols';
const PENDING_PROTOCOLS_KEY = 'sicted-protocols-pending';
const PROTOCOL_MATRIX_KEY = 'sicted-protocols-matrix';

// --- Fichas de puesto ---------------------------------------------------------

export function useSictedJobProfiles() {
  return useQuery<JobProfile[], Error>({
    queryKey: [JOB_PROFILES_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/job-profiles`)).data,
  });
}

export function useSictedUnassignedUsers() {
  return useQuery<UnassignedUser[], Error>({
    queryKey: [UNASSIGNED_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/job-profiles/unassigned-users`)).data,
  });
}

function useInvalidateJobProfiles() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [JOB_PROFILES_KEY] });
    queryClient.invalidateQueries({ queryKey: [UNASSIGNED_KEY] });
  };
}

export function useCreateSictedJobProfile() {
  const invalidate = useInvalidateJobProfiles();
  return useMutation<JobProfile, Error, JobProfileInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/job-profiles`, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSictedJobProfile() {
  const invalidate = useInvalidateJobProfiles();
  return useMutation<JobProfile, Error, { id: string; data: JobProfileInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.put(`${BASE_URL}/job-profiles/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveSictedJobProfile() {
  const invalidate = useInvalidateJobProfiles();
  return useMutation<JobProfile, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/job-profiles/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

export function useAssignSictedJobProfile() {
  const invalidate = useInvalidateJobProfiles();
  return useMutation<unknown, Error, { profileId: string; userId: string }>({
    mutationFn: async ({ profileId, userId }) =>
      (await apiClient.post(`${BASE_URL}/job-profiles/${profileId}/assign`, { userId })).data,
    onSuccess: invalidate,
  });
}

// --- Formación -----------------------------------------------------------------

export function useSictedTrainingPlans() {
  return useQuery<TrainingPlan[], Error>({
    queryKey: [TRAINING_PLANS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/training/plans`)).data,
  });
}

export function useCreateSictedTrainingPlan() {
  const queryClient = useQueryClient();
  return useMutation<TrainingPlan, Error, number>({
    mutationFn: async (year) => (await apiClient.post(`${BASE_URL}/training/plans`, { year })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TRAINING_PLANS_KEY] }),
  });
}

export function useUpdateSictedTrainingPlanStatus() {
  const queryClient = useQueryClient();
  return useMutation<TrainingPlan, Error, { id: string; status: TrainingPlanStatus }>({
    mutationFn: async ({ id, status }) =>
      (await apiClient.patch(`${BASE_URL}/training/plans/${id}/status`, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TRAINING_PLANS_KEY] }),
  });
}

export function useSictedTrainingCoverage(year: number) {
  return useQuery<TrainingCoverageReport, Error>({
    queryKey: [COVERAGE_KEY, year],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/training/coverage`, { params: { year } })).data,
  });
}

export function useSictedTrainingActions(planId: string | null) {
  return useQuery<TrainingAction[], Error>({
    queryKey: [TRAINING_ACTIONS_KEY, planId],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/training/plans/${planId}/actions`)).data,
    enabled: !!planId,
  });
}

function useInvalidateTrainingActions() {
  const queryClient = useQueryClient();
  return (planId: string) => {
    queryClient.invalidateQueries({ queryKey: [TRAINING_ACTIONS_KEY, planId] });
    queryClient.invalidateQueries({ queryKey: [COVERAGE_KEY] });
  };
}

export function useCreateSictedTrainingAction() {
  const invalidate = useInvalidateTrainingActions();
  return useMutation<TrainingAction, Error, { planId: string; data: TrainingActionInput }>({
    mutationFn: async ({ planId, data }) =>
      (await apiClient.post(`${BASE_URL}/training/plans/${planId}/actions`, data)).data,
    onSuccess: (_data, { planId }) => invalidate(planId),
  });
}

export function useMarkSictedTrainingActionDone() {
  const invalidate = useInvalidateTrainingActions();
  return useMutation<TrainingAction, Error, { id: string; planId: string }>({
    mutationFn: async ({ id }) => (await apiClient.post(`${BASE_URL}/training/actions/${id}/done`)).data,
    onSuccess: (_data, { planId }) => invalidate(planId),
  });
}

export function useSictedAttendance(actionId: string | null) {
  return useQuery<TrainingAttendance[], Error>({
    queryKey: [ATTENDANCE_KEY, actionId],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/training/actions/${actionId}/attendance`)).data,
    enabled: !!actionId,
  });
}

export interface RecordAttendanceInput {
  actionId: string;
  planId: string;
  attendees: { userId: string; attended: boolean }[];
  certificate?: File;
}

export function useRecordSictedAttendance() {
  const queryClient = useQueryClient();
  const invalidateActions = useInvalidateTrainingActions();
  return useMutation<TrainingAttendance[], Error, RecordAttendanceInput>({
    mutationFn: async ({ actionId, attendees, certificate }) => {
      const form = new FormData();
      form.append('attendees', JSON.stringify(attendees));
      if (certificate) form.append('certificate', certificate);
      return (await apiClient.post(`${BASE_URL}/training/actions/${actionId}/attendance`, form)).data;
    },
    onSuccess: (_data, { actionId, planId }) => {
      queryClient.invalidateQueries({ queryKey: [ATTENDANCE_KEY, actionId] });
      invalidateActions(planId);
    },
  });
}

// --- Protocolos ------------------------------------------------------------------

export function useSictedProtocols() {
  return useQuery<Protocol[], Error>({
    queryKey: [PROTOCOLS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/protocols`)).data,
  });
}

export function useSictedProtocol(id: string | null) {
  return useQuery<ProtocolWithContent, Error>({
    queryKey: [PROTOCOLS_KEY, id],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/protocols/${id}`)).data,
    enabled: !!id,
  });
}

export function useSictedPendingProtocols() {
  return useQuery<Protocol[], Error>({
    queryKey: [PENDING_PROTOCOLS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/protocols/pending-for-me`)).data,
  });
}

export function useSictedProtocolMatrix() {
  return useQuery<ProtocolAckMatrixRow[], Error>({
    queryKey: [PROTOCOL_MATRIX_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/protocols/matrix`)).data,
  });
}

function useInvalidateProtocols() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [PROTOCOLS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PENDING_PROTOCOLS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PROTOCOL_MATRIX_KEY] });
  };
}

export function useCreateSictedProtocol() {
  const invalidate = useInvalidateProtocols();
  return useMutation<Protocol, Error, ProtocolInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/protocols`, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSictedProtocolMeta() {
  const invalidate = useInvalidateProtocols();
  return useMutation<Protocol, Error, { id: string; data: Partial<ProtocolInput> }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE_URL}/protocols/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function usePublishSictedProtocolVersion() {
  const invalidate = useInvalidateProtocols();
  return useMutation<Protocol, Error, { id: string; body?: string; knowledgeArticleId?: string }>({
    mutationFn: async ({ id, ...data }) =>
      (await apiClient.post(`${BASE_URL}/protocols/${id}/publish-version`, data)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveSictedProtocol() {
  const invalidate = useInvalidateProtocols();
  return useMutation<Protocol, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/protocols/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

export function useAckSictedProtocol() {
  const invalidate = useInvalidateProtocols();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/protocols/${id}/ack`)).data,
    onSuccess: invalidate,
  });
}
