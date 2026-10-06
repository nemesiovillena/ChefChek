/** Tipos del módulo Cuiner (conector con el TPV y la gestión de Cuiner). */

export type CuinerMode = 'DRY_RUN' | 'LIVE';
export type CuinerExportStatus = 'PENDIENTE' | 'SIMULADO' | 'ENVIADO' | 'ERROR';
export type CuinerDishTipo = 'P' | 'I' | 'M';

export interface CuinerConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  mode: CuinerMode;
  empresa: string;
  centro: string;
  almacen: string;
  actUsuario: string | null;
  warehouseId: string | null;
  hasConnectorToken: boolean;
  lastVentasCabId: number;
  lastSeenAt: string | null;
}

export interface CuinerStatus {
  config: CuinerConfig | null;
  catalog: { suppliers: number; articles: number; articleSuppliers: number; dishes: number };
  sales: Partial<Record<'PENDIENTE' | 'APLICADA' | 'SIN_MAPEO' | 'IGNORADA', number>>;
}

export interface UpdateCuinerConfigInput {
  enabled?: boolean;
  mode?: CuinerMode;
  centro?: string;
  almacen?: string;
  actUsuario?: string | null;
  warehouseId?: string | null;
}

export interface CuinerCodeRef {
  codigo: string;
  nombre: string;
}

export interface CuinerSuggestion extends CuinerCodeRef {
  reason: 'cif' | 'nombre';
}

export interface CuinerSupplierRow {
  supplierId: string;
  name: string;
  cifNif: string | null;
  mapped: CuinerCodeRef | null;
  suggestion: CuinerSuggestion | null;
}

export interface CuinerProductRow {
  productId: string;
  name: string;
  mapped: CuinerCodeRef | null;
  suggestion: CuinerSuggestion | null;
}

export interface CuinerDishRow {
  tipo: CuinerDishTipo;
  producto: string;
  nombre: string;
  sold: number;
  mapped: { kind: 'recipe' | 'product'; id: string; name: string } | null;
}

export interface CuinerPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CuinerCatalogHit {
  codigo: string;
  nombre: string;
  detalle: string | null;
}

export interface CuinerDocLine {
  articulo: string;
  descripcion: string;
  unidades: number;
  importe: number;
  descuentoP: number;
  base: number;
  costeUM: number;
  tipoIva: string;
  iva: number;
}

export interface CuinerAlbaranPayload {
  codigo: string;
  centro: string;
  fecha: string;
  numdoc: string | null;
  lineas: CuinerDocLine[];
  sumas: { tipoIva: number; base: number; cuota: number }[];
  total: number;
}

export interface CuinerExportPreview {
  problems: string[];
  payload: CuinerAlbaranPayload | null;
}

export interface CuinerAlbaranExport {
  id: string;
  albaranId: string;
  status: CuinerExportStatus;
  cuinerIdDocsCab: number | null;
  error: string | null;
  attempts: number;
  requestedAt: string;
  processedAt: string | null;
  payload: CuinerAlbaranPayload;
}

export const CUINER_EXPORT_STATUS_LABELS: Record<CuinerExportStatus, string> = {
  PENDIENTE: 'Pendiente del conector',
  SIMULADO: 'Simulado (no escrito)',
  ENVIADO: 'Enviado a Cuiner',
  ERROR: 'Error',
};

export const CUINER_DISH_TIPO_LABELS: Record<CuinerDishTipo, string> = {
  P: 'Platos',
  M: 'Menús',
  I: 'Ingredientes / extras',
};
