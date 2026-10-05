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
