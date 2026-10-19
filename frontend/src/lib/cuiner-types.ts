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
  sales: Partial<Record<'PENDIENTE' | 'APLICADA' | 'SIN_MAPEO' | 'IGNORADA' | 'HISTORICO', number>>;
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
  mapped:
    | { kind: 'recipe'; id: string; name: string }
    | {
        kind: 'product';
        id: string;
        name: string;
        referenceUnit: string;
        servingMeasure: Pick<ServingMeasure, 'id' | 'name' | 'quantity' | 'unit'> | null;
      }
    | null;
}

/** Lo que sale de un artículo en cada venta: chupito 4 cl, caña 20 cl, café 7 g. */
export interface ServingMeasure {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** Palabras del nombre del plato en el TPV que delatan la medida. */
  keywords: string[];
  /** Platos enlazados que la usan. */
  linkedDishes: number;
}

/** Artículo propuesto o elegido en el asistente de enlace masivo. */
export interface CuinerBulkProduct {
  id: string;
  name: string;
  referenceUnit: string;
  categoryName: string | null;
  avgUnitWeight?: number | null;
}

/** Platos «MARCA + MEDIDA» sin enlazar que comparten marca (BARCELO …). */
export interface CuinerBulkGroup {
  brand: string;
  dishes: { tipo: CuinerDishTipo; producto: string; nombre: string; sold: number }[];
  sold: number;
  suggestedProduct: CuinerBulkProduct | null;
  /** Todas las palabras de la marca están en el nombre del artículo. */
  exactMatch: boolean;
}

export type ServingMeasureInput = Pick<ServingMeasure, 'name' | 'quantity' | 'unit' | 'keywords'>;

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

export interface CuinerSalesPreview {
  pendingLines: number;
  linesToApply: number;
  linesUnmapped: number;
  consumption: { productId: string; name: string; unit: string; formats: number }[];
  unmappedDishes: { tipo: CuinerDishTipo; producto: string; nombre: string; unidades: number }[];
  warnings: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

// ─── Informe de ventas ──────────────────────────────────────────────────────

export type SalesReportGroupBy = 'day' | 'week' | 'month' | 'year' | 'total';
export type SalesReportFormat = 'xlsx' | 'csv' | 'pdf';

export interface SalesReportQuery {
  from: string;
  to: string;
  groupBy: SalesReportGroupBy;
  /** 1 familia, 2 subfamilia, 3 sección, 4 plato. */
  level: number;
  /** Ruta de familia a la que se ha bajado («BEBIDAS ALCOHOL-LICORES»). */
  family?: string;
}

export interface SalesReportAmounts {
  units: number;
  invitedUnits: number;
  base: number;
  total: number;
}

export interface SalesReportRow extends SalesReportAmounts {
  key: string;
  label: string;
  family?: string;
  share: number;
}

export interface SalesReport {
  query: SalesReportQuery;
  periods: { key: string; label: string; rows: SalesReportRow[]; totals: SalesReportAmounts }[];
  totals: SalesReportAmounts;
  missingAmounts: number;
  history: { done: boolean; oldestDate: string | null };
}
