/**
 * Tipos del motor de mantenimiento compartido (SICTED fase 4), espejo de
 * `backend/src/modules/checklists` — equipos, planes de revisión, registros
 * (evidencia) e incidencias (avería/PAC).
 */

export const CHECKLIST_ASSET_CATEGORIES = [
  'FRIO',
  'COCINA',
  'CLIMATIZACION',
  'EXTINTORES',
  'PLAGAS',
  'ELECTRICO',
  'OTRO',
] as const;
export type ChecklistAssetCategory = (typeof CHECKLIST_ASSET_CATEGORIES)[number];

export const CHECKLIST_ASSET_CATEGORY_LABELS: Record<ChecklistAssetCategory, string> = {
  FRIO: 'Frío',
  COCINA: 'Cocina',
  CLIMATIZACION: 'Climatización',
  EXTINTORES: 'Extintores',
  PLAGAS: 'Plagas',
  ELECTRICO: 'Eléctrico',
  OTRO: 'Otro',
};

export interface ChecklistAsset {
  id: string;
  name: string;
  externalCode: string | null;
  category: ChecklistAssetCategory;
  usedByModules: string[];
  location: string | null;
  provider: string | null;
  isActive: boolean;
}

export interface ChecklistAssetInput {
  name: string;
  externalCode?: string;
  category: ChecklistAssetCategory;
  location?: string;
  provider?: string;
}

export interface ChecklistMaintenancePlan {
  id: string;
  assetId: string;
  title: string;
  periodicityMonths: number;
  nextDueAt: string;
  lastDoneAt: string | null;
  externalProvider: boolean;
  responsible: string | null;
  isActive: boolean;
  asset: { id: string; name: string; category: ChecklistAssetCategory };
}

export interface ChecklistMaintenancePlanInput {
  assetId: string;
  title: string;
  periodicityMonths: number;
  externalProvider?: boolean;
  responsible?: string;
}

export interface ChecklistMaintenanceAttachment {
  storageKey: string;
  name: string;
  mime: string;
  size: number;
}

export interface ChecklistMaintenanceRecord {
  id: string;
  planId: string;
  assetId: string;
  performedAt: string;
  performedByName: string;
  providerName: string | null;
  cost: number | null;
  notes: string | null;
  attachments: ChecklistMaintenanceAttachment[];
  recordedAt: string;
}

export const CHECKLIST_INCIDENT_KINDS = ['BREAKDOWN', 'CORRECTIVE_ACTION'] as const;
export type ChecklistIncidentKind = (typeof CHECKLIST_INCIDENT_KINDS)[number];

export const CHECKLIST_INCIDENT_KIND_LABELS: Record<ChecklistIncidentKind, string> = {
  BREAKDOWN: 'Parte de avería',
  CORRECTIVE_ACTION: 'Acción correctiva (PAC)',
};

export const CHECKLIST_INCIDENT_STATUSES = ['OPEN', 'NOTIFIED', 'RESOLVED'] as const;
export type ChecklistIncidentStatus = (typeof CHECKLIST_INCIDENT_STATUSES)[number];

export const CHECKLIST_INCIDENT_STATUS_LABELS: Record<ChecklistIncidentStatus, string> = {
  OPEN: 'Abierta',
  NOTIFIED: 'Notificada',
  RESOLVED: 'Resuelta',
};

export interface ChecklistIncident {
  id: string;
  assetId: string | null;
  asset: { id: string; name: string; category: ChecklistAssetCategory } | null;
  kind: ChecklistIncidentKind;
  partNumber: number | null;
  status: ChecklistIncidentStatus;
  detectedAt: string;
  detectedByName: string;
  // BREAKDOWN
  reportedTo: string | null;
  faultType: string | null;
  technicianNotifiedAt: string | null;
  serviceStartedAt: string | null;
  serviceEndedAt: string | null;
  // Compartido
  resolvedAt: string | null;
  // CORRECTIVE_ACTION
  processOrEquipment: string | null;
  deviationDescription: string | null;
  deviationCause: string | null;
  correctiveMeasure: string | null;
  responsibleName: string | null;
  deadline: string | null;
  resolution: string | null;
  affectedLot: string | null;
  affectedProductName: string | null;
  affectedQuantity: number | null;
}

export interface CreateChecklistIncidentInput {
  kind: ChecklistIncidentKind;
  assetId?: string;
  detectedByName: string;
  reportedTo?: string;
  faultType?: string;
  processOrEquipment?: string;
  deviationDescription?: string;
  deviationCause?: string;
  responsibleName?: string;
  deadline?: string;
  affectedLot?: string;
  affectedProductName?: string;
  affectedQuantity?: number;
}

export interface UpdateChecklistIncidentInput {
  status?: ChecklistIncidentStatus;
  reportedTo?: string;
  faultType?: string;
  technicianNotifiedAt?: string;
  serviceStartedAt?: string;
  serviceEndedAt?: string;
  resolvedAt?: string;
  correctiveMeasure?: string;
  resolution?: string;
  deadline?: string;
}
