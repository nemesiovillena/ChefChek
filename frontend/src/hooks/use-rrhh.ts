'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useApiQuery } from './use-api';
import type {
  EmployeeDocument,
  EmployeeDocumentUpload,
  EmployeeRequest,
  EmployeeRequestInput,
  OwnProfile,
  OwnRequestItem,
} from '@/lib/rrhh-types';

const BASE = '/v1/rrhh';
const ROOT = ['rrhh'];

// El interceptor de apiClient desenvuelve { success, data }: `.data` ya es la entidad.

function useInvalidateRrhh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ROOT });
}

/** Mis datos. Falla (403) si la cuenta no tiene ficha de empleado. */
export function useOwnProfile(enabled = true) {
  return useApiQuery<OwnProfile>([...ROOT, 'me', 'profile'], `${BASE}/me/profile`, { enabled, retry: false });
}

/** Todas mis solicitudes: cambios de datos, correcciones de fichaje y ausencias. */
export function useOwnRequests(enabled = true) {
  return useApiQuery<OwnRequestItem[]>([...ROOT, 'me', 'requests'], `${BASE}/me/requests`, { enabled, retry: false });
}

export function useCreateOwnRequest() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeRequest, Error, EmployeeRequestInput>({
    mutationFn: async (data) => (await apiClient.post(`${BASE}/me/requests`, data)).data,
    onSuccess: invalidate,
  });
}

export function useCancelOwnRequest() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeRequest, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE}/me/requests/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
}

/** Bandeja de gerencia: cambios de datos y peticiones libres pendientes. */
export function usePendingEmployeeRequests(enabled = true) {
  return useApiQuery<EmployeeRequest[]>([...ROOT, 'requests', 'pending'], `${BASE}/requests`, { enabled });
}

export function useDecideEmployeeRequest() {
  const qc = useQueryClient();
  return useMutation<EmployeeRequest, Error, { id: string; approve: boolean; note?: string }>({
    mutationFn: async ({ id, ...data }) => (await apiClient.post(`${BASE}/requests/${id}/decision`, data)).data,
    // Un cambio aprobado toca la cuenta de Equipo y la ficha de Fichar.
    onSuccess: () =>
      Promise.all([ROOT, ['check-in'], ['users']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

// ─────────────────────────────────────────────────── Documentación laboral

/** Mis documentos laborales. */
export function useOwnDocuments(enabled = true) {
  return useApiQuery<EmployeeDocument[]>([...ROOT, 'me', 'documents'], `${BASE}/me/documents`, { enabled, retry: false });
}

/** Subir un justificante propio. */
export function useUploadOwnDocument() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeDocument, Error, { title: string; file: File }>({
    mutationFn: async ({ title, file }) => {
      const form = new FormData();
      form.append('title', title);
      form.append('file', file);
      return (await apiClient.post(`${BASE}/me/documents`, form)).data;
    },
    onSuccess: invalidate,
  });
}

/** Acuse de lectura: queda registrado y no se puede deshacer. */
export function useAckDocument() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeDocument, Error, string>({
    mutationFn: async (id) => (await apiClient.post(`${BASE}/me/documents/${id}/ack`)).data,
    onSuccess: invalidate,
  });
}

/** Documentos de todo el equipo o de una persona. Solo gerencia. */
export function useEmployeeDocuments(employeeId: string | null, enabled = true) {
  return useApiQuery<EmployeeDocument[]>(
    [...ROOT, 'documents', employeeId ?? 'all'],
    `${BASE}/documents${employeeId ? `?employeeId=${employeeId}` : ''}`,
    { enabled },
  );
}

/** Gerencia sube un documento para una o varias personas. */
export function useUploadEmployeeDocument() {
  const invalidate = useInvalidateRrhh();
  return useMutation<EmployeeDocument[], Error, EmployeeDocumentUpload>({
    mutationFn: async (data) => {
      const form = new FormData();
      form.append('employeeIds', data.employeeIds.join(','));
      form.append('category', data.category);
      form.append('title', data.title);
      // En multipart todo viaja como texto.
      form.append('requiresAck', String(data.requiresAck));
      if (data.expiresAt) form.append('expiresAt', data.expiresAt);
      form.append('file', data.file);
      return (await apiClient.post(`${BASE}/documents`, form)).data;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveEmployeeDocument() {
  const invalidate = useInvalidateRrhh();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/documents/${id}`);
    },
    onSuccess: invalidate,
  });
}

/**
 * Abre un documento en una pestaña nueva. La pestaña se abre antes de pedir
 * el fichero: iOS bloquea cualquier `window.open` posterior a un `await`.
 * `scope` "own" usa la ruta del titular; "team", la de gerencia.
 */
export async function openEmployeeDocument(
  scope: 'own' | 'team',
  document: { id: string; mimeType: string },
  onBlocked: () => void,
) {
  const win = window.open('', '_blank');
  if (!win) {
    onBlocked();
    return;
  }
  win.document.write(
    '<!doctype html><html><head><title>Abriendo documento…</title></head>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Abriendo documento…</body></html>',
  );
  try {
    const url = `${BASE}/${scope === 'own' ? 'me/documents' : 'documents'}/${document.id}/file`;
    const response = await apiClient.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(new Blob([response.data], { type: document.mimeType }));
    win.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    win.close();
    throw error;
  }
}
