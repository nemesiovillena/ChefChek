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

/**
 * Botones que se ofrecen. Con las pausas desactivadas no se puede empezar
 * una, pero quien ya esté en pausa siempre puede terminarla.
 */
export function allowedNextTypes(
  status: EmployeeWorkStatus,
  allowBreaks = true,
): PunchType[] {
  return allowBreaks
    ? ALLOWED_NEXT[status]
    : ALLOWED_NEXT[status].filter((type) => type !== PunchType.BREAK_START);
}

export function isAllowedTransition(
  status: EmployeeWorkStatus,
  type: PunchType,
): boolean {
  return ALLOWED_NEXT[status].includes(type);
}
