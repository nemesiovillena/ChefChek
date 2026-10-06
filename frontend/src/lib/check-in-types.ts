/** Tipos del módulo Check-In (control horario). Ver docs/pdr-modulo-check-in.md. */

export interface Employee {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  socialSecurityNumber: string | null;
  jobTitle: string | null;
  section: string | null;
  contractType: string | null;
  weeklyHours: number;
  hourlyCost: number | null;
  defaultLocationId: string | null;
  locationIds: string[];
  hireDate: string | null;
  terminationDate: string | null;
  isActive: boolean;
  /** Tiene PIN de kiosco asignado (el PIN en sí nunca sale del servidor). */
  hasPin: boolean;
  pinLocked: boolean;
  user: { id: string; name: string; email: string } | null;
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  nationalId?: string;
  socialSecurityNumber?: string;
  jobTitle?: string;
  section?: string;
  contractType?: string;
  weeklyHours?: number;
  hourlyCost?: number | null;
  userId?: string | null;
  defaultLocationId?: string | null;
  locationIds?: string[];
  hireDate?: string | null;
  terminationDate?: string | null;
  isActive?: boolean;
}

export interface LinkableUser {
  id: string;
  name: string;
  email: string;
  /** Puesto que tiene asignado en SICTED, si lo hay. */
  suggestedJobTitle: string | null;
}

export type VacationDayType = 'NATURAL' | 'WORKING';

/** Parámetros de convenio, editables tras elegir plantilla. */
export interface AgreementParams {
  annualHours: number;
  weeklyHours: number;
  maxDailyHours: number;
  minRestBetweenShiftsHours: number;
  weeklyRestDays: number;
  nightStart: string;
  nightEnd: string;
  vacationDays: number;
  vacationDayType: VacationDayType;
  overtimeYearlyCap: number;
}

export interface CheckInSettings extends AgreementParams {
  agreementKey: string;
  breaksCountAsWork: boolean;
  autoCloseAfterHours: number;
  pinLength: number;
  updatedAt: string;
}

export interface AgreementPreset {
  key: string;
  name: string;
  note: string;
  needsReview: boolean;
  params: AgreementParams;
}

export interface CheckInSettingsResponse {
  settings: CheckInSettings;
  presets: AgreementPreset[];
}

export type GeofenceMode = 'OFF' | 'WARN' | 'BLOCK';

export interface WorkCenter {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  geofenceMode: GeofenceMode;
  timezone: string;
}

export interface WorkCenterGeofenceInput {
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusM?: number;
  geofenceMode?: GeofenceMode;
  timezone?: string;
}

export type LegalTextKind = 'REGISTRO_JORNADA_INFO' | 'GEOLOCALIZACION' | 'PROTOCOLO_REGISTRO';

export interface LegalTextVersion {
  id: string;
  kind: LegalTextKind;
  version: number;
  content: string;
  validatedByName: string | null;
  validatedAt: string | null;
  createdAt: string;
}

export interface LegalTextState {
  kind: LegalTextKind;
  title: string;
  description: string;
  /** Última versión; puede ser un borrador sin validar. */
  latest: LegalTextVersion;
  /** Versión vigente (la última validada) o null si nunca se validó. */
  current: LegalTextVersion | null;
  hasPendingChanges: boolean;
}

export interface CheckInReadiness {
  ready: boolean;
  missing: LegalTextKind[];
}

// ─────────────────────────────────────────────────────────────── Fichaje

export type PunchType = 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
export type WorkStatus = 'OUT' | 'IN' | 'ON_BREAK';
export type PunchGeofenceStatus = 'INSIDE' | 'OUTSIDE' | 'UNAVAILABLE' | 'OFF';

export interface PunchView {
  id: string;
  type: PunchType;
  occurredAt: string;
  source: 'PERSONAL' | 'KIOSK';
  locationName: string | null;
  geofenceStatus: PunchGeofenceStatus;
  distanceM: number | null;
  needsReview?: boolean;
  /** Guardado en el dispositivo, aún sin enviar al servidor. */
  pending?: boolean;
}

/** Fichaje marcado para que gerencia lo revise. */
export interface ReviewPunch extends PunchView {
  employeeId: string;
  employeeName: string;
  /** Códigos separados por coma: PIN, SECUENCIA, FUERA_DE_ZONA, RELOJ. */
  reviewReason: string | null;
  wasOffline: boolean;
  receivedAt: string;
}

