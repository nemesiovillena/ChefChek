import { Prisma, UserRole } from "@prisma/client";

/**
 * Roles que no fichan: gerencia, oficina (Gestión) y User Cuiner. No salen en
 * el kiosco ni pueden fichar desde su cuenta. Fichan el rol Usuario y las
 * fichas de empleado sin cuenta de Equipo.
 */
export const NON_PUNCHING_ROLES: UserRole[] = [
  UserRole.SUPERADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.GESTION,
  UserRole.USER_CUINER,
];

export const ROLE_PUNCH_DENIED = "Tu rol no ficha.";

/** Una ficha sin cuenta ficha siempre; con cuenta, depende del rol. */
export function roleCanPunch(role: UserRole | null | undefined): boolean {
  return !role || !NON_PUNCHING_ROLES.includes(role);
}

/** Filtro de Prisma: fichas sin cuenta o con una cuenta de un rol que ficha. */
export const EMPLOYEE_ROLE_CAN_PUNCH_WHERE: Prisma.EmployeeWhereInput = {
  OR: [{ userId: null }, { user: { role: { notIn: NON_PUNCHING_ROLES } } }],
};
