/**
 * Tipos de proveedores y aprovisionamiento (SICTED fase 6, módulo `PROV`),
 * espejo de `backend/src/modules/sicted/dto` y `services/sicted-*`.
 */

export const COMPLIANCE_TRISTATE = ['YES', 'NO', 'UNKNOWN'] as const;
export type ComplianceTristate = (typeof COMPLIANCE_TRISTATE)[number];

export const COMPLIANCE_TRISTATE_LABELS: Record<ComplianceTristate, string> = {
  YES: 'Sí',
  NO: 'No',
  UNKNOWN: 'Sin verificar',
};

/** PROV.1 — perfil de cumplimiento: upsert por proveedor, no append-only (a diferencia del resto del módulo). */
export interface SupplierComplianceProfile {
  id: string;
  supplierId: string;
  suppliedCategories: string[];
  serviceUnits: string[];
  hasSafetyDataSheets: ComplianceTristate;
  hasIndustrialRegistry: ComplianceTristate;
  hasTechnicalSheets: ComplianceTristate;
  qualityCertification: string | null;
  internalRulesGivenAt: string | null;
  firstContactAt: string | null;
  updatedByName: string;
  updatedAt: string;
}

export interface UpsertSupplierComplianceInput {
  suppliedCategories?: string[];
  serviceUnits?: string[];
  hasSafetyDataSheets?: ComplianceTristate;
  hasIndustrialRegistry?: ComplianceTristate;
  hasTechnicalSheets?: ComplianceTristate;
  qualityCertification?: string;
  internalRulesGivenAt?: string;
  firstContactAt?: string;
}

/** PROV.3 — incidencia de recepción: append-only, `resolution` solo null→valor. */
export interface SupplierIncident {
  id: string;
  supplierId: string;
  supplierName: string;
  albaranId: string | null;
  occurredAt: string;
  transportOk: boolean | null;
  productTemperature: number | null;
  rejectionCause: string | null;
  description: string;
  reportedByName: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export interface CreateSupplierIncidentInput {
  supplierId: string;
  albaranId?: string;
  transportOk?: boolean;
  productTemperature?: number;
  rejectionCause?: string;
  description: string;
  reportedByName: string;
}

/** PROV.7 — sello de inventario semestral: foto+firma de `Stock`, append-only. */
export interface InventorySnapshotLine {
  productId: string;
  productName: string;
  quantity: number;
  minimumStock: number;
  maximumStock: number | null;
  belowMinimum: boolean;
  aboveMaximum: boolean;
}

export interface InventorySnapshotSummary {
  id: string;
  performedAt: string;
  performedByName: string;
  scope: string | null;
  itemCount: number;
  belowMinimumCount: number;
  aboveMaximumCount: number;
  notes: string | null;
}

export interface InventorySnapshot extends InventorySnapshotSummary {
  snapshotData: InventorySnapshotLine[];
}

export interface CreateInventorySnapshotInput {
  performedByName: string;
  scope?: string;
  notes?: string;
}

/** Panel de evidencia de aprovisionamiento (PROV.4/PROV.6/PROV.7/PROV.8) — solo lectura. */
export interface ProcurementEvidenceReport {
  from: string;
  to: string;
  receptions: { confirmedCount: number; withLotCount: number };
  expiringSoon: { warningDays: number; count: number };
  labelsIssued: { count: number };
  stockAlerts: {
    belowMinimumCount: number;
    aboveMaximumCount: number;
    belowMinimum: { productId: string; productName: string; quantity: number; minimumStock: number }[];
    aboveMaximum: { productId: string; productName: string; quantity: number; maximumStock: number }[];
  };
}
