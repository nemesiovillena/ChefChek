/**
 * Roles que gestionan Personal (Check-In, turnos, RRHH): empleados,
 * configuración, validación de textos legales y aprobaciones. RolesGuard es
 * jerárquico, así que "ADMIN" admite también OWNER y SUPERADMIN; "GESTION"
 * (oficina) es un rol lateral que solo cumple quien lo tiene.
 *
 * El rol no basta: la gestión exige además cuenta personal, nunca una
 * compartida (ver CheckInManagerGuard).
 */
export const CHECK_IN_MANAGER_ROLES = ["ADMIN", "GESTION"] as const;

/** Roles que actúan como responsables dentro de Fichar (ven y corrigen a todos). */
export const CHECK_IN_MANAGER_ROLE_NAMES: readonly string[] = [
  "SUPERADMIN",
  "OWNER",
  "ADMIN",
  "GESTION",
];
