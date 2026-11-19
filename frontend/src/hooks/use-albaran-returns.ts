'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAlbaranReturns,
  listPendingCreditNoteReturns,
  type AlbaranReturn,
  type PendingCreditNoteReturn,
} from '@/lib/api-albaran-returns';
import { getAuthHeaders } from '@/lib/api-albaran';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const albaranReturnsKey = (albaranId: string) => ['albaran', albaranId, 'returns'];

export function useAlbaranReturns(albaranId: string | undefined) {
  return useQuery<AlbaranReturn[], Error>({
    queryKey: albaranReturnsKey(albaranId ?? ''),
    queryFn: () => listAlbaranReturns(albaranId as string),
    enabled: !!albaranId,
  });
}

/** Devoluciones del proveedor que esperan un abono aparte (para enlazarlas al abono). */
export function usePendingCreditNoteReturns(supplierId: string | undefined, enabled: boolean) {
  return useQuery<PendingCreditNoteReturn[], Error>({
    queryKey: ['albaran-returns', 'pending-credit-notes', supplierId],
    queryFn: () => listPendingCreditNoteReturns(supplierId as string),
    enabled: !!supplierId && enabled,
  });
}

/**
 * Tras cualquier cambio en devoluciones: el detalle (líneas y totales), sus
 * devoluciones, el listado de albaranes y las incidencias SICTED.
 */
export function useInvalidateAlbaranReturns() {
  const queryClient = useQueryClient();
  return (albaranId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['albaran', albaranId] });
    void queryClient.invalidateQueries({ queryKey: ['albaranes'] });
    void queryClient.invalidateQueries({ queryKey: ['albaran-returns'] });
    void queryClient.invalidateQueries({ queryKey: ['sicted-supplier-incidents'] });
    void queryClient.invalidateQueries({ queryKey: ['sicted-supplier-compliance'] });
  };
}

/**
 * Abre el justificante en PDF en una pestaña nueva. `window.open` va síncrono
 * dentro del clic: iOS Safari bloquea aperturas posteriores a un `await`.
 */
export async function openReturnReceipt(
  albaranId: string,
  returnId: string,
  onError: (message: string) => void,
) {
  const win = window.open('', '_blank');
  if (!win) {
    onError('El navegador ha bloqueado la ventana: permite ventanas emergentes.');
    return;
  }
  win.document.write(
    '<!doctype html><html><head><title>Abriendo justificante…</title></head>' +
      '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#666">Abriendo justificante…</body></html>',
  );
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/albaranes/${albaranId}/returns/${returnId}/receipt`,
      { headers: getAuthHeaders() },
    );
    if (!response.ok) throw new Error('No se pudo generar el justificante');
    const blob = await response.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win.close();
    onError(err instanceof Error ? err.message : 'No se pudo generar el justificante');
  }
}
