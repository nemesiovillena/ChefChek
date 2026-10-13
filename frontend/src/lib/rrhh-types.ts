/** Tipos del portal del empleado ("Mi espacio"). */

export type EmployeeRequestKind = 'DATA_CHANGE' | 'OTHER';
export type EmployeeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Datos personales que el empleado puede proponer cambiar. */
export interface PersonalData {
  phone: string | null;
  whatsapp: string | null;
  street: string | null;
  city: string | null;
  payrollEmail: string | null;
  nationalId: string | null;
  socialSecurityNumber: string | null;
}
export type PersonalDataField = keyof PersonalData;

export const PERSONAL_DATA_LABELS: Record<PersonalDataField, string> = {
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  street: 'Dirección',
  city: 'Población',
  payrollEmail: 'Email para nóminas',
  nationalId: 'DNI/NIE',
  socialSecurityNumber: 'Nº de la Seguridad Social',
};

export interface OwnProfile {
  employeeId: string;
  name: string;
  email: string | null;
  personal: PersonalData;
  job: {
    jobTitle: string | null;
    section: string | null;
    contractType: string | null;
    weeklyHours: number;
    hireDate: string | null;
    centers: string[];
  };
}

/** Una solicitud mía, venga del flujo que venga. */
export interface OwnRequestItem {
  source: 'REQUEST' | 'ADJUSTMENT' | 'ABSENCE';
  id: string;
  title: string;
  detail: string | null;
  status: EmployeeRequestStatus;
  decisionNote: string | null;
  createdAt: string;
}

/** Cambio de datos o petición libre, tal como la ve gerencia. */
export interface EmployeeRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: EmployeeRequestKind;
  changes: Partial<Record<PersonalDataField, string>> | null;
  message: string | null;
  summary: string | null;
  status: EmployeeRequestStatus;
  decisionNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface EmployeeRequestInput {
  kind: EmployeeRequestKind;
  changes?: Partial<Record<PersonalDataField, string>>;
  message?: string;
}

export const REQUEST_STATUS_LABELS: Record<EmployeeRequestStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Retirada',
};
