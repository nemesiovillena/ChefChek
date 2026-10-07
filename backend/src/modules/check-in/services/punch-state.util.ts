import { PunchType } from "@prisma/client";

/** Situación del empleado según su último fichaje. */
export type EmployeeWorkStatus = "OUT" | "IN" | "ON_BREAK";

export function statusAfter(
  lastType: PunchType | null | undefined,
): EmployeeWorkStatus {
  switch (lastType) {
    case PunchType.IN:
    case PunchType.BREAK_END:
      return "IN";
    case PunchType.BREAK_START:
      return "ON_BREAK";
    default:
      return "OUT";
  }
}

/**
 * Fichajes válidos desde cada situación. Varias entradas y salidas el mismo
 * día son normales (turno partido); lo que no se admite es encadenar dos
 * entradas o salir sin haber entrado.
 */
const ALLOWED_NEXT: Record<EmployeeWorkStatus, PunchType[]> = {
  OUT: [PunchType.IN],
  IN: [PunchType.OUT, PunchType.BREAK_START],
  ON_BREAK: [PunchType.BREAK_END],
};

export function allowedNextTypes(status: EmployeeWorkStatus): PunchType[] {
  return ALLOWED_NEXT[status];
}

export function isAllowedTransition(
  status: EmployeeWorkStatus,
  type: PunchType,
): boolean {
  return ALLOWED_NEXT[status].includes(type);
}
