'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ChecklistAsset,
  ChecklistAssetInput,
  ChecklistIncident,
  ChecklistMaintenancePlan,
  ChecklistMaintenancePlanInput,
  ChecklistMaintenanceRecord,
  CreateChecklistIncidentInput,
  UpdateChecklistIncidentInput,
} from '@/lib/sicted-maintenance-types';

const BASE_URL = '/v1/sicted/maintenance';
const ASSETS_KEY = 'sicted-assets';
const PLANS_KEY = 'sicted-maintenance-plans';
const RECORDS_KEY = 'sicted-maintenance-records';
const INCIDENTS_KEY = 'sicted-incidents';

// --- Equipos ---------------------------------------------------------------

export function useSictedAssets(category?: string) {
  return useQuery<ChecklistAsset[], Error>({
    queryKey: [ASSETS_KEY, category ?? null],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/assets`, { params: category ? { category } : {} })).data,
  });
}

function useInvalidateAssets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [ASSETS_KEY] });
}

export function useCreateSictedAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation<ChecklistAsset, Error, ChecklistAssetInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/assets`, data)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSictedAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation<ChecklistAsset, Error, { id: string; data: ChecklistAssetInput & { isActive?: boolean } }>({
    mutationFn: async ({ id, data }) => (await apiClient.put(`${BASE_URL}/assets/${id}`, data)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveSictedAsset() {
  const invalidate = useInvalidateAssets();
  return useMutation<ChecklistAsset, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/assets/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

export function useSeedSictedStarterAssets() {
  const invalidate = useInvalidateAssets();
  return useMutation<ChecklistAsset[], Error, void>({
    mutationFn: async () => (await apiClient.post(`${BASE_URL}/assets/starter`)).data,
    onSuccess: invalidate,
  });
}

// --- Planes de revisión ------------------------------------------------------

export function useSictedMaintenancePlans(assetId?: string) {
  return useQuery<ChecklistMaintenancePlan[], Error>({
    queryKey: [PLANS_KEY, assetId ?? null],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/plans`, { params: assetId ? { assetId } : {} })).data,
  });
}

function useInvalidatePlans() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
}

export function useCreateSictedMaintenancePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation<ChecklistMaintenancePlan, Error, ChecklistMaintenancePlanInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/plans`, data)).data,
    onSuccess: invalidate,
  });
}

export function useArchiveSictedMaintenancePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation<ChecklistMaintenancePlan, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE_URL}/plans/${id}/archive`)).data,
    onSuccess: invalidate,
  });
}

// --- Registros ---------------------------------------------------------------

export function useSictedMaintenanceRecords(planId: string | null) {
  return useQuery<ChecklistMaintenanceRecord[], Error>({
    queryKey: [RECORDS_KEY, planId],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/plans/${planId}/records`)).data,
    enabled: !!planId,
  });
}

/** Invalida registros + planes (una revisión recalcula nextDueAt del plan). */
function useInvalidateRecords() {
  const queryClient = useQueryClient();
  return (planId: string) => {
    queryClient.invalidateQueries({ queryKey: [RECORDS_KEY, planId] });
    queryClient.invalidateQueries({ queryKey: [PLANS_KEY] });
  };
}

export interface CreateMaintenanceRecordInput {
  planId: string;
  performedByName: string;
  performedAt?: string;
  providerName?: string;
  cost?: number;
  notes?: string;
  files: File[];
}

export function useCreateSictedMaintenanceRecord() {
  const invalidate = useInvalidateRecords();
  return useMutation<ChecklistMaintenanceRecord, Error, CreateMaintenanceRecordInput>({
    mutationFn: async ({ planId, files, ...fields }) => {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) form.append(key, String(value));
      });
      files.forEach((file) => form.append('files', file));
      return (await apiClient.post(`${BASE_URL}/plans/${planId}/records`, form)).data;
    },
    onSuccess: (_data, { planId }) => invalidate(planId),
  });
}

/**
 * Abre un adjunto en pestaña nueva (blob autenticado). `window.open` debe ir
 * síncrono dentro del gesto de clic — iOS Safari bloquea en silencio
 * cualquier apertura posterior a un `await` (ver `openGeneratedPdf` en
 * `dashboard/recipes/page.tsx`, mismo patrón placeholder+blob verificado en
 * iPhone real).
 */
export async function openSictedAttachment(
  recordId: string,
  index: number,
  attachment: { name: string; mime: string },
  onBlocked: () => void,
) {
  const win = window.open('', '_blank');
  if (!win) {
    onBlocked();
    return;
  }
  win.document.write(
    '<!doctype html><html><head><title>Abriendo adjunto…</title></head>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Abriendo adjunto…</body></html>',
  );
  const response = await apiClient.get(`${BASE_URL}/records/${recordId}/attachments/${index}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: attachment.mime }));
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// --- Incidencias ---------------------------------------------------------------

export function useSictedIncidents(filters: { status?: string; kind?: string; assetId?: string } = {}) {
  return useQuery<ChecklistIncident[], Error>({
    queryKey: [INCIDENTS_KEY, filters],
    queryFn: async () => {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => !!v));
      return (await apiClient.get(`${BASE_URL}/incidents`, { params: clean })).data;
    },
  });
}

export function useSictedIncident(id: string | null) {
  return useQuery<ChecklistIncident, Error>({
    queryKey: [INCIDENTS_KEY, id],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/incidents/${id}`)).data,
    enabled: !!id,
  });
}

function useInvalidateIncidents() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
    if (id) queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY, id] });
  };
}

export function useCreateSictedIncident() {
  const invalidate = useInvalidateIncidents();
  return useMutation<ChecklistIncident, Error, CreateChecklistIncidentInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/incidents`, data)).data,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSictedIncident() {
  const invalidate = useInvalidateIncidents();
  return useMutation<ChecklistIncident, Error, { id: string; data: UpdateChecklistIncidentInput }>({
    mutationFn: async ({ id, data }) => (await apiClient.patch(`${BASE_URL}/incidents/${id}`, data)).data,
    onSuccess: (_data, { id }) => invalidate(id),
  });
}
