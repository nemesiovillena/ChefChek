/**
 * Tipos del motor de checklist compartido (SICTED), espejo de los DTOs/
 * entidades de `backend/src/modules/checklists`. Tres modos sobre el mismo
 * esqueleto Plantilla → Hoja → Marca — ver fase 2 del plan.
 */

export const CHECKLIST_KINDS = [
  'CLEANING',
  'OPENING',
  'CLOSING',
  'COMFORT',
  'SUSTAINABILITY',
  'RECEPTION',
  'MAINTENANCE',
  'OTHER',
] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export const CHECKLIST_MODES = ['EXECUTION', 'INSPECTION', 'MEASUREMENT'] as const;
export type ChecklistMode = (typeof CHECKLIST_MODES)[number];

export const CHECKLIST_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
export type ChecklistFrequency = (typeof CHECKLIST_FREQUENCIES)[number];

export const CHECKLIST_ITEM_FREQUENCIES = [...CHECKLIST_FREQUENCIES, 'AFTER_EACH_USE', 'AS_NEEDED'] as const;
export type ChecklistItemFrequency = (typeof CHECKLIST_ITEM_FREQUENCIES)[number];

export type ChecklistRunStatus = 'OPEN' | 'COMPLETED' | 'INCOMPLETE';

export type ChecklistOutcome = 'DONE' | 'NOT_DONE' | 'OK' | 'BAD';

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  itemFrequency: string | null;
  procedure: string | null;
  products: string[];
  dosage: string | null;
  epi: string | null;
  isRequired: boolean;
  expectedRangeMin: number | null;
  expectedRangeMax: number | null;
  defaultValue: number | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  externalCode: string | null;
  usedByModules: string[];
  kind: ChecklistKind;
  mode: ChecklistMode;
  area: string;
  frequency: ChecklistFrequency;
  weekday: number | null;
  dayOfMonth: number | null;
  responsiblePosition: string | null;
  requiresSupervisor: boolean;
  practiceRef: string | null;
  version: number;
  archivedAt: string | null;
  items: ChecklistTemplateItem[];
}

export interface ChecklistTemplateItemInput {
  /** Id del ítem ya guardado: al editar el Plan conserva su identidad (y sus marcas). */
  id?: string;
  label: string;
  itemFrequency?: string;
  procedure?: string;
  products?: string[];
  dosage?: string;
  epi?: string;
  isRequired?: boolean;
  expectedRangeMin?: number;
  expectedRangeMax?: number;
  defaultValue?: number;
}

export interface ChecklistTemplateInput {
  name: string;
  externalCode?: string;
  kind: ChecklistKind;
  mode: ChecklistMode;
  area: string;
  frequency: ChecklistFrequency;
  weekday?: number;
  dayOfMonth?: number;
  responsiblePosition?: string;
  requiresSupervisor?: boolean;
  practiceRef?: string;
  items: ChecklistTemplateItemInput[];
}

/** Ítem congelado en el momento de generar la hoja (independiente de ediciones posteriores a la plantilla). */
export interface ChecklistRunSnapshotItem {
  id: string;
  label: string;
  isRequired: boolean;
  expectedRangeMin: number | null;
  expectedRangeMax: number | null;
}

export interface ChecklistRunSnapshot {
  templateName: string;
  version: number;
  mode: ChecklistMode;
  requiresSupervisor: boolean;
  items: ChecklistRunSnapshotItem[];
}

export interface ChecklistEntry {
  id: string;
  runId: string;
  itemId: string;
  outcome: ChecklistOutcome | null;
  reason: string | null;
  observation: string | null;
  value: number | null;
  withinRange: boolean | null;
  correctiveAction: string | null;
  note: string | null;
  correctsEntryId: string | null;
  performedByUserId: string | null;
  performedByName: string;
  recordedAt: string;
}

export interface ChecklistRunTemplateRef {
  id: string;
  name: string;
  area: string;
  mode: ChecklistMode;
  frequency: ChecklistFrequency;
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Lunes y domingo de una semana ISO, como fechas UTC planas (solo año/mes/día). */
function isoWeekRange(isoYear: number, isoWeek: number): [Date, Date] {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() + ((isoWeek - 1) * 7 - (jan4Dow - 1)) * 86_400_000);
  return [monday, new Date(monday.getTime() + 6 * 86_400_000)];
}

/**
 * Periodo de una hoja para mostrar, con fechas que se entiendan sin calendario:
 * `2026-10-01` → `01/10/2026`; `2026-W40` → `semana del 28/09 al 04/10/2026`;
 * `2026-10` → `octubre de 2026`; `2026-Q4` → `4.º trimestre de 2026`; `2026` → `año 2026`.
 * Se trocea el texto en vez de usar `new Date(key)`, que lo leería en UTC y podría bailar un día.
 */
export function formatPeriodKey(periodKey: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;

  const week = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (week) {
    const [monday, sunday] = isoWeekRange(Number(week[1]), Number(week[2]));
    const dayMonth = (d: Date) => `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
    return `semana del ${dayMonth(monday)} al ${dayMonth(sunday)}/${sunday.getUTCFullYear()}`;
  }

  const month = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (month) return `${MONTH_NAMES[Number(month[2]) - 1]} de ${month[1]}`;

  const quarter = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarter) return `${quarter[2]}.º trimestre de ${quarter[1]}`;

  return /^\d{4}$/.test(periodKey) ? `año ${periodKey}` : periodKey;
}

/** Forma común a `GET runs/today` y `GET runs` (sin entries). */
export interface ChecklistRunSummary {
  id: string;
  templateId: string;
  periodKey: string;
  periodStart: string;
  status: ChecklistRunStatus;
  snapshot: ChecklistRunSnapshot;
  supervisedAt: string | null;
  supervisedByUserId: string | null;
  supervisorName: string | null;
  supervisorNote: string | null;
  closedAt: string | null;
  template: ChecklistRunTemplateRef;
  /** Ítems distintos con al menos una marca — no nº de filas de `entries` (una corrección no lo infla). */
  entriesCount: number;
}

/** Forma de `GET runs/:id` y de la respuesta de `POST runs/:id/entries`. */
export interface ChecklistRunDetail extends Omit<ChecklistRunSummary, 'entriesCount'> {
  entries: ChecklistEntry[];
  currentByItem: Record<string, ChecklistEntry>;
}

export interface ChecklistEntryInput {
  itemId: string;
  outcome?: ChecklistOutcome;
  reason?: string;
  observation?: string;
  value?: number;
  correctiveAction?: string;
  note?: string;
  performedByUserId?: string;
  performedByName: string;
  correctsEntryId?: string;
}

export interface ChecklistPerformer {
  id: string;
  name: string;
}

export const CHECKLIST_KIND_LABELS: Record<ChecklistKind, string> = {
  CLEANING: 'Limpieza',
  OPENING: 'Apertura',
  CLOSING: 'Cierre',
  COMFORT: 'Confort',
  SUSTAINABILITY: 'Sostenibilidad',
  RECEPTION: 'Recepción',
  MAINTENANCE: 'Mantenimiento',
  OTHER: 'Otro',
};

export const CHECKLIST_FREQUENCY_LABELS: Record<ChecklistFrequency, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  ANNUAL: 'Anual',
};

export const CHECKLIST_MODE_LABELS: Record<ChecklistMode, string> = {
  EXECUTION: '¿Se hizo?',
  INSPECTION: '¿Está bien?',
  MEASUREMENT: 'Medición',
};
