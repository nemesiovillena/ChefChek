/** Tipos del módulo Turnos y ausencias. Ver docs/pdr-modulo-check-in.md. */

export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AbsenceType {
  id: string;
  name: string;
  color: string;
  /** Descuenta días del saldo anual de vacaciones. */
  deductsVacation: boolean;
  isPaid: boolean;
  /** La puede pedir el propio empleado (las bajas las registra gerencia). */
  employeeCanRequest: boolean;
  isActive: boolean;
}

export interface AbsenceTypeInput {
  name: string;
  color?: string;
  deductsVacation?: boolean;
  isPaid?: boolean;
  employeeCanRequest?: boolean;
  isActive?: boolean;
}

export interface Absence {
  id: string;
  employeeId: string;
  employeeName: string;
  type: { id: string; name: string; color: string; deductsVacation: boolean };
  /** AAAA-MM-DD, ambas incluidas. */
  startDate: string;
  endDate: string;
  halfDay: boolean;
  /** Días que consume según el cómputo del convenio (naturales o laborables). */
  days: number;
  status: AbsenceStatus;
  note: string | null;
  requestedByName: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface AbsenceInput {
  employeeId?: string;
  absenceTypeId: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
  note?: string;
}

export interface LeaveBalance {
  employeeId: string;
  employeeName: string;
  year: number;
  entitledDays: number;
  carriedOverDays: number;
  adjustmentDays: number;
  /** Los días son los del convenio; nadie los ha fijado a mano. */
  isDefault: boolean;
  note: string | null;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface LeaveBalanceInput {
  entitledDays: number;
  carriedOverDays?: number;
  adjustmentDays?: number;
  note?: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  locationId: string | null;
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};