export interface LegalTextForEmployee {
  id: string;
  kind: LegalTextKind;
  title: string;
  version: number;
  content: string;
}

/** Estado de la cuenta personal. `employee` es null si la cuenta no tiene ficha. */
export interface OwnCheckInState {
  readiness: CheckInReadiness;
  isSharedAccount: boolean;
  employee: { id: string; name: string; isActive: boolean } | null;
  status: WorkStatus | null;
  since?: string | null;
  allowedTypes: PunchType[];
  recentPunches: PunchView[];
  pendingLegalTexts: LegalTextForEmployee[];
  /** true si se está mostrando la última copia guardada porque no hay red. */
  offline?: boolean;
}

export interface PunchInput {
  id: string;
  type: PunchType;
  employeeId?: string;
  pin?: string;
  locationId?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  deviceTime?: string;
}

export interface KioskEmployee {
  id: string;
  name: string;
  hasPin: boolean;
  status: WorkStatus;
  allowedTypes: PunchType[];
}

export interface KioskState {
  readiness: CheckInReadiness;
  pinLength: number;
  /** Clave pública para cifrar el PIN de los fichajes sin conexión. */
  pinPublicKey: string;
  centers: { id: string; name: string; isDefault: boolean }[];
  center: { id: string; name: string } | null;
  employees: KioskEmployee[];
  legalTexts: LegalTextForEmployee[];
  offline?: boolean;
}

export interface PresenceEntry {
  id: string;
  name: string;
  jobTitle: string | null;
  section: string | null;
  hasPin: boolean;
  status: WorkStatus;
  since: string | null;
  lastPunch: PunchView | null;
}

// ──────────────────────────────────────────── Jornadas, correcciones y hojas

export type WorkdayIncidence = 'SIN_SALIDA' | 'SECUENCIA';

export interface WorkdayPunch {
  id: string;
  type: PunchType;
  occurredAt: string;
  /** Fichaje real o añadido por una corrección aprobada. */
  origin: 'PUNCH' | 'ADJUSTMENT';
  /** Anulado por una corrección: se muestra, pero no cuenta. */
  voided: boolean;
  needsReview: boolean;
  wasOffline: boolean;
  locationName: string | null;
  geofenceStatus: PunchGeofenceStatus | null;
}

export interface Workday {
  /** AAAA-MM-DD en la zona horaria del centro. */
  date: string;
  segments: { start: string; end: string; kind: 'WORK' | 'BREAK' }[];
  workedMinutes: number;
  breakMinutes: number;
  incidences: WorkdayIncidence[];
  /** Jornada en curso (entrada reciente sin salida). */
  open: boolean;
  punches: WorkdayPunch[];
}

export interface MonthTotals {
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  daysWorked: number;
  incidenceCount: number;
}

export interface ApprovedTimesheet extends MonthTotals {
  id: string;
  version: number;
  reopenReason: string | null;
  approvedByName: string;
  approvedAt: string;
}

/** Mes de una persona: jornadas, totales al día, hoja aprobada y conformidad. */
export interface MonthState {
  year: number;
  month: number;
  employee: { id: string; name: string; weeklyHours: number };
  timezone: string;
  days: Workday[];
  totals: MonthTotals;
  pendingAdjustments: number;
  approved: ApprovedTimesheet | null;
  acknowledgedAt: string | null;
  /** Los totales actuales ya no coinciden con la hoja aprobada. */
  changedSinceApproval: boolean;
}

export interface TimesheetRow {
  employeeId: string;
  employeeName: string;
  isActive: boolean;
  totals: MonthTotals;
  pendingAdjustments: number;
  approved: ApprovedTimesheet | null;
  acknowledgedAt: string | null;
  changedSinceApproval: boolean;
}

export type AdjustmentKind = 'ADD' | 'VOID' | 'REPLACE' | 'CONFIRM';

export interface Adjustment {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: AdjustmentKind;
  targetPunchId: string | null;
  type: PunchType | null;
  occurredAt: string | null;
  reason: string;
  requestedByName: string;
  createdAt: string;
  /** null = pendiente de decisión. */
  decision: {
    status: 'APPROVED' | 'REJECTED';
    note: string | null;
    decidedByName: string;
    decidedAt: string;
  } | null;
}

export interface AdjustmentInput {
  kind: AdjustmentKind;
  employeeId?: string;
  targetPunchId?: string;
  type?: PunchType;
  occurredAt?: string;
  reason: string;
}
