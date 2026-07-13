'use client';

import { useMutation } from '@tanstack/react-query';
import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';
import { apiClient } from '@/lib/api-client';
import { downloadBlob } from '@/lib/utils';

export interface BackupFileMeta {
  id: string;
  scope: 'TENANT' | 'GLOBAL';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  kind: 'EXPORT' | 'RESTORE';
  type: 'MANUAL' | 'AUTO_PRE_RESTORE' | 'AUTO_SCHEDULED';
  format: string;
  filename: string | null;
  fileSizeBytes: string | null;
  rowCount: number | null;
  checksum: string | null;
  schemaVersion: number;
  sourceBackupId: string | null;
  notes: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BackupJobStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  step: string;
  error: string | null;
  kind: 'EXPORT' | 'RESTORE';
  scope: 'TENANT' | 'GLOBAL';
}

/** Base URL según rol: SUPERADMIN opera a nivel global. */
const SUPERADMIN_BASE = '/v1/superadmin/backups';
const TENANT_BASE = '/v1/backups';

export function backupBaseUrl(isSuperadmin: boolean): string {
  return isSuperadmin ? SUPERADMIN_BASE : TENANT_BASE;
}

/** Lista las copias EXPORT (manuales + auto-pre-restore). */
export function useBackups(baseUrl: string) {
  return useApiQuery<BackupFileMeta[]>(['backups', baseUrl], baseUrl);
}

/** Dispara la generación asíncrona de una copia (export). */
export function useCreateBackup(baseUrl: string) {
  const invalidate = useInvalidateQueries();
  return useApiMutation<{ id: string; status: string }, { notes?: string }>(
    baseUrl,
    'POST',
    { onSuccess: () => invalidate([['backups', baseUrl]]) },
  );
}

/** Borra una copia (archivo + registro). Construye la URL con el id:
 * la factoría genérica useApiMutation ignora `variables` en su rama DELETE,
 * por lo que hay que inyectar el id en la ruta manualmente (como useCrud.useDelete). */
export function useDeleteBackup(baseUrl: string) {
  const invalidate = useInvalidateQueries();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${baseUrl}/${id}`);
    },
    onSuccess: () => invalidate([['backups', baseUrl]]),
  });
}

/**
 * Estado en vivo de un job (export o restore) vía polling. Deja de refetchar
 * cuando llega a COMPLETED/FAILED. Patrón nuevo en la app (no había polling).
 */
export function useBackupJob(baseUrl: string, id: string | null) {
  return useApiQuery<BackupJobStatus>(
    ['backup-job', baseUrl, id ?? ''],
    id ? `${baseUrl}/${id}/status` : '',
    {
      enabled: !!id,
      refetchInterval: (query) =>
        query.state.data?.status === 'COMPLETED' ||
        query.state.data?.status === 'FAILED'
          ? false
          : 1200,
    },
  );
}

/** Restaura desde una copia existente (URL `:id/restore`). Wrapper manual. */
export function useRestoreExistingById(baseUrl: string) {
  const invalidate = useInvalidateQueries();
  return {
    mutateAsync: async (id: string) => {
      const res = await apiClient.post<{
        id: string;
        preBackupId: string;
        status: string;
      }>(`${baseUrl}/${id}/restore`, {});
      invalidate([['backups', baseUrl]]);
      return res.data;
    },
  };
}

/**
 * Restaura desde un archivo .json subido. onUploadProgress real (axios) para la
 * barra de subida. El llamador pasa un callback de progreso.
 */
export function restoreFromFile(
  baseUrl: string,
  file: File,
  onProgress: (pct: number) => void,
  invalidate: (keys: string[][]) => void,
): Promise<{ id: string; preBackupId: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiClient
    .post<{ id: string; preBackupId: string }>(`${baseUrl}/restore`, form, {
      onUploadProgress: (e) =>
        onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    })
    .then((res) => {
      invalidate([['backups', baseUrl]]);
      return res.data;
    });
}

/** Descarga el archivo de una copia (blob) al navegador. */
export async function downloadBackup(baseUrl: string, id: string, filename: string) {
  const res = await apiClient.get(`${baseUrl}/${id}/download`, {
    responseType: 'blob',
  });
  downloadBlob(filename, res.data as Blob);
}
