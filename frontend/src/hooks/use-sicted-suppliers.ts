'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CreateInventorySnapshotInput,
  CreateSupplierIncidentInput,
  InventorySnapshot,
  InventorySnapshotSummary,
  ProcurementEvidenceReport,
  SupplierComplianceProfile,
  SupplierIncident,
  UpsertSupplierComplianceInput,
} from '@/lib/sicted-supplier-types';

const BASE_URL = '/v1/sicted/suppliers';
const COMPLIANCE_KEY = 'sicted-supplier-compliance';
const INCIDENTS_KEY = 'sicted-supplier-incidents';
const INVENTORY_KEY = 'sicted-inventory-snapshots';
const EVIDENCE_KEY = 'sicted-procurement-evidence';

// --- Perfil de cumplimiento (PROV.1) -----------------------------------------

export function useSictedSupplierCompliances() {
  return useQuery<SupplierComplianceProfile[], Error>({
    queryKey: [COMPLIANCE_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/compliance`)).data,
  });
}

export function useUpsertSictedSupplierCompliance() {
  const queryClient = useQueryClient();
  return useMutation<
    SupplierComplianceProfile,
    Error,
    { supplierId: string; data: UpsertSupplierComplianceInput }
  >({
    mutationFn: async ({ supplierId, data }) =>
      (await apiClient.post(`${BASE_URL}/compliance/${supplierId}`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY] }),
  });
}

// --- Incidencias de recepción (PROV.3) ---------------------------------------

export function useSictedSupplierIncidents(supplierId?: string) {
  return useQuery<SupplierIncident[], Error>({
    queryKey: [INCIDENTS_KEY, supplierId ?? null],
    queryFn: async () =>
      (await apiClient.get(`${BASE_URL}/incidents`, { params: supplierId ? { supplierId } : {} })).data,
  });
}

function useInvalidateSictedSupplierIncidents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
}

export function useCreateSictedSupplierIncident() {
  const invalidate = useInvalidateSictedSupplierIncidents();
  return useMutation<SupplierIncident, Error, CreateSupplierIncidentInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/incidents`, data)).data,
    onSuccess: invalidate,
  });
}

export function useResolveSictedSupplierIncident() {
  const invalidate = useInvalidateSictedSupplierIncidents();
  return useMutation<SupplierIncident, Error, { id: string; resolution: string }>({
    mutationFn: async ({ id, resolution }) =>
      (await apiClient.post(`${BASE_URL}/incidents/${id}/resolve`, { resolution })).data,
    onSuccess: invalidate,
  });
}

// --- Inventario semestral (PROV.7) -------------------------------------------

export function useSictedInventorySnapshots() {
  return useQuery<InventorySnapshotSummary[], Error>({
    queryKey: [INVENTORY_KEY],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/inventory`)).data,
  });
}

export function useSictedInventorySnapshot(id: string | null) {
  return useQuery<InventorySnapshot, Error>({
    queryKey: [INVENTORY_KEY, id],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/inventory/${id}`)).data,
    enabled: !!id,
  });
}

export function useGenerateSictedInventorySnapshot() {
  const queryClient = useQueryClient();
  return useMutation<InventorySnapshot, Error, CreateInventorySnapshotInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE_URL}/inventory`, data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INVENTORY_KEY] }),
  });
}

// --- Evidencia de aprovisionamiento -------------------------------------------

export function useSictedProcurementEvidence(from: string, to: string) {
  return useQuery<ProcurementEvidenceReport, Error>({
    queryKey: [EVIDENCE_KEY, from, to],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/evidence`, { params: { from, to } })).data,
  });
}
