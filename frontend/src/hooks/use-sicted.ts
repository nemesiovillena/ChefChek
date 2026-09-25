'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ChecklistEntryInput,
  ChecklistPerformer,
  ChecklistRunDetail,
  ChecklistRunSummary,
  ChecklistTemplate,
  ChecklistTemplateInput,
} from '@/lib/sicted-types';

const BASE_URL = '/v1/sicted/checklists';
const TEMPLATES_KEY = 'sicted-templates';
const RUNS_TODAY_KEY = 'sicted-runs-today';
const RUNS_KEY = 'sicted-runs';
const RUN_KEY = 'sicted-run';
const PERFORMERS_KEY = 'sicted-performers';

// --- Plantillas (el Plan) -------------------------------------------------

export function useSictedTemplates(area?: string) {
  return useQuery<ChecklistTemplate[], Error>({
    queryKey: [TEMPLATES_KEY, area ?? null],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/templates`, { params: area ? { area } : {} })).data,
  });
}

function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
}

export function useCreateSictedTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation<ChecklistTemplate, Error, ChecklistTemplateInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/templates`, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSictedTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation<ChecklistTemplate, Error, { id: string; data: ChecklistTemplateInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.put(`${BASE_URL}/templates/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveSictedTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation<ChecklistTemplate, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/templates/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

export function useSeedSictedStarterTemplates() {
  const invalidate = useInvalidateTemplates();
  return useMutation<ChecklistTemplate[], Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE_URL}/templates/starter`)).data,
    onSuccess: invalidate,
  });
}

// --- Hojas (el Registro) ---------------------------------------------------

export function useSictedRunsToday() {
  return useQuery<ChecklistRunSummary[], Error>({
    queryKey: [RUNS_TODAY_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/runs/today`)).data,
  });
}

export interface SictedRunsFilters {
  from?: string;
  to?: string;
  templateId?: string;
  status?: string;
  area?: string;
}

export function useSictedRuns(filters: SictedRunsFilters) {
  return useQuery<ChecklistRunSummary[], Error>({
    queryKey: [RUNS_KEY, filters],
    queryFn: async () => {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
      return (await apiClient.get(`${BASE_URL}/runs`, { params: clean })).data;
    },
  });
}

export function useSictedRun(id: string | null) {
  return useQuery<ChecklistRunDetail, Error>({
    queryKey: [RUN_KEY, id],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/runs/${id}`)).data,
    enabled: !!id,
  });
}

/**
 * Detalle (con marcas) de varias hojas a la vez — usado por la matriz mensual
 * para pintar celdas por ítem/día. `listRuns` solo trae el recuento; el
 * detalle real hace falta por hoja, así que se piden en paralelo (acotado por
 * el propio rango de fechas del selector de mes, nunca todo el histórico).
 */
export function useSictedRunsDetails(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: [RUN_KEY, id],
      queryFn: async () => (await apiClient.get<ChecklistRunDetail>(`${BASE_URL}/runs/${id}`)).data,
    })),
    combine: (results) => ({
      data: results.map((r) => r.data).filter((d): d is ChecklistRunDetail => !!d),
      isLoading: results.some((r) => r.isLoading),
    }),
  });
}

/** Invalida hoy + listado + el detalle de la hoja tocada (patrón albaranes). */
function useInvalidateRuns() {
  const queryClient = useQueryClient();
  return (runId: string) => {
    queryClient.invalidateQueries({ queryKey: [RUNS_TODAY_KEY] });
    queryClient.invalidateQueries({ queryKey: [RUNS_KEY] });
    queryClient.invalidateQueries({ queryKey: [RUN_KEY, runId] });
  };
}

export function useAddSictedEntries() {
  const invalidate = useInvalidateRuns();
  return useMutation<ChecklistRunDetail, Error, { runId: string; entries: ChecklistEntryInput[] }>({
    mutationFn: async ({ runId, entries }) =>
      (await apiClient.post(`${BASE_URL}/runs/${runId}/entries`, { entries })).data,
    onSuccess: (_data, { runId }) => invalidate(runId),
  });
}

export function useSuperviseSictedRun() {
  const invalidate = useInvalidateRuns();
  return useMutation<
    ChecklistRunDetail,
    Error,
    { runId: string; supervisorName: string; supervisorNote?: string }
  >({
    mutationFn: async ({ runId, ...data }) =>
      (await apiClient.post(`${BASE_URL}/runs/${runId}/supervise`, data)).data,
    onSuccess: (_data, { runId }) => invalidate(runId),
  });
}

export function useSictedPerformers() {
  return useQuery<ChecklistPerformer[], Error>({
    queryKey: [PERFORMERS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/performers`)).data,
    staleTime: 5 * 60 * 1000,
  });
}
