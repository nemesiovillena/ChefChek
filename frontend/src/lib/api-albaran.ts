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
  priceWithVat: number | null;
  /** Importe neto de la línea leído del papel (sin IVA, con descuento). null si el OCR no lo trajo. */
  totalPrice: number | null;
  /** Importe bruto de línea = cantidad × precio unidad (sin IVA, sin descuento). */
  lineAmount: number;
  matchStatus: MatchStatus;
  lineStatus: LineStatus;
  matchedProductId: string | null;
  matchedProduct: { id: string; name: string; netPrice: number; discountPercentage: number; purchasePrice: number } | null;
  confidence: number | null;
  /** Mejor candidato cuando NO hubo auto-match (MATCH_DUDOSO o NUEVO). Descartable con dismissSuggestion. */
  suggestedProductId: string | null;
  suggestedProduct: { id: string; name: string } | null;
  suggestionDismissed: boolean;
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
  /** Opt-in: al confirmar, aplicar el descuento de línea al precio de compra/escandallos. */
  applyDiscountToCost?: boolean;
  status: AlbaranStatus;
  warehouseId: string | null;
  warehouse: { id: string; name: string } | null;
  purchaseOrderId: string | null;
  purchaseOrder: { id: string; orderNumber: string; status: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: AlbaranLine[];
  _count?: { lines: number };
  /** Documento OCR crudo; extraction_method indica si extrajo la IA ('ai') o el fallback regex ('regex') */
  ocrRawData?: {
    extraction_method?: string;
    extraction_model?: string;
    confidence?: number;
    /** Nombre de proveedor tal como lo leyó el OCR, antes de intentar hacer match contra la BD */
    supplier_name?: string | null;
  } | null;
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
  const sessionId = localStorage.getItem('session_id');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`;
  const tenantSlug = localStorage.getItem('tenant_slug');
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;
  return headers;
}

/**
 * El backend envuelve los errores como {success:false, error:{message}} —
 * leer solo `message` a nivel raíz dejaba el mensaje real oculto y el
 * usuario veía siempre el texto genérico de cada llamada.
 */
function errorMessage(payload: unknown, fallback: string): string {
  const err = payload as { message?: string; error?: { message?: string } } | undefined;
  return err?.error?.message || err?.message || fallback;
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
    throw new Error(errorMessage(error, 'Error fetching albaranes'));
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
    throw new Error(errorMessage(error, 'Error fetching albaran'));
  }
  return response.json();
}

// Update albaran header
export async function updateAlbaran(
  id: string,
  data: {
    supplierId?: string;
    albaranNumber?: string;
    notes?: string;
    warehouseId?: string;
    /** Vincula un pedido de compra (conciliación); null para desvincular */
    purchaseOrderId?: string | null;
    /** Opt-in: aplicar el descuento de línea al coste al confirmar */
    applyDiscountToCost?: boolean;
  }
): Promise<Albaran> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error updating albaran' }));
    throw new Error(errorMessage(error, 'Error updating albaran'));
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
    throw new Error(errorMessage(error, 'Error updating status'));
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
    throw new Error(errorMessage(error, 'Error updating line'));
  }
  return response.json();
}

// Corregir el precio de una línea YA confirmada. No es una edición normal:
// el backend re-sincroniza oferta preferente, coste del artículo, histórico
// de precios y el pedido vinculado con el precio corregido.
export async function correctLinePrice(
  albaranId: string,
  lineId: string,
  data: { unitPrice: number; totalPrice?: number | null }
): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}/correct-price`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error correcting price' }));
    throw new Error(errorMessage(error, 'Error al corregir el precio'));
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
    throw new Error(errorMessage(error, 'Error matching line'));
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
    throw new Error(errorMessage(error, 'Error confirming line'));
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
    throw new Error(errorMessage(error, 'Error rejecting line'));
  }
  return response.json();
}

// Dismiss the auto-suggested product for a line (persists: won't resurface on re-match)
export async function dismissSuggestion(albaranId: string, lineId: string): Promise<AlbaranLine> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines/${lineId}/dismiss-suggestion`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error dismissing suggestion' }));
    throw new Error(errorMessage(error, 'Error dismissing suggestion'));
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
    throw new Error(errorMessage(error, 'Error deleting albaran'));
  }
}

export interface AlbaranDuplicateMatch {
  id: string;
  albaranNumber: string;
  date: string;
  status: AlbaranStatus;
  total: number;
}

/**
 * Advisory-only: comprueba si ya existe un albarán del mismo proveedor con
 * el mismo número. No bloquea el alta. El backend descarta números
 * autogenerados (MANUAL-/OCR-/FALLBACK-) para no avisar en falso cuando
 * todavía no hay número real.
 */
export async function checkAlbaranDuplicate(
  supplierId: string,
  albaranNumber: string,
  excludeId?: string,
): Promise<AlbaranDuplicateMatch | null> {
  const params = new URLSearchParams({ supplierId, albaranNumber });
  if (excludeId) params.append('excludeId', excludeId);
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/check-duplicate?${params.toString()}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json();
  return json.data ?? null;
}

/** Add a manual line to an existing albarán */
export async function addAlbaranLine(
  albaranId: string,
  data: { description: string; quantity: number; unit: string; unitPrice: number; vatPercent?: number; lot?: string },
): Promise<{ success: boolean; data: AlbaranLine }> {
  const response = await fetch(`${API_BASE_URL}/v1/albaranes/${albaranId}/lines`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error adding line' }));
    throw new Error(errorMessage(error, 'Error adding line'));
  }
  return response.json();
}
