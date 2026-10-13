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
  /** Avisos legales de lo planificado: orientativos, no impiden guardar. */
  alerts: ScheduleAlert[];
  /** Estimación: horas planificadas por el coste hora de cada ficha. */
  laborCost: { byDay: number[]; total: number; employeesWithoutCost: number };
}

export type ScheduleRuleCode =
  | 'DESCANSO_ENTRE_JORNADAS'
  | 'JORNADA_DIARIA'
  | 'HORAS_SEMANALES'
  | 'DESCANSO_SEMANAL'
  | 'HORAS_EXTRA_ANUALES';

export interface ScheduleAlert {
  code: ScheduleRuleCode;
  employeeId: string;
  /** Día al que se refiere, o null si es de toda la semana. */
  date: string | null;
  shiftIds: string[];
  message: string;
}

/**
 * PENDING: aún no ha empezado. IN_PROGRESS: trabajando. NO_SHOW: debería
 * haber empezado y no ha fichado. INCIDENT: fichó con retraso, salida
 * anticipada o exceso. UNPLANNED: trabajó sin turno publicado.
 */
export type DayComparisonStatus = 'PENDING' | 'IN_PROGRESS' | 'OK' | 'NO_SHOW' | 'INCIDENT' | 'UNPLANNED';
export type DayComparisonFlag = 'LATE' | 'EARLY_LEAVE' | 'OVER';

/** Lo planificado para una persona en un día frente a lo que fichó. */
export interface PlanVsActualRow {
  employeeId: string;
  employeeName: string;
  date: string;
  status: DayComparisonStatus;
  flags: DayComparisonFlag[];
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedMinutes: number;
  actualStart: string | null;
  actualEnd: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overMinutes: number;
  /** null si la ficha no tiene coste hora. */
  plannedCost: number | null;
  actualCost: number | null;
}

export interface PlanVsActualWeek {
  weekStart: string;
  rows: PlanVsActualRow[];
  totals: { plannedMinutes: number; workedMinutes: number; plannedCost: number; actualCost: number };
}
