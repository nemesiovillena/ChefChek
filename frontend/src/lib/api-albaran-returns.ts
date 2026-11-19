/**
 * Devoluciones al proveedor de un albarán: las anota quien recibe (al subir la
 * foto o desde una línea) y oficina las aplica a una línea, que genera una
 * línea negativa debajo de la original.
 */
import { errorMessage, getAuthHeaders } from './api-albaran';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type AlbaranReturnStatus = 'PENDIENTE' | 'APLICADA' | 'DESCARTADA';
export type AlbaranReturnSettlement = 'IN_ALBARAN' | 'CREDIT_NOTE';

export interface AlbaranReturn {
  id: string;
  albaranId: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  reason: string;
  reportedByName: string;
  reportedAt: string;
  status: AlbaranReturnStatus;
  settlement: AlbaranReturnSettlement | null;
  discardNote: string | null;
  lineId: string | null;
  appliedLineId: string | null;
  creditNoteLineId: string | null;
  creditNoteSettledAt: string | null;
  sictedIncidentId: string | null;
}

export interface PendingCreditNoteReturn extends AlbaranReturn {
  albaran: { id: string; albaranNumber: string | null; internalNumber: string; date: string };
}

export interface NewAlbaranReturn {
  description: string;
  quantity?: number;
  unit?: string;
  reason: string;
  reportedByName?: string;
  /** Con lineId + settlement se aplica en el acto (botón «Devolver» de la línea). */
  lineId?: string;
  settlement?: AlbaranReturnSettlement;
}

/** Motivos habituales; «Otro» deja escribir uno libre. */
export const RETURN_REASONS = [
  'Roto en reparto',
  'Mal estado',
  'Temperatura',
  'Caducado',
  'No pedido',
] as const;

export const SETTLEMENT_LABELS: Record<AlbaranReturnSettlement, string> = {
  IN_ALBARAN: 'Descontado en este albarán',
  CREDIT_NOTE: 'Abono aparte',
};

async function request<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes${path}`, {
    ...init,
    headers: getAuthHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload, fallback));
  }
  return (payload?.data ?? payload) as T;
}

export const listAlbaranReturns = (albaranId: string) =>
  request<AlbaranReturn[]>(`/${albaranId}/returns`, { method: 'GET' }, 'No se pudieron cargar las devoluciones');

export const createAlbaranReturn = (albaranId: string, data: NewAlbaranReturn) =>
  request<AlbaranReturn>(
    `/${albaranId}/returns`,
    { method: 'POST', body: JSON.stringify(data) },
    'No se pudo anotar la devolución',
  );

export const applyAlbaranReturn = (
  albaranId: string,
  returnId: string,
  data: { lineId: string; quantity: number; settlement: AlbaranReturnSettlement },
) =>
  request<AlbaranReturn>(
    `/${albaranId}/returns/${returnId}/apply`,
    { method: 'POST', body: JSON.stringify(data) },
    'No se pudo aplicar la devolución',
  );

export const unapplyAlbaranReturn = (albaranId: string, returnId: string) =>
  request<AlbaranReturn>(
    `/${albaranId}/returns/${returnId}/unapply`,
    { method: 'POST' },
    'No se pudo deshacer la devolución',
  );

export const discardAlbaranReturn = (albaranId: string, returnId: string, note: string) =>
  request<AlbaranReturn>(
    `/${albaranId}/returns/${returnId}/discard`,
    { method: 'POST', body: JSON.stringify({ note }) },
    'No se pudo descartar la devolución',
  );

export const listPendingCreditNoteReturns = (supplierId: string) =>
  request<PendingCreditNoteReturn[]>(
    `/returns/pending-credit-notes?supplierId=${encodeURIComponent(supplierId)}`,
    { method: 'GET' },
    'No se pudieron cargar las devoluciones pendientes de abono',
  );

export const coverAlbaranReturn = (albaranId: string, lineId: string, returnId: string | null) =>
  request<AlbaranReturn | null>(
    `/${albaranId}/lines/${lineId}/cover-return`,
    { method: 'PUT', body: JSON.stringify({ returnId }) },
    'No se pudo enlazar el abono',
  );

/** «1 ud», «2,5 kilo»: cantidad con coma decimal y unidad. */
export function formatReturnQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  return `${String(quantity).replace('.', ',')}${unit ? ` ${unit}` : ''}`;
}
