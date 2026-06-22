/**
 * Albaran API client — handles all albaran-related API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Types
export type AlbaranStatus = 'PENDIENTE' | 'REVISADO' | 'CONFIRMADO' | 'ARCHIVADO';
export type MatchStatus = 'NUEVO' | 'MATCH_ALTO' | 'MATCH_DUDOSO';
export type LineStatus = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO';

export interface AlbaranLine {
  id: string;
  articleNumber: string | null;
  lot: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatPercent: number;
  lineAmount: number;
  matchStatus: MatchStatus;
  lineStatus: LineStatus;
  matchedProductId: string | null;
  matchedProduct: { id: string; name: string; netPrice: number } | null;
  confidence: number | null;
}

export interface Albaran {
  id: string;
  tenantId: string;
  supplierId: string;
  supplier: { id: string; name: string; cifNif: string };
  albaranNumber: string;
  internalNumber: string | null;
  date: string;
  base: number;
  vatTotal: number;
  total: number;
  status: AlbaranStatus;
  warehouseId: string | null;
  warehouse: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: AlbaranLine[];
  _count?: { lines: number };
}

export interface AlbaranListResponse {
  data: Albaran[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AlbaranFilters {
  supplierId?: string;
  status?: AlbaranStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Auth headers
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const sessionId = sessionStorage.getItem('session_id');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
  const tenantSlug = sessionStorage.getItem('tenant_slug');
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;
  return headers;
}

// List albaranes with filters
export async function listAlbaranes(filters: AlbaranFilters = {}): Promise<AlbaranListResponse> {
  const params = new URLSearchParams();
  if (filters.supplierId) params.append('supplierId', filters.supplierId);
  if (filters.status) params.append('status', filters.status);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `${API_BASE_URL}/v1/albaranes${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error fetching albaranes' }));
    throw new Error(error.message || 'Error fetching albaranes');
  }
  return response.json();
}

// Get single albaran with lines
export async function getAlbaran(id: string): Promise<Albaran> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${id}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error fetching albaran' }));
    throw new Error(error.message || 'Error fetching albaran');
  }
  return response.json();
}

// Update albaran header
export async function updateAlbaran(
  id: string,
  data: { supplierId?: string; albaranNumber?: string; notes?: string; warehouseId?: string }
): Promise<Albaran> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error updating albaran' }));
    throw new Error(error.message || 'Error updating albaran');
  }
  return response.json();
}

// Update albaran status
export async function updateStatus(id: string, status: AlbaranStatus): Promise<Albaran> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error updating status' }));
    throw new Error(error.message || 'Error updating status');
  }
  return response.json();
}

// Update line
export async function updateLine(
  albaranId: string,
  lineId: string,
  data: {
    articleNumber?: string;
    lot?: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    matchedProductId?: string;
  }
): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error updating line' }));
    throw new Error(error.message || 'Error updating line');
  }
  return response.json();
}

// Match line to product
export async function matchLine(albaranId: string, lineId: string, productId: string): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}/match`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ productId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error matching line' }));
    throw new Error(error.message || 'Error matching line');
  }
  return response.json();
}

// Confirm line
export async function confirmLine(albaranId: string, lineId: string): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}/confirm`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error confirming line' }));
    throw new Error(error.message || 'Error confirming line');
  }
  return response.json();
}

// Reject line
export async function rejectLine(albaranId: string, lineId: string): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}/reject`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error rejecting line' }));
    throw new Error(error.message || 'Error rejecting line');
  }
  return response.json();
}

// Delete albaran
export async function deleteAlbaran(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error deleting albaran' }));
    throw new Error(error.message || 'Error deleting albaran');
  }
}
