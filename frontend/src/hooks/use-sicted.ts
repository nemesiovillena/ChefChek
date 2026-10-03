'use client';

import { useMemo } from 'react';
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
const MY_AREAS_KEY = 'sicted-my-areas';

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

/**
 * Guarda el orden del listado del Plan (ids en el orden nuevo). Actualiza la caché al momento
 * para que la fila no "salte" de vuelta mientras responde el servidor; si falla, recarga.
 */
export function useReorderSictedTemplates() {
  const queryClient = useQueryClient();
  const key = [TEMPLATES_KEY, null];
  return useMutation<unknown, Error, ChecklistTemplate[]>({
    mutationFn: async (ordered) =>
      apiClient.post(`${BASE_URL}/templates/reorder`, { ids: ordered.map((t) => t.id) }),
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, ordered);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] }),
  });
}

export interface SictedTemplatesImportResult {
  created: { id: string; name: string }[];
  skipped: string[];
}

/** Alta en bloque desde un archivo del Plan exportado en otro tenant. */
export function useImportSictedTemplates() {
  const invalidate = useInvalidateTemplates();
  return useMutation<SictedTemplatesImportResult, Error, ChecklistTemplateInput[]>({
    mutationFn: async (templates) => (await apiClient.post(`${BASE_URL}/templates/import`, { templates })).data,
    onSuccess: invalidate,
  });
}

// --- Hojas (el Registro) ---------------------------------------------------

export function useSictedRunsToday(enabled = true) {
  return useQuery<ChecklistRunSummary[], Error>({
    queryKey: [RUNS_TODAY_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/runs/today`)).data,
    enabled,
  });
}

/** Áreas que le tocan al usuario por su ficha de puesto; vacío = ve todas (encargados, cuentas compartidas, sin puesto). */
export function useSictedMyAreas() {
  return useQuery<string[], Error>({
    queryKey: [MY_AREAS_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/my-areas`)).data,
  });
}

export interface SictedRunsFilters {
  from?: string;
  to?: string;
  templateId?: string;
  status?: string;
  area?: string;
}

export function useSictedRuns(filters: SictedRunsFilters, enabled = true) {
  return useQuery<ChecklistRunSummary[], Error>({
    queryKey: [RUNS_KEY, filters],
    queryFn: async () => {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
      return (await apiClient.get(`${BASE_URL}/runs`, { params: clean })).data;
    },
    enabled,
  });
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Ventanas de los avisos: una hoja sin validar se sigue avisando un mes; las vencidas, una semana. */
const PENDING_VALIDATION_DAYS = 30;
const OVERDUE_DAYS = 7;

/**
 * Estado de SICTED para el dashboard y la portada: hojas de hoy (y cuántas faltan),
 * hojas terminadas sin validar de los últimos 30 días (no solo de hoy) y hojas vencidas sin completar.
 */
export function useSictedStatus(enabled = true) {
  const { validationFrom, overdueFrom } = useMemo(
    () => ({ validationFrom: daysAgoIso(PENDING_VALIDATION_DAYS), overdueFrom: daysAgoIso(OVERDUE_DAYS) }),
    [],
  );
  const today = useSictedRunsToday(enabled);
  const completed = useSictedRuns({ status: 'COMPLETED', from: validationFrom }, enabled);
  const overdue = useSictedRuns({ status: 'INCOMPLETE', from: overdueFrom }, enabled);

  const runsToday = today.data ?? [];
  return {
    runsToday,
    pendingToday: runsToday.filter((r) => r.status === 'OPEN'),
    pendingValidation: (completed.data ?? []).filter((r) => r.snapshot.requiresSupervisor && !r.supervisedAt),
    // Justificada por el encargado = ya gestionada: deja de avisarse.
    overdue: (overdue.data ?? []).filter((r) => !r.supervisedAt),
    isLoading: today.isLoading || completed.isLoading || overdue.isLoading,
  };
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
    { runId: string; supervisorName: string; supervisorUserId?: string; supervisorNote?: string }
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
