/**
 * Rol mínimo que gestiona Check-In: empleados, configuración, validación de
 * textos legales y (en fases posteriores) aprobaciones. RolesGuard es
 * jerárquico, así que "ADMIN" admite también OWNER y SUPERADMIN.
 *
 * Único punto a tocar el día que se añada un rol intermedio (p. ej. un
 * encargado de sección con permiso para aprobar).
 */
export const CHECK_IN_MANAGER_ROLE = "ADMIN";
