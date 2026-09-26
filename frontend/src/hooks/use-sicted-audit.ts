'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { CoverageReport } from '@/lib/sicted-audit-types';

const BASE_URL = '/v1/sicted/audit';

export function useSictedCoverage(from: string, to: string) {
  return useQuery<CoverageReport, Error>({
    queryKey: ['sicted-coverage', from, to],
    queryFn: async () => (await apiClient.get(`${BASE_URL}/coverage`, { params: { from, to } })).data,
  });
}

/**
 * Abre un PDF/CSV generado en pestaña nueva (blob autenticado). `window.open`
 * síncrono dentro del gesto — mismo patrón verificado en iPhone que
 * `openSictedAttachment` (fase 4) y `openGeneratedPdf` (fichas técnicas):
 * iOS Safari bloquea en silencio cualquier apertura posterior a un `await`.
 */
export async function openSictedAuditDownload(
  path: string,
  params: Record<string, string | undefined>,
  mime: string,
  onBlocked: () => void,
) {
  const win = window.open('', '_blank');
  if (!win) {
    onBlocked();
    return;
  }
  win.document.write(
    '<!doctype html><html><head><title>Generando…</title></head>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Generando…</body></html>',
  );
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => !!v));
  const response = await apiClient.get(`${BASE_URL}${path}`, { params: clean, responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: mime }));
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
