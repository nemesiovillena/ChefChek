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

// ─────────────────────────────────────────────────────────── Planificador

export type ShiftStatus = 'DRAFT' | 'PUBLISHED';

export interface Shift {
  id: string;
  locationId: string;
  /** null = turno abierto, por cubrir. */
  employeeId: string | null;
  /** AAAA-MM-DD: día en que empieza. */
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** Minutos de trabajo: duración menos la pausa. */
  workMinutes: number;
  color: string | null;
  note: string | null;
  status: ShiftStatus;
  /** Solo en "mis turnos". */
  locationName?: string | null;
}

export interface ShiftInput {
  locationId: string;
  employeeId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  color?: string;
  note?: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  isActive: boolean;
}

export interface ShiftTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  color?: string;
  isActive?: boolean;
}

/** Todo lo que pinta la rejilla de una semana en un centro. */
export interface WeekSchedule {
  weekStart: string;
  days: string[];
  location: { id: string; name: string };
  employees: { id: string; name: string; section: string | null; weeklyHours: number }[];
  shifts: Shift[];
  absences: {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    status: AbsenceStatus;
    typeName: string;
    color: string;
  }[];
  holidays: Holiday[];
  templates: ShiftTemplate[];
  /** Turnos en borrador: aún no los ve su persona. */
  draftCount: number;
  lastPublication: { publishedAt: string; publishedByName: string } | null;
}
